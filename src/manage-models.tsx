import { Action, ActionPanel, Alert, Color, Icon, List, confirmAlert, environment, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { ChildProcess, execFile, spawn } from "child_process";
import { existsSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { useState, useCallback, useRef, useEffect } from "react";
import { MODELS, modelIdFromValue, modelCacheDir, isModelDownloaded, getActiveModel, setActiveModel, TTS_VOICES, isTtsVoiceDownloaded, getActiveTtsVoice, setActiveTtsVoice, ttsVoicesDir, ttsVoiceOnnxPath, TtsVoice, KOKORO_VOICES, KOKORO_MODEL_ID, isKokoroModelDownloaded, isKokoroVoiceDownloaded, deleteKokoroVoice, getActiveKokoroVoice, setActiveKokoroVoice, SYSTEM_VOICES, getActiveSystemVoice, setActiveSystemVoice, clearActiveSystemVoice, clearActiveKokoroVoice, clearActiveTtsVoice, ensureDefaultTtsVoice, isPythonPackageInstalled } from "./models";
import { stopCurrentPlayback, PLAYBACK_PID } from "./read-aloud";

let activePreview: ChildProcess | null = null;

function stopPreview() {
  if (activePreview) {
    try { activePreview.kill("SIGKILL"); } catch {}
    activePreview = null;
  }
  stopCurrentPlayback();
}

interface Preferences {
  pythonPath: string;
  kokoroPythonPath: string;
}

function resolveKokoroPython(prefs: Preferences): string {
  const raw = prefs.kokoroPythonPath || "~/.local/lib-kokoro/venv/bin/python3";
  return raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
}

// --- Reusable download hook ---

function useDownloader() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const process = useRef<ChildProcess | null>(null);

  async function download(
    id: string,
    label: string,
    cmd: string,
    args: string[],
    opts: { timeout?: number; onSuccess?: () => void | Promise<void> } = {},
  ) {
    setDownloadingId(id);
    const toast = await showToast({ style: Toast.Style.Animated, title: `Downloading ${label}...` });
    try {
      await new Promise<void>((resolve, reject) => {
        const child = execFile(cmd, args, { timeout: opts.timeout ?? 600_000 }, (error) => {
          process.current = null;
          if (error) reject(error);
          else resolve();
        });
        process.current = child;
      });
      toast.style = Toast.Style.Success;
      toast.title = `Downloaded ${label}`;
      await opts.onSuccess?.();
    } catch (error) {
      if ((error as NodeJS.ErrnoException & { killed?: boolean }).killed) {
        toast.style = Toast.Style.Success;
        toast.title = "Download cancelled";
      } else {
        toast.style = Toast.Style.Failure;
        toast.title = "Download failed";
        toast.message = (error instanceof Error ? error.message : String(error)).slice(0, 120);
      }
    } finally {
      setDownloadingId(null);
    }
  }

  function cancel() {
    process.current?.kill();
  }

  return { downloadingId, download, cancel };
}

function downloadStatusTag(downloading: boolean, downloaded: boolean): List.Item.Accessory {
  if (downloading) return { tag: { value: "Downloading...", color: Color.Blue } };
  if (downloaded) return { tag: { value: "Downloaded", color: Color.Green } };
  return { tag: { value: "Not Downloaded", color: Color.SecondaryText } };
}

async function confirmDelete(title: string, message: string, deleteFn: () => void): Promise<boolean> {
  const confirmed = await confirmAlert({
    title,
    message,
    primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
  });
  if (!confirmed) return false;
  try {
    deleteFn();
    await showToast({ style: Toast.Style.Success, title: `Deleted ${title.replace(/^Delete /, "").replace(/\?$/, "")}` });
    return true;
  } catch (err) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Delete failed",
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// --- Reusable list item ---

interface ModelListItemProps {
  itemKey: string;
  title: string;
  isActive: boolean;
  downloaded: boolean;
  isDownloading: boolean;
  statusTag?: List.Item.Accessory;
  onSetActive?: () => void;
  onUnsetActive?: () => void;
  onDownload?: () => void;
  onCancelDownload?: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
}

function ModelListItem({ itemKey, title, isActive, downloaded, isDownloading, statusTag, onSetActive, onUnsetActive, onDownload, onCancelDownload, onDelete, onPreview }: ModelListItemProps) {
  const accessories: List.Item.Accessory[] = [];
  if (isActive) {
    accessories.push({ icon: { source: Icon.Checkmark, tintColor: Color.Green }, tooltip: "Active" });
  }
  accessories.push(statusTag ?? downloadStatusTag(isDownloading, downloaded));

  return (
    <List.Item
      key={itemKey}
      title={title}
      accessories={accessories}
      actions={
        <ActionPanel>
          {downloaded && !isActive && onSetActive && (
            <Action title="Set Active" icon={Icon.Checkmark} onAction={onSetActive} />
          )}
          {isActive && onUnsetActive && (
            <Action title="Unset Active" icon={Icon.XMarkCircle} onAction={onUnsetActive} />
          )}
          {!downloaded && !isDownloading && onDownload && (
            <Action title="Download" icon={Icon.Download} onAction={onDownload} />
          )}
          {isDownloading && onCancelDownload && (
            <Action title="Cancel Download" icon={Icon.XMarkCircle} style={Action.Style.Destructive} onAction={onCancelDownload} />
          )}
          {downloaded && onDelete && (
            <Action title="Delete" icon={Icon.Trash} style={Action.Style.Destructive} shortcut={{ modifiers: ["ctrl"], key: "x" }} onAction={onDelete} />
          )}
          {onPreview && (
            <Action title="Preview" icon={Icon.Play} shortcut={{ modifiers: ["cmd"], key: "p" }} onAction={onPreview} />
          )}
        </ActionPanel>
      }
    />
  );
}

// --- Status hooks ---

function useModelStatus() {
  const [statuses, setStatuses] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const m of MODELS) {
      initial[m.value] = isModelDownloaded(modelIdFromValue(m.value));
    }
    return initial;
  });

  const refresh = useCallback(() => {
    const updated: Record<string, boolean> = {};
    for (const m of MODELS) {
      updated[m.value] = isModelDownloaded(modelIdFromValue(m.value));
    }
    setStatuses(updated);
  }, []);

  return { statuses, refresh };
}

function useTtsVoiceStatus() {
  const [statuses, setStatuses] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const v of TTS_VOICES) {
      initial[v.id] = isTtsVoiceDownloaded(v.id);
    }
    return initial;
  });

  const refresh = useCallback(() => {
    const updated: Record<string, boolean> = {};
    for (const v of TTS_VOICES) {
      updated[v.id] = isTtsVoiceDownloaded(v.id);
    }
    setStatuses(updated);
  }, []);

  return { statuses, refresh };
}

// --- Command ---

export default function Command() {
  const prefs = getPreferenceValues<Preferences>();
  const { pythonPath } = prefs;
  const kokoroPython = resolveKokoroPython(prefs);

  const { statuses: sttStatuses, refresh: refreshStt } = useModelStatus();
  const [activeModel, setActiveModelState] = useState<string | undefined>();
  const sttDownloader = useDownloader();

  const { statuses: piperStatuses, refresh: refreshPiper } = useTtsVoiceStatus();
  const [activePiperVoice, setActivePiperVoiceState] = useState<string | undefined>();
  const [piperEngineInstalled, setPiperEngineInstalled] = useState<boolean | null>(null);
  const piperDownloader = useDownloader();

  const [activeKokoroVoice, setActiveKokoroVoiceState] = useState<string | undefined>();
  const [kokoroBaseDownloaded, setKokoroBaseDownloaded] = useState(() => isKokoroModelDownloaded());
  const [kokoroEngineInstalled, setKokoroEngineInstalled] = useState<boolean | null>(null);
  const [kokoroVoiceStatuses, setKokoroVoiceStatuses] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const v of KOKORO_VOICES) {
      initial[v.id] = isKokoroVoiceDownloaded(v.id);
    }
    return initial;
  });
  const kokoroDownloader = useDownloader();

  const [activeSystemVoice, setActiveSystemVoiceState] = useState<string | undefined>();

  useEffect(() => {
    isPythonPackageInstalled(pythonPath, "piper").then(setPiperEngineInstalled);
    isPythonPackageInstalled(kokoroPython, "kokoro").then(setKokoroEngineInstalled);
    ensureDefaultTtsVoice().then(() => {
      getActiveModel().then(setActiveModelState);
      getActiveTtsVoice().then(setActivePiperVoiceState);
      getActiveKokoroVoice().then(setActiveKokoroVoiceState);
      getActiveSystemVoice().then(setActiveSystemVoiceState);
    });
  }, []);

  // --- STT handlers ---

  async function handleSetActiveStt(modelValue: string) {
    await setActiveModel(modelValue);
    setActiveModelState(modelValue);
    const model = MODELS.find((m) => m.value === modelValue);
    await showToast({ style: Toast.Style.Success, title: `Active model: ${model?.title ?? modelValue}` });
  }

  function handleDownloadStt(modelValue: string) {
    const modelId = modelIdFromValue(modelValue);
    const script = `from huggingface_hub import snapshot_download; snapshot_download("${modelId}")`;
    sttDownloader.download(modelValue, modelId, pythonPath, ["-c", script], {
      onSuccess: async () => {
        refreshStt();
        if (!activeModel) await handleSetActiveStt(modelValue);
      },
    });
  }

  // --- Piper handlers ---

  async function handleSetActivePiper(voiceId: string) {
    await setActiveTtsVoice(voiceId);
    await clearActiveKokoroVoice();
    await clearActiveSystemVoice();
    setActivePiperVoiceState(voiceId);
    setActiveKokoroVoiceState(undefined);
    setActiveSystemVoiceState(undefined);
    const voice = TTS_VOICES.find((v) => v.id === voiceId);
    await showToast({ style: Toast.Style.Success, title: `Active voice: ${voice?.title ?? voiceId}` });
  }

  async function handleDownloadPiper(voice: TtsVoice) {
    if (!piperEngineInstalled) {
      const confirmed = await confirmAlert({
        title: "Install Piper Voice Engine (~24MB)",
        message: "Piper needs to be installed before downloading voices.",
        primaryAction: { title: "Install" },
      });
      if (!confirmed) return;

      const toast = await showToast({ style: Toast.Style.Animated, title: "Installing Piper engine..." });
      try {
        await new Promise<void>((resolve, reject) => {
          execFile(pythonPath, ["-m", "pip", "install", "--break-system-packages", "piper-tts"], { timeout: 300_000 }, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        setPiperEngineInstalled(true);
        toast.style = Toast.Style.Success;
        toast.title = "Piper engine installed";
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = "Engine install failed";
        toast.message = (error instanceof Error ? error.message : String(error)).slice(0, 120);
        return;
      }
    }

    piperDownloader.download(voice.id, voice.id, pythonPath, ["-m", "piper.download_voices", voice.id, "--download-dir", ttsVoicesDir()], {
      timeout: 300_000,
      onSuccess: async () => {
        refreshPiper();
        if (!activePiperVoice) await handleSetActivePiper(voice.id);
      },
    });
  }

  // --- Kokoro handlers ---

  async function handleSetActiveKokoro(voiceId: string) {
    await setActiveKokoroVoice(voiceId);
    await clearActiveTtsVoice();
    await clearActiveSystemVoice();
    setActiveKokoroVoiceState(voiceId);
    setActivePiperVoiceState(undefined);
    setActiveSystemVoiceState(undefined);
    const voice = KOKORO_VOICES.find((v) => v.id === voiceId);
    await showToast({ style: Toast.Style.Success, title: `Active voice: ${voice?.title ?? voiceId}` });
  }

  async function handleDownloadKokoroVoice(voiceId: string) {
    if (!kokoroBaseDownloaded) {
      const sizeNote = kokoroEngineInstalled
        ? "To use Kokoro voices, the voice engine needs to be downloaded first (~312MB). This is a one-time download."
        : "To use Kokoro voices, the Python packages (~50MB) and voice engine (~312MB) need to be installed first. This is a one-time setup.";
      const confirmed = await confirmAlert({
        title: "Install Kokoro Voice Engine",
        message: sizeNote,
        primaryAction: { title: "Install" },
      });
      if (!confirmed) return;
    }

    if (!kokoroEngineInstalled) {
      const toast = await showToast({ style: Toast.Style.Animated, title: "Installing Kokoro packages..." });
      try {
        if (!existsSync(kokoroPython)) {
          const venvDir = dirname(dirname(kokoroPython));
          await new Promise<void>((resolve, reject) => {
            execFile(pythonPath, ["-m", "venv", venvDir], { timeout: 60_000 }, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        }
        await new Promise<void>((resolve, reject) => {
          execFile(kokoroPython, ["-m", "pip", "install", "kokoro", "soundfile", "numpy"], { timeout: 600_000 }, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        setKokoroEngineInstalled(true);
        toast.style = Toast.Style.Success;
        toast.title = "Kokoro packages installed";
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = "Package install failed";
        toast.message = (error instanceof Error ? error.message : String(error)).slice(0, 120);
        return;
      }
    }

    const files = kokoroBaseDownloaded
      ? [`voices/${voiceId}.pt`]
      : ["kokoro-v1_0.pth", "config.json", `voices/${voiceId}.pt`];
    const allowArg = files.map((f) => `"${f}"`).join(", ");
    const script = `from huggingface_hub import snapshot_download; snapshot_download("${KOKORO_MODEL_ID}", allow_patterns=[${allowArg}])`;
    const label = kokoroBaseDownloaded ? `Kokoro voice ${voiceId}` : `Kokoro engine + ${voiceId}`;
    kokoroDownloader.download(`kokoro-${voiceId}`, label, pythonPath, ["-c", script], {
      onSuccess: () => {
        setKokoroBaseDownloaded(true);
        setKokoroVoiceStatuses((prev) => ({ ...prev, [voiceId]: true }));
      },
    });
  }

  // --- Preview handlers ---

  function handlePreviewSample(voiceId: string) {
    stopPreview();
    const samplePath = join(environment.assetsPath, "samples", `${voiceId}.wav`);
    const player = spawn("afplay", [samplePath], { detached: true, stdio: "ignore" });
    activePreview = player;
    if (player.pid) writeFileSync(PLAYBACK_PID, String(player.pid));
    player.on("exit", () => {
      if (activePreview === player) activePreview = null;
      try { unlinkSync(PLAYBACK_PID); } catch {}
    });
    player.unref();
  }

  function handlePreviewSystem(voiceId: string) {
    stopPreview();
    const player = spawn("say", ["-v", voiceId, "Testing 1, 2, 3"], { detached: true, stdio: "ignore" });
    activePreview = player;
    if (player.pid) writeFileSync(PLAYBACK_PID, String(player.pid));
    player.on("exit", () => {
      if (activePreview === player) activePreview = null;
      try { unlinkSync(PLAYBACK_PID); } catch {}
    });
    player.unref();
  }

  // --- System handlers ---

  async function handleSetActiveSystem(voiceId: string) {
    await setActiveSystemVoice(voiceId);
    await clearActiveTtsVoice();
    await clearActiveKokoroVoice();
    setActiveSystemVoiceState(voiceId);
    setActivePiperVoiceState(undefined);
    setActiveKokoroVoiceState(undefined);
    await showToast({ style: Toast.Style.Success, title: `Active voice: ${voiceId}` });
  }

  return (
    <List>
      <List.Section title="Models" subtitle="Speech-to-text transcription">
      {MODELS.map((m) => (
        <ModelListItem
          key={m.value}
          itemKey={m.value}
          title={m.title}
          isActive={m.value === activeModel}
          downloaded={sttStatuses[m.value] ?? false}
          isDownloading={sttDownloader.downloadingId === m.value}
          onSetActive={() => handleSetActiveStt(m.value)}
          onDownload={() => handleDownloadStt(m.value)}
          onCancelDownload={sttDownloader.cancel}
          onDelete={async () => {
            const modelId = modelIdFromValue(m.value);
            if (await confirmDelete(`Delete ${modelId}?`, "This will remove the cached model files from disk.", () => rmSync(modelCacheDir(modelId), { recursive: true, force: true }))) {
              refreshStt();
            }
          }}
        />
      ))}
      </List.Section>

      <List.Section title="Piper Voices" subtitle="Fast, lightweight, CPU-only TTS">
      {TTS_VOICES.map((v) => (
        <ModelListItem
          key={`piper-${v.id}`}
          itemKey={`piper-${v.id}`}
          title={v.title}
          isActive={v.id === activePiperVoice}
          downloaded={piperStatuses[v.id] ?? false}
          isDownloading={piperDownloader.downloadingId === v.id}
          onSetActive={() => handleSetActivePiper(v.id)}
          onUnsetActive={async () => { await clearActiveTtsVoice(); setActivePiperVoiceState(undefined); await showToast({ style: Toast.Style.Success, title: "Piper voice unset" }); }}
          onPreview={() => handlePreviewSample(v.id)}
          onDownload={() => handleDownloadPiper(v)}
          onCancelDownload={piperDownloader.cancel}
          onDelete={async () => {
            if (await confirmDelete(`Delete ${v.id}?`, "This will remove the voice model files from disk.", () => {
              const onnxPath = ttsVoiceOnnxPath(v.id);
              try { unlinkSync(onnxPath); } catch {}
              try { unlinkSync(onnxPath + ".json"); } catch {}
            })) {
              refreshPiper();
              if (v.id === activePiperVoice) {
                await clearActiveTtsVoice();
                setActivePiperVoiceState(undefined);
                if (!activeSystemVoice) {
                  await handleSetActiveSystem(SYSTEM_VOICES[0].id);
                }
              }
              const anyRemaining = TTS_VOICES.some((other) => other.id !== v.id && isTtsVoiceDownloaded(other.id));
              if (!anyRemaining && piperEngineInstalled) {
                const uninstall = await confirmAlert({
                  title: "Uninstall Piper Voice Engine?",
                  message: "No Piper voices remain. Would you also like to uninstall the voice engine (~24MB)?",
                  primaryAction: { title: "Uninstall", style: Alert.ActionStyle.Destructive },
                });
                if (uninstall) {
                  await new Promise<void>((resolve) => {
                    execFile(pythonPath, ["-m", "pip", "uninstall", "--break-system-packages", "-y", "piper-tts"], { timeout: 60_000 }, () => resolve());
                  });
                  setPiperEngineInstalled(false);
                }
              }
            }
          }}
        />
      ))}
      </List.Section>

      <List.Section title="Kokoro Voices" subtitle="High-quality neural TTS">
      {KOKORO_VOICES.map((v) => {
        const voiceDownloaded = kokoroVoiceStatuses[v.id] ?? false;
        const isDownloading = kokoroDownloader.downloadingId === `kokoro-${v.id}`;
        return (
          <ModelListItem
            key={`kokoro-${v.id}`}
            itemKey={`kokoro-${v.id}`}
            title={v.title}
            isActive={v.id === activeKokoroVoice}
            downloaded={voiceDownloaded}
            isDownloading={isDownloading}
            onSetActive={() => handleSetActiveKokoro(v.id)}
            onUnsetActive={async () => { await clearActiveKokoroVoice(); setActiveKokoroVoiceState(undefined); await showToast({ style: Toast.Style.Success, title: "Kokoro voice unset" }); }}
            onPreview={() => handlePreviewSample(v.id)}
            onDownload={() => handleDownloadKokoroVoice(v.id)}
            onCancelDownload={kokoroDownloader.cancel}
            onDelete={async () => {
              const voice = KOKORO_VOICES.find((k) => k.id === v.id);
              if (await confirmDelete(`Delete ${voice?.title ?? v.id}?`, "This will remove the voice file from disk.", () => deleteKokoroVoice(v.id))) {
                const updated = { ...kokoroVoiceStatuses, [v.id]: false };
                setKokoroVoiceStatuses(updated);
                if (v.id === activeKokoroVoice) {
                  await clearActiveKokoroVoice();
                  setActiveKokoroVoiceState(undefined);
                  if (!activeSystemVoice) {
                    await handleSetActiveSystem(SYSTEM_VOICES[0].id);
                  }
                }
                const anyRemaining = Object.values(updated).some(Boolean);
                if (!anyRemaining && kokoroBaseDownloaded) {
                  const deleteEngine = await confirmAlert({
                    title: "Uninstall Kokoro Voice Engine?",
                    message: "No Kokoro voices remain. Would you also like to uninstall the voice engine (~362MB)?",
                    primaryAction: { title: "Uninstall", style: Alert.ActionStyle.Destructive },
                  });
                  if (deleteEngine) {
                    rmSync(modelCacheDir(KOKORO_MODEL_ID), { recursive: true, force: true });
                    setKokoroBaseDownloaded(false);
                    if (kokoroEngineInstalled) {
                      await new Promise<void>((resolve) => {
                        execFile(kokoroPython, ["-m", "pip", "uninstall", "-y", "kokoro", "soundfile", "numpy"], { timeout: 60_000 }, () => resolve());
                      });
                      setKokoroEngineInstalled(false);
                    }
                  }
                }
              }
            }}
          />
        );
      })}
      </List.Section>

      <List.Section title="System Voices" subtitle="macOS built-in voices for Read Aloud">
      {SYSTEM_VOICES.map((v) => (
        <ModelListItem
          key={`system-${v.id}`}
          itemKey={`system-${v.id}`}
          title={v.title}
          isActive={v.id === activeSystemVoice}
          downloaded={true}
          isDownloading={false}
          statusTag={{ tag: { value: "Built-in", color: Color.Orange } }}
          onPreview={() => handlePreviewSystem(v.id)}
          onSetActive={() => handleSetActiveSystem(v.id)}
          onUnsetActive={async () => { await clearActiveSystemVoice(); setActiveSystemVoiceState(undefined); await showToast({ style: Toast.Style.Success, title: "System voice unset" }); }}
        />
      ))}
      </List.Section>
    </List>
  );
}

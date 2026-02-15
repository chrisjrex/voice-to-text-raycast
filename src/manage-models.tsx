import { Action, ActionPanel, Alert, Color, Icon, List, confirmAlert, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { ChildProcess, execFile } from "child_process";
import { rmSync, unlinkSync } from "fs";
import { useState, useCallback, useRef, useEffect } from "react";
import { MODELS, modelIdFromValue, modelCacheDir, isModelDownloaded, getActiveModel, setActiveModel, TTS_VOICES, isTtsVoiceDownloaded, getActiveTtsVoice, setActiveTtsVoice, ttsVoicesDir, ttsVoiceOnnxPath, TtsVoice, KOKORO_VOICES, KOKORO_MODEL_ID, isKokoroModelDownloaded, getActiveKokoroVoice, setActiveKokoroVoice, SYSTEM_VOICES, getActiveSystemVoice, setActiveSystemVoice } from "./models";

interface Preferences {
  pythonPath: string;
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
      if ((error as NodeJS.ErrnoException).killed) {
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
  const { pythonPath } = getPreferenceValues<Preferences>();

  const { statuses: sttStatuses, refresh: refreshStt } = useModelStatus();
  const [activeModel, setActiveModelState] = useState<string | undefined>();
  const sttDownloader = useDownloader();

  const { statuses: piperStatuses, refresh: refreshPiper } = useTtsVoiceStatus();
  const [activePiperVoice, setActivePiperVoiceState] = useState<string | undefined>();
  const piperDownloader = useDownloader();

  const [activeKokoroVoice, setActiveKokoroVoiceState] = useState<string | undefined>();
  const [kokoroDownloaded, setKokoroDownloaded] = useState(() => isKokoroModelDownloaded());
  const kokoroDownloader = useDownloader();

  const [activeSystemVoice, setActiveSystemVoiceState] = useState<string | undefined>();

  useEffect(() => {
    getActiveModel().then(setActiveModelState);
    getActiveTtsVoice().then(setActivePiperVoiceState);
    getActiveKokoroVoice().then(setActiveKokoroVoiceState);
    getActiveSystemVoice().then(setActiveSystemVoiceState);
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
    setActivePiperVoiceState(voiceId);
    const voice = TTS_VOICES.find((v) => v.id === voiceId);
    await showToast({ style: Toast.Style.Success, title: `Active Piper voice: ${voice?.title ?? voiceId}` });
  }

  function handleDownloadPiper(voice: TtsVoice) {
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
    setActiveKokoroVoiceState(voiceId);
    const voice = KOKORO_VOICES.find((v) => v.id === voiceId);
    await showToast({ style: Toast.Style.Success, title: `Active Kokoro voice: ${voice?.title ?? voiceId}` });
  }

  function handleDownloadKokoro() {
    const script = `from huggingface_hub import snapshot_download; snapshot_download("${KOKORO_MODEL_ID}")`;
    kokoroDownloader.download("kokoro", "Kokoro model", pythonPath, ["-c", script], {
      onSuccess: () => setKokoroDownloaded(true),
    });
  }

  // --- System handlers ---

  async function handleSetActiveSystem(voiceId: string) {
    await setActiveSystemVoice(voiceId);
    setActiveSystemVoiceState(voiceId);
    await showToast({ style: Toast.Style.Success, title: `Active system voice: ${voiceId}` });
  }

  return (
    <List>
      <List.Section title="Models" subtitle="Select a downloaded model to use for transcription">
      {MODELS.map((m) => {
        const downloaded = sttStatuses[m.value] ?? false;
        const isActive = m.value === activeModel;
        const isDownloading = sttDownloader.downloadingId === m.value;

        const accessories: List.Item.Accessory[] = [];
        if (isActive) {
          accessories.push({ icon: { source: Icon.Checkmark, tintColor: Color.Green }, tooltip: "Active model" });
        }
        accessories.push(downloadStatusTag(isDownloading, downloaded));

        return (
          <List.Item
            key={m.value}
            title={m.title}
            accessories={accessories}
            actions={
              <ActionPanel>
                {downloaded && !isActive && (
                  <Action title="Set Active" icon={Icon.Checkmark} onAction={() => handleSetActiveStt(m.value)} />
                )}
                {!downloaded && !isDownloading && (
                  <Action title="Download" icon={Icon.Download} onAction={() => handleDownloadStt(m.value)} />
                )}
                {isDownloading && (
                  <Action title="Cancel Download" icon={Icon.XMarkCircle} style={Action.Style.Destructive} onAction={sttDownloader.cancel} />
                )}
                {downloaded && !isActive && (
                  <Action
                    title="Delete"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={async () => {
                      const modelId = modelIdFromValue(m.value);
                      if (await confirmDelete(`Delete ${modelId}?`, "This will remove the cached model files from disk.", () => rmSync(modelCacheDir(modelId), { recursive: true, force: true }))) {
                        refreshStt();
                      }
                    }}
                  />
                )}
              </ActionPanel>
            }
          />
        );
      })}
      </List.Section>

      <List.Section title="Piper Voices" subtitle="Piper TTS voices for Read Aloud">
      {TTS_VOICES.map((v) => {
        const downloaded = piperStatuses[v.id] ?? false;
        const isActive = v.id === activePiperVoice;
        const isDownloading = piperDownloader.downloadingId === v.id;

        const accessories: List.Item.Accessory[] = [];
        if (isActive) {
          accessories.push({ icon: { source: Icon.Checkmark, tintColor: Color.Green }, tooltip: "Active voice" });
        }
        accessories.push(downloadStatusTag(isDownloading, downloaded));

        return (
          <List.Item
            key={`piper-${v.id}`}
            title={v.title}
            accessories={accessories}
            actions={
              <ActionPanel>
                {downloaded && !isActive && (
                  <Action title="Set Active" icon={Icon.Checkmark} onAction={() => handleSetActivePiper(v.id)} />
                )}
                {!downloaded && !isDownloading && (
                  <Action title="Download" icon={Icon.Download} onAction={() => handleDownloadPiper(v)} />
                )}
                {isDownloading && (
                  <Action title="Cancel Download" icon={Icon.XMarkCircle} style={Action.Style.Destructive} onAction={piperDownloader.cancel} />
                )}
                {downloaded && !isActive && (
                  <Action
                    title="Delete"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={async () => {
                      if (await confirmDelete(`Delete ${v.id}?`, "This will remove the voice model files from disk.", () => {
                        const onnxPath = ttsVoiceOnnxPath(v.id);
                        try { unlinkSync(onnxPath); } catch {}
                        try { unlinkSync(onnxPath + ".json"); } catch {}
                      })) {
                        refreshPiper();
                      }
                    }}
                  />
                )}
              </ActionPanel>
            }
          />
        );
      })}
      </List.Section>

      <List.Section title="Kokoro Voices" subtitle="High-quality local TTS (~300MB shared model)">
      {KOKORO_VOICES.map((v) => {
        const isActive = v.id === activeKokoroVoice;
        const isDownloading = kokoroDownloader.downloadingId !== null;

        const accessories: List.Item.Accessory[] = [];
        if (isActive) {
          accessories.push({ icon: { source: Icon.Checkmark, tintColor: Color.Green }, tooltip: "Active voice" });
        }
        accessories.push(downloadStatusTag(isDownloading, kokoroDownloaded));

        return (
          <List.Item
            key={`kokoro-${v.id}`}
            title={v.title}
            accessories={accessories}
            actions={
              <ActionPanel>
                {kokoroDownloaded && !isActive && (
                  <Action title="Set Active" icon={Icon.Checkmark} onAction={() => handleSetActiveKokoro(v.id)} />
                )}
                {!kokoroDownloaded && !isDownloading && (
                  <Action title="Download Kokoro Model" icon={Icon.Download} onAction={handleDownloadKokoro} />
                )}
                {isDownloading && (
                  <Action title="Cancel Download" icon={Icon.XMarkCircle} style={Action.Style.Destructive} onAction={kokoroDownloader.cancel} />
                )}
                {kokoroDownloaded && !isActive && (
                  <Action
                    title="Delete Kokoro Model"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={async () => {
                      if (await confirmDelete("Delete Kokoro model?", "This will remove the cached Kokoro model (~300MB) from disk.", () => rmSync(modelCacheDir(KOKORO_MODEL_ID), { recursive: true, force: true }))) {
                        setKokoroDownloaded(false);
                      }
                    }}
                  />
                )}
              </ActionPanel>
            }
          />
        );
      })}
      </List.Section>

      <List.Section title="System Voices" subtitle="macOS built-in voices for Read Aloud">
      {SYSTEM_VOICES.map((v) => {
        const isActive = v.id === activeSystemVoice;

        const accessories: List.Item.Accessory[] = [];
        if (isActive) {
          accessories.push({ icon: { source: Icon.Checkmark, tintColor: Color.Green }, tooltip: "Active voice" });
        }
        accessories.push({ tag: { value: "Built-in", color: Color.Orange } });

        return (
          <List.Item
            key={`system-${v.id}`}
            title={v.title}
            accessories={accessories}
            actions={
              <ActionPanel>
                {!isActive && (
                  <Action title="Set Active" icon={Icon.Checkmark} onAction={() => handleSetActiveSystem(v.id)} />
                )}
              </ActionPanel>
            }
          />
        );
      })}
      </List.Section>
    </List>
  );
}

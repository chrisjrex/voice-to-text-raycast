import { Action, ActionPanel, Alert, Color, Icon, List, confirmAlert, environment, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { ChildProcess, execFile, spawn } from "child_process";
import { rmSync, unlinkSync } from "fs";
import { join } from "path";
import { useState, useCallback, useRef, useEffect } from "react";
import { MODELS, modelIdFromValue, modelCacheDir, isModelDownloaded, getActiveModel, setActiveModel, TTS_VOICES, isTtsVoiceDownloaded, getActiveTtsVoice, setActiveTtsVoice, ttsVoicesDir, ttsVoiceOnnxPath, TtsVoice, KOKORO_VOICES, KOKORO_MODEL_ID, isKokoroModelDownloaded, getActiveKokoroVoice, setActiveKokoroVoice, SYSTEM_VOICES, getActiveSystemVoice, setActiveSystemVoice, clearActiveSystemVoice, clearActiveKokoroVoice, clearActiveTtsVoice, ensureDefaultTtsVoice } from "./models";

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
          {downloaded && !isActive && onDelete && (
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

  // --- Preview handlers ---

  function handlePreviewSample(voiceId: string) {
    const samplePath = join(environment.assetsPath, "samples", `${voiceId}.wav`);
    spawn("afplay", [samplePath], { detached: true, stdio: "ignore" }).unref();
  }

  function handlePreviewSystem(voiceId: string) {
    spawn("say", ["-v", voiceId, "Testing 1, 2, 3"], { detached: true, stdio: "ignore" }).unref();
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

      <List.Section title="Piper Voices" subtitle="Piper TTS voices for Read Aloud">
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
            }
          }}
        />
      ))}
      </List.Section>

      <List.Section title="Kokoro Voices" subtitle="High-quality local TTS (~300MB shared model)">
      {KOKORO_VOICES.map((v) => (
        <ModelListItem
          key={`kokoro-${v.id}`}
          itemKey={`kokoro-${v.id}`}
          title={v.title}
          isActive={v.id === activeKokoroVoice}
          downloaded={kokoroDownloaded}
          isDownloading={kokoroDownloader.downloadingId !== null}
          onSetActive={() => handleSetActiveKokoro(v.id)}
          onUnsetActive={async () => { await clearActiveKokoroVoice(); setActiveKokoroVoiceState(undefined); await showToast({ style: Toast.Style.Success, title: "Kokoro voice unset" }); }}
          onPreview={() => handlePreviewSample(v.id)}
          onDownload={handleDownloadKokoro}
          onCancelDownload={kokoroDownloader.cancel}
          onDelete={async () => {
            if (await confirmDelete("Delete Kokoro model?", "This will remove the cached Kokoro model (~300MB) from disk.", () => rmSync(modelCacheDir(KOKORO_MODEL_ID), { recursive: true, force: true }))) {
              setKokoroDownloaded(false);
            }
          }}
        />
      ))}
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

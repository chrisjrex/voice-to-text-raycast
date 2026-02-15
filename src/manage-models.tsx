import { Action, ActionPanel, Alert, Color, Icon, List, confirmAlert, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { ChildProcess, execFile } from "child_process";
import { rmSync, unlinkSync } from "fs";
import { useState, useCallback, useRef, useEffect } from "react";
import { MODELS, modelIdFromValue, modelCacheDir, isModelDownloaded, getActiveModel, setActiveModel, TTS_VOICES, isTtsVoiceDownloaded, getActiveTtsVoice, setActiveTtsVoice, ttsVoicesDir, ttsVoiceOnnxPath, TtsVoice } from "./models";

interface Preferences {
  pythonPath: string;
}

function useModelStatus() {
  const [statuses, setStatuses] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const m of MODELS) {
      const id = modelIdFromValue(m.value);
      initial[m.value] = isModelDownloaded(id);
    }
    return initial;
  });

  const refresh = useCallback(() => {
    const updated: Record<string, boolean> = {};
    for (const m of MODELS) {
      const id = modelIdFromValue(m.value);
      updated[m.value] = isModelDownloaded(id);
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

export default function Command() {
  const { pythonPath } = getPreferenceValues<Preferences>();
  const { statuses, refresh } = useModelStatus();
  const [activeModel, setActiveModelState] = useState<string | undefined>();
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const downloadProcess = useRef<ChildProcess | null>(null);

  const { statuses: ttsStatuses, refresh: refreshTts } = useTtsVoiceStatus();
  const [activeTtsVoice, setActiveTtsVoiceState] = useState<string | undefined>();
  const [downloadingTtsVoice, setDownloadingTtsVoice] = useState<string | null>(null);

  useEffect(() => {
    getActiveModel().then(setActiveModelState);
    getActiveTtsVoice().then(setActiveTtsVoiceState);
  }, []);

  async function handleSetActive(modelValue: string) {
    await setActiveModel(modelValue);
    setActiveModelState(modelValue);
    const model = MODELS.find((m) => m.value === modelValue);
    await showToast({ style: Toast.Style.Success, title: `Active model: ${model?.title ?? modelValue}` });
  }

  async function handleDownload(modelValue: string) {
    const modelId = modelIdFromValue(modelValue);
    setDownloadingModel(modelValue);

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Downloading ${modelId}...`,
    });

    const script = `from huggingface_hub import snapshot_download; snapshot_download("${modelId}")`;
    try {
      await new Promise<void>((resolve, reject) => {
        const child = execFile(pythonPath, ["-c", script], { timeout: 600_000 }, (error) => {
          downloadProcess.current = null;
          if (error) reject(error);
          else resolve();
        });
        downloadProcess.current = child;
      });
      toast.style = Toast.Style.Success;
      toast.title = `Downloaded ${modelId}`;
      refresh();
      if (!activeModel) {
        await handleSetActive(modelValue);
      }
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
      setDownloadingModel(null);
    }
  }

  function handleCancelDownload() {
    downloadProcess.current?.kill();
  }

  async function handleSetActiveTts(voiceId: string) {
    await setActiveTtsVoice(voiceId);
    setActiveTtsVoiceState(voiceId);
    const voice = TTS_VOICES.find((v) => v.id === voiceId);
    await showToast({ style: Toast.Style.Success, title: `Active TTS voice: ${voice?.title ?? voiceId}` });
  }

  async function handleDownloadTts(voice: TtsVoice) {
    setDownloadingTtsVoice(voice.id);

    const toast = await showToast({ style: Toast.Style.Animated, title: `Downloading ${voice.id}...` });

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(pythonPath, ["-m", "piper.download_voices", voice.id, "--download-dir", ttsVoicesDir()], { timeout: 300_000 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      toast.style = Toast.Style.Success;
      toast.title = `Downloaded ${voice.id}`;
      refreshTts();
      if (!activeTtsVoice) {
        await handleSetActiveTts(voice.id);
      }
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Download failed";
      toast.message = (error instanceof Error ? error.message : String(error)).slice(0, 120);
    } finally {
      setDownloadingTtsVoice(null);
    }
  }

  return (
    <List>
      <List.Section title="Models" subtitle="Select a downloaded model to use for transcription">
      {MODELS.map((m) => {
        const downloaded = statuses[m.value] ?? false;
        const isActive = m.value === activeModel;
        const isDownloading = downloadingModel === m.value;

        const accessories: List.Item.Accessory[] = [];
        if (isActive) {
          accessories.push({ icon: { source: Icon.Checkmark, tintColor: Color.Green }, tooltip: "Active model" });
        }
        if (isDownloading) {
          accessories.push({ tag: { value: "Downloading...", color: Color.Blue } });
        } else if (downloaded) {
          accessories.push({ tag: { value: "Downloaded", color: Color.Green } });
        } else {
          accessories.push({ tag: { value: "Not Downloaded", color: Color.SecondaryText } });
        }

        return (
          <List.Item
            key={m.value}
            title={m.title}
            accessories={accessories}
            actions={
              <ActionPanel>
                {downloaded && !isActive && (
                  <Action
                    title="Set Active"
                    icon={Icon.Checkmark}
                    onAction={() => handleSetActive(m.value)}
                  />
                )}
                {!downloaded && !isDownloading && (
                  <Action
                    title="Download"
                    icon={Icon.Download}
                    onAction={() => handleDownload(m.value)}
                  />
                )}
                {isDownloading && (
                  <Action
                    title="Cancel Download"
                    icon={Icon.XMarkCircle}
                    style={Action.Style.Destructive}
                    onAction={handleCancelDownload}
                  />
                )}
                {downloaded && !isActive && (
                  <Action
                    title="Delete"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={async () => {
                      const modelId = modelIdFromValue(m.value);
                      const confirmed = await confirmAlert({
                        title: `Delete ${modelId}?`,
                        message: "This will remove the cached model files from disk.",
                        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
                      });
                      if (!confirmed) return;
                      try {
                        rmSync(modelCacheDir(modelId), { recursive: true, force: true });
                        refresh();
                        await showToast({ style: Toast.Style.Success, title: `Deleted ${modelId}` });
                      } catch (err) {
                        await showToast({
                          style: Toast.Style.Failure,
                          title: "Delete failed",
                          message: err instanceof Error ? err.message : String(err),
                        });
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
      <List.Section title="TTS Voices" subtitle="Piper voices for Read Aloud">
      {TTS_VOICES.map((v) => {
        const downloaded = ttsStatuses[v.id] ?? false;
        const isActive = v.id === activeTtsVoice;
        const isDownloading = downloadingTtsVoice === v.id;

        const accessories: List.Item.Accessory[] = [];
        if (isActive) {
          accessories.push({ icon: { source: Icon.Checkmark, tintColor: Color.Green }, tooltip: "Active voice" });
        }
        if (isDownloading) {
          accessories.push({ tag: { value: "Downloading...", color: Color.Blue } });
        } else if (downloaded) {
          accessories.push({ tag: { value: "Downloaded", color: Color.Green } });
        } else {
          accessories.push({ tag: { value: "Not Downloaded", color: Color.SecondaryText } });
        }

        return (
          <List.Item
            key={v.id}
            title={v.title}
            accessories={accessories}
            actions={
              <ActionPanel>
                {downloaded && !isActive && (
                  <Action
                    title="Set Active"
                    icon={Icon.Checkmark}
                    onAction={() => handleSetActiveTts(v.id)}
                  />
                )}
                {!downloaded && !isDownloading && (
                  <Action
                    title="Download"
                    icon={Icon.Download}
                    onAction={() => handleDownloadTts(v)}
                  />
                )}
                {downloaded && !isActive && (
                  <Action
                    title="Delete"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                    onAction={async () => {
                      const confirmed = await confirmAlert({
                        title: `Delete ${v.id}?`,
                        message: "This will remove the voice model files from disk.",
                        primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
                      });
                      if (!confirmed) return;
                      try {
                        const onnxPath = ttsVoiceOnnxPath(v.id);
                        try { unlinkSync(onnxPath); } catch {}
                        try { unlinkSync(onnxPath + ".json"); } catch {}
                        refreshTts();
                        await showToast({ style: Toast.Style.Success, title: `Deleted ${v.id}` });
                      } catch (err) {
                        await showToast({
                          style: Toast.Style.Failure,
                          title: "Delete failed",
                          message: err instanceof Error ? err.message : String(err),
                        });
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
    </List>
  );
}

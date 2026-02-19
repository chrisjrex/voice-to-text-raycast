import {
  Clipboard,
  environment,
  getPreferenceValues,
  LocalStorage,
  showHUD,
  updateCommandMetadata,
} from "@raycast/api";
import { execFile, spawn } from "child_process";
import { existsSync, mkdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { parseModel, transcribe } from "./transcribe";
import { isModelDownloaded, getActiveModel } from "./models";
import { hasEnabledProcessors, runPostProcessing } from "./post-processors";
import { addHistoryEntry } from "./history";

const execFileAsync = promisify(execFile);

interface Preferences {
  soxPath: string;
  pythonPath: string;
  saveHistory: boolean;
  copyToClipboard: boolean;
  pasteToActiveApp: boolean;
  silenceTimeout: string;
}

const STORAGE_KEY_PID = "recording_pid";
const STORAGE_KEY_MONITOR_PID = "monitor_pid";
const STORAGE_KEY_AUDIO = "audio_path";
const DEPS_CHECKED_KEY = "deps_checked";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function checkDependencies(
  soxPath: string,
  pythonPath: string,
  provider: string,
): Promise<string | null> {
  const alreadyChecked = await LocalStorage.getItem<string>(DEPS_CHECKED_KEY);
  if (alreadyChecked === provider) return null;

  try {
    await execFileAsync(soxPath, ["--version"]);
  } catch {
    return `sox not found at ${soxPath}. Install with: brew install sox`;
  }

  const pyModule = provider === "whisper" ? "mlx_whisper" : "parakeet_mlx";
  const pipPkg = provider === "whisper" ? "mlx-whisper" : "parakeet-mlx";
  try {
    await execFileAsync(pythonPath, ["-c", `import ${pyModule}`]);
  } catch {
    return `${pipPkg} not found. Install with: pip install ${pipPkg}`;
  }

  await LocalStorage.setItem(DEPS_CHECKED_KEY, provider);
  return null;
}

async function startRecording(
  soxPath: string,
  silenceTimeout: number,
): Promise<void> {
  const sttDir = join(environment.supportPath, "stt", "recordings");
  mkdirSync(sttDir, { recursive: true });
  const audioPath = join(sttDir, `recording-${Date.now()}.wav`);

  const recorder = spawn(
    soxPath,
    ["-d", "-t", "wav", "-r", "16000", "-c", "1", "-b", "16", audioPath],
    {
      detached: true,
      stdio: "ignore",
    },
  );
  recorder.unref();

  if (!recorder.pid) {
    await showHUD("Failed to start recording");
    return;
  }

  await LocalStorage.setItem(STORAGE_KEY_PID, recorder.pid.toString());
  await LocalStorage.setItem(STORAGE_KEY_AUDIO, audioPath);

  if (silenceTimeout > 0) {
    const timeout = Math.ceil(silenceTimeout);
    const deeplink = "raycast://extensions/rex/voice-to-text/toggle-dictation";
    const watchdogScript = [
      `RECORDER_PID=${recorder.pid}`,
      `AUDIO_FILE='${audioPath}'`,
      `SOX_PATH='${soxPath}'`,
      `TIMEOUT=${timeout}`,
      `silent_count=0`,
      `while kill -0 "$RECORDER_PID" 2>/dev/null; do`,
      `  sleep 1`,
      `  file_size=$(stat -f%z "$AUDIO_FILE" 2>/dev/null || echo 0)`,
      `  [ "$file_size" -lt 32100 ] && continue`,
      `  max_amp=$(tail -c 32000 "$AUDIO_FILE" \\`,
      `    | "$SOX_PATH" -t raw -r 16000 -c 1 -b 16 -e signed-integer - -n stat 2>&1 \\`,
      `    | awk '/Maximum amplitude/{print $3}')`,
      `  [ -z "$max_amp" ] && continue`,
      `  is_silent=$(awk "BEGIN{print ($max_amp < 0.02) ? 1 : 0}")`,
      `  if [ "$is_silent" -eq 1 ]; then`,
      `    silent_count=$((silent_count + 1))`,
      `  else`,
      `    silent_count=0`,
      `  fi`,
      `  if [ "$silent_count" -ge "$TIMEOUT" ]; then`,
      `    kill "$RECORDER_PID" 2>/dev/null`,
      `    sleep 0.5`,
      `    open "${deeplink}"`,
      `    exit 0`,
      `  fi`,
      `done`,
    ].join("\n");

    const monitor = spawn("/bin/sh", ["-c", watchdogScript], {
      detached: true,
      stdio: "ignore",
    });
    monitor.unref();

    if (monitor.pid) {
      await LocalStorage.setItem(
        STORAGE_KEY_MONITOR_PID,
        monitor.pid.toString(),
      );
    }
  }

  await updateCommandMetadata({ subtitle: "Recording..." });
  await showHUD("🎙 Recording...");
}

async function stopAndTranscribe(
  pid: number,
  audioPath: string,
  pythonPath: string,
  provider: string,
  modelId: string,
  model: string,
  saveHistoryEnabled: boolean,
  copyToClipboardEnabled: boolean,
  pasteToActiveAppEnabled: boolean,
): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* ignore */
  }

  const monitorPid = await LocalStorage.getItem<string>(
    STORAGE_KEY_MONITOR_PID,
  );
  if (monitorPid) {
    try {
      process.kill(parseInt(monitorPid, 10), "SIGTERM");
    } catch {
      /* ignore */
    }
  }

  await LocalStorage.removeItem(STORAGE_KEY_PID);
  await LocalStorage.removeItem(STORAGE_KEY_AUDIO);
  await LocalStorage.removeItem(STORAGE_KEY_MONITOR_PID);

  // Brief delay for sox to flush the file
  await new Promise((r) => setTimeout(r, 300));

  if (!existsSync(audioPath)) {
    await updateCommandMetadata({ subtitle: "" });
    await showHUD("No audio file found");
    return;
  }

  const fileSize = statSync(audioPath).size;
  if (fileSize < 1000) {
    unlinkSync(audioPath);
    await updateCommandMetadata({ subtitle: "" });
    await showHUD("Recording too short");
    return;
  }

  await updateCommandMetadata({ subtitle: "Transcribing..." });
  await showHUD("Transcribing...");

  try {
    const transcribeStart = Date.now();
    const text = await transcribe(pythonPath, provider, modelId, audioPath);
    const transcriptionMs = Date.now() - transcribeStart;

    if (!text) {
      await updateCommandMetadata({ subtitle: "" });
      await showHUD("No speech detected");
    } else {
      const willProcess = await hasEnabledProcessors();
      if (willProcess) {
        await updateCommandMetadata({ subtitle: "Processing..." });
        await showHUD("Processing...");
      }
      const postProcessStart = Date.now();
      const { text: processed, appliedProcessors } =
        await runPostProcessing(text);
      const postProcessingMs = Date.now() - postProcessStart;
      if (saveHistoryEnabled)
        addHistoryEntry(processed, {
          model,
          postProcessors: appliedProcessors,
          transcriptionMs,
          postProcessingMs,
        });
      if (copyToClipboardEnabled) await Clipboard.copy(processed);
      if (pasteToActiveAppEnabled) await Clipboard.paste(processed);
      const preview =
        processed.length > 60 ? processed.slice(0, 60) + "..." : processed;
      await updateCommandMetadata({ subtitle: "" });
      await showHUD(`✅ ${preview}`);
    }
  } catch (err: unknown) {
    const stderr = (err as { stderr?: string }).stderr || "";
    const msg =
      stderr.split("\n").filter(Boolean).pop() ||
      (err instanceof Error ? err.message : String(err));
    await updateCommandMetadata({ subtitle: "" });
    await showHUD(`Transcription failed: ${msg.slice(0, 80)}`);
  } finally {
    try {
      unlinkSync(audioPath);
    } catch {
      /* ignore */
    }
  }
}

export default async function Command() {
  const {
    soxPath,
    pythonPath,
    saveHistory: saveHistoryEnabled,
    copyToClipboard: copyToClipboardEnabled,
    pasteToActiveApp: pasteToActiveAppEnabled,
    silenceTimeout: silenceTimeoutStr,
  } = getPreferenceValues<Preferences>();
  const silenceTimeout = Math.max(0, parseFloat(silenceTimeoutStr) || 0);

  const model = await getActiveModel();
  if (!model) {
    await updateCommandMetadata({ subtitle: "" });
    await showHUD("No model selected. Use Manage Models to select one.");
    return;
  }

  const { provider, modelId } = parseModel(model);

  const depError = await checkDependencies(soxPath, pythonPath, provider);
  if (depError) {
    await updateCommandMetadata({ subtitle: "" });
    await showHUD(depError);
    return;
  }

  if (!isModelDownloaded(modelId)) {
    await updateCommandMetadata({ subtitle: "" });
    await showHUD(
      "Model not downloaded. Use Manage Models to download it first.",
    );
    return;
  }

  const storedPid = await LocalStorage.getItem<string>(STORAGE_KEY_PID);
  const storedAudio = await LocalStorage.getItem<string>(STORAGE_KEY_AUDIO);

  if (storedPid && storedAudio) {
    const pid = parseInt(storedPid, 10);

    if (!isProcessAlive(pid)) {
      if (existsSync(storedAudio) && statSync(storedAudio).size >= 1000) {
        await LocalStorage.removeItem(STORAGE_KEY_PID);
        await LocalStorage.removeItem(STORAGE_KEY_AUDIO);
        await stopAndTranscribe(
          pid,
          storedAudio,
          pythonPath,
          provider,
          modelId,
          model,
          saveHistoryEnabled,
          copyToClipboardEnabled,
          pasteToActiveAppEnabled,
        );
      } else {
        await LocalStorage.removeItem(STORAGE_KEY_PID);
        await LocalStorage.removeItem(STORAGE_KEY_AUDIO);
        await LocalStorage.removeItem(STORAGE_KEY_MONITOR_PID);
        await updateCommandMetadata({ subtitle: "" });
        await showHUD("Previous recording lost. Try again.");
      }
      return;
    }

    await stopAndTranscribe(
      pid,
      storedAudio,
      pythonPath,
      provider,
      modelId,
      model,
      saveHistoryEnabled,
      copyToClipboardEnabled,
      pasteToActiveAppEnabled,
    );
  } else {
    await startRecording(soxPath, silenceTimeout);
  }
}

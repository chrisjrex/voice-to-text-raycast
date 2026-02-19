/**
 * Raycast models wrapper - re-exports from @vtt/core
 * This file provides Raycast-specific utilities while delegating to the core library
 */

import { environment } from "@raycast/api";
import { execFile } from "child_process";
import { existsSync, rmSync, readlinkSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import {
  VOICES_BY_ENGINE,
  MODEL_ALIASES,
  getActiveModel as coreGetActiveModel,
  setActiveModel as coreSetActiveModel,
  getActiveTtsVoice as coreGetActiveTtsVoice,
  setActiveTtsVoice as coreSetActiveTtsVoice,
  getActiveKokoroVoice as coreGetActiveKokoroVoice,
  setActiveKokoroVoice as coreSetActiveKokoroVoice,
  getActiveSystemVoice as coreGetActiveSystemVoice,
  setActiveSystemVoice as coreSetActiveSystemVoice,
  clearActiveSystemVoice as coreClearActiveSystemVoice,
  clearActiveKokoroVoice as coreClearActiveKokoroVoice,
  clearActiveTtsVoice as coreClearActiveTtsVoice,
  isTtsInitialized as coreIsTtsInitialized,
  setTtsInitialized as coreSetTtsInitialized,
  modelCacheDir,
  isModelDownloaded,
  isKokoroModelDownloaded,
  kokoroSnapshotDir,
  isKokoroVoiceDownloaded,
  isPiperVoiceDownloaded,
  KOKORO_MODEL_ID,
  setStateStorage,
  type VoiceInfo,
  type ModelInfo,
} from "@vtt/core";
import { raycastStateStorage } from "./state";

setStateStorage(raycastStateStorage);

export interface Model {
  title: string;
  value: string;
}

export interface TtsVoice {
  title: string;
  id: string;
}

export const MODELS: Model[] = Object.entries(MODEL_ALIASES).map(
  ([, info]) => ({
    title: `${info.name} (${info.size})`,
    value: `${info.provider}:${info.id}`,
  }),
);

export function modelIdFromValue(value: string): string {
  return value.slice(value.indexOf(":") + 1);
}

export {
  modelCacheDir,
  isModelDownloaded,
  KOKORO_MODEL_ID,
  kokoroSnapshotDir,
  isKokoroModelDownloaded,
};

export async function getActiveModel(): Promise<string | undefined> {
  return coreGetActiveModel();
}

export async function setActiveModel(value: string): Promise<void> {
  return coreSetActiveModel(value);
}

const PIPER_VOICES = VOICES_BY_ENGINE.piper;
export const TTS_VOICES: TtsVoice[] = Object.entries(PIPER_VOICES).map(
  ([, info]) => ({
    title: `Piper - ${info.name} (${info.accent}, ${info.gender})`,
    id: info.id,
  }),
);

export function ttsVoicesDir(): string {
  return join(environment.supportPath, "tts", "voices");
}

export function ttsVoiceOnnxPath(voiceId: string): string {
  return join(ttsVoicesDir(), `${voiceId}.onnx`);
}

export function isTtsVoiceDownloaded(voiceId: string): boolean {
  return isPiperVoiceDownloaded(voiceId, ttsVoicesDir());
}

export async function getActiveTtsVoice(): Promise<string | undefined> {
  return coreGetActiveTtsVoice();
}

export async function setActiveTtsVoice(voiceId: string): Promise<void> {
  return coreSetActiveTtsVoice(voiceId);
}

export { isKokoroVoiceDownloaded };

export async function getActiveKokoroVoice(): Promise<string | undefined> {
  return coreGetActiveKokoroVoice();
}

export async function setActiveKokoroVoice(voiceId: string): Promise<void> {
  return coreSetActiveKokoroVoice(voiceId);
}

const KOKORO_VOICES_DATA = VOICES_BY_ENGINE.kokoro;
export const KOKORO_VOICES: TtsVoice[] = Object.entries(KOKORO_VOICES_DATA).map(
  ([, info]) => ({
    title: `Kokoro - ${info.name} (${info.accent}, ${info.gender})`,
    id: info.id,
  }),
);

const SYSTEM_VOICES_DATA = VOICES_BY_ENGINE.system;
export const SYSTEM_VOICES: TtsVoice[] = Object.entries(SYSTEM_VOICES_DATA).map(
  ([, info]) => ({
    title: `${info.name} (${info.accent}, ${info.gender})`,
    id: info.id,
  }),
);

export async function getActiveSystemVoice(): Promise<string | undefined> {
  return coreGetActiveSystemVoice();
}

export async function setActiveSystemVoice(voiceId: string): Promise<void> {
  return coreSetActiveSystemVoice(voiceId);
}

export async function clearActiveSystemVoice(): Promise<void> {
  return coreClearActiveSystemVoice();
}

export async function clearActiveKokoroVoice(): Promise<void> {
  return coreClearActiveKokoroVoice();
}

export async function clearActiveTtsVoice(): Promise<void> {
  return coreClearActiveTtsVoice();
}

export function isPythonPackageInstalled(
  pythonPath: string,
  moduleName: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      pythonPath,
      ["-c", `import ${moduleName}`],
      { timeout: 10_000 },
      (error) => {
        resolve(!error);
      },
    );
  });
}

export function deleteKokoroVoice(voiceId: string): void {
  const snap = kokoroSnapshotDir();
  if (!snap) return;
  const voicePath = join(snap, "voices", `${voiceId}.pt`);
  try {
    const blobPath = readlinkSync(voicePath);
    try {
      unlinkSync(join(snap, "voices", blobPath));
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
  try {
    unlinkSync(voicePath);
  } catch {
    // ignore
  }
}

function execAsync(
  cmd: string,
  args: string[],
  timeout = 300_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function installPiperEngine(pythonPath: string): Promise<void> {
  await execAsync(pythonPath, [
    "-m",
    "pip",
    "install",
    "--break-system-packages",
    "piper-tts",
    "hf_transfer",
  ]);
}

export async function uninstallPiperEngine(pythonPath: string): Promise<void> {
  rmSync(ttsVoicesDir(), { recursive: true, force: true });
  await execAsync(
    pythonPath,
    ["-m", "pip", "uninstall", "--break-system-packages", "-y", "piper-tts"],
    60_000,
  );
}

export async function installKokoroEngine(
  pythonPath: string,
  kokoroPython: string,
): Promise<void> {
  if (!existsSync(kokoroPython)) {
    const venvDir = dirname(dirname(kokoroPython));
    await execAsync(pythonPath, ["-m", "venv", venvDir], 60_000);
  }
  await execAsync(
    kokoroPython,
    ["-m", "pip", "install", "kokoro", "soundfile", "numpy", "hf_transfer"],
    600_000,
  );
}

export async function uninstallKokoroEngine(
  kokoroPython: string,
): Promise<void> {
  rmSync(modelCacheDir(KOKORO_MODEL_ID), { recursive: true, force: true });
  if (existsSync(kokoroPython)) {
    await execAsync(
      kokoroPython,
      ["-m", "pip", "uninstall", "-y", "kokoro", "soundfile", "numpy"],
      60_000,
    );
  }
}

const DEFAULT_SYSTEM_VOICE = "Samantha";

export async function ensureDefaultTtsVoice(): Promise<void> {
  const initialized = await coreIsTtsInitialized();
  if (initialized) return;

  const system = await getActiveSystemVoice();
  const kokoro = await getActiveKokoroVoice();
  const piper = await getActiveTtsVoice();

  if (!system && !kokoro && !piper) {
    await setActiveSystemVoice(DEFAULT_SYSTEM_VOICE);
  }
  await coreSetTtsInitialized(true);
}

export { VOICES_BY_ENGINE, MODEL_ALIASES };
export type { VoiceInfo, ModelInfo };

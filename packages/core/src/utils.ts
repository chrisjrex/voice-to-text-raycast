/**
 * Utility functions for model and voice management
 */

import { existsSync, readdirSync, readlinkSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ModelInfo, VoiceInfo } from "./aliases";

export const KOKORO_MODEL_ID = "hexgrad/Kokoro-82M";

export function modelCacheDir(modelId: string): string {
  return join(
    homedir(),
    ".cache/huggingface/hub",
    `models--${modelId.replace(/\//g, "--")}`
  );
}

export function isModelDownloaded(modelId: string): boolean {
  const snapshots = join(modelCacheDir(modelId), "snapshots");
  try {
    return readdirSync(snapshots).length > 0;
  } catch {
    return false;
  }
}

export function kokoroSnapshotDir(): string | undefined {
  const snapshots = join(modelCacheDir(KOKORO_MODEL_ID), "snapshots");
  try {
    const dirs = readdirSync(snapshots);
    return dirs.length > 0 ? join(snapshots, dirs[0]) : undefined;
  } catch {
    return undefined;
  }
}

export function isKokoroModelDownloaded(): boolean {
  const snap = kokoroSnapshotDir();
  if (!snap) return false;
  return existsSync(join(snap, "kokoro-v1_0.pth"));
}

export function isKokoroVoiceDownloaded(voiceId: string): boolean {
  const snap = kokoroSnapshotDir();
  if (!snap) return false;
  return existsSync(join(snap, "voices", `${voiceId}.pt`));
}

export function isPiperVoiceDownloaded(voiceId: string, voicesDir: string): boolean {
  return (
    existsSync(join(voicesDir, `${voiceId}.onnx`)) &&
    existsSync(join(voicesDir, `${voiceId}.onnx.json`))
  );
}

export function isSystemVoiceAvailable(voiceId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const { spawn } = require("child_process");
    const proc = spawn("say", ["-v", voiceId, ""]);
    proc.on("close", (code: number) => resolve(code === 0));
    proc.on("error", () => resolve(false));
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

export function isModelDownloadedByInfo(model: ModelInfo): boolean {
  const cacheDir = join(
    homedir(),
    ".cache/huggingface/hub",
    `models--${model.id.replace(/\//g, "--")}`,
    "snapshots"
  );
  try {
    return existsSync(cacheDir) && readdirSync(cacheDir).length > 0;
  } catch {
    return false;
  }
}

export function isVoiceDownloaded(voice: VoiceInfo, config: { dataDir: string }): boolean {
  switch (voice.provider) {
    case "system":
      return true;
    case "piper":
      const piperVoicesDir = join(config.dataDir, "tts", "voices");
      return isPiperVoiceDownloaded(voice.id, piperVoicesDir);
    case "kokoro":
      return isKokoroVoiceDownloaded(voice.id);
    default:
      return false;
  }
}

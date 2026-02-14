import { LocalStorage } from "@raycast/api";
import { readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const ACTIVE_MODEL_KEY = "active_model";

export interface Model {
  title: string;
  value: string;
}

export const MODELS: Model[] = [
  { title: "Whisper Tiny (fastest, ~75MB)", value: "whisper:mlx-community/whisper-tiny" },
  { title: "Whisper Small (~500MB)", value: "whisper:mlx-community/whisper-small-mlx" },
  { title: "Whisper Large v3 Turbo (~1.6GB)", value: "whisper:mlx-community/whisper-large-v3-turbo" },
  { title: "Parakeet 110M (fast, English, ~220MB)", value: "parakeet:mlx-community/parakeet-tdt_ctc-110m" },
  { title: "Parakeet 0.6B (English, ~1.2GB)", value: "parakeet:mlx-community/parakeet-tdt-0.6b-v2" },
  { title: "Parakeet 1.1B (most accurate, English, ~2.2GB)", value: "parakeet:mlx-community/parakeet-tdt-1.1b" },
];

export function modelIdFromValue(value: string): string {
  return value.slice(value.indexOf(":") + 1);
}

export function modelCacheDir(modelId: string): string {
  return join(homedir(), ".cache/huggingface/hub", `models--${modelId.replace(/\//g, "--")}`);
}

export function isModelDownloaded(modelId: string): boolean {
  const snapshots = join(modelCacheDir(modelId), "snapshots");
  try {
    return readdirSync(snapshots).length > 0;
  } catch {
    return false;
  }
}

export async function getActiveModel(): Promise<string | undefined> {
  return await LocalStorage.getItem<string>(ACTIVE_MODEL_KEY);
}

export async function setActiveModel(value: string): Promise<void> {
  await LocalStorage.setItem(ACTIVE_MODEL_KEY, value);
}

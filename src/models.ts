import { LocalStorage, environment } from "@raycast/api";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const ACTIVE_MODEL_KEY = "active_model";
const ACTIVE_TTS_VOICE_KEY = "active_tts_voice";

export interface Model {
  title: string;
  value: string;
}

export interface TtsVoice {
  title: string;
  id: string;
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

export const TTS_VOICES: TtsVoice[] = [
  { title: "Piper - Amy (US, female, ~60MB)", id: "en_US-amy-medium" },
  { title: "Piper - Lessac (US, female, ~60MB)", id: "en_US-lessac-medium" },
  { title: "Piper - Ryan (US, male, ~60MB)", id: "en_US-ryan-medium" },
  { title: "Piper - Alba (British, female, ~60MB)", id: "en_GB-alba-medium" },
  { title: "Piper - Alan (British, male, ~60MB)", id: "en_GB-alan-medium" },
];

export function ttsVoicesDir(): string {
  return join(environment.supportPath, "tts-voices");
}

export function ttsVoiceOnnxPath(voiceId: string): string {
  return join(ttsVoicesDir(), `${voiceId}.onnx`);
}

export function isTtsVoiceDownloaded(voiceId: string): boolean {
  return existsSync(ttsVoiceOnnxPath(voiceId)) && existsSync(join(ttsVoicesDir(), `${voiceId}.onnx.json`));
}

export async function getActiveTtsVoice(): Promise<string | undefined> {
  return await LocalStorage.getItem<string>(ACTIVE_TTS_VOICE_KEY);
}

export async function setActiveTtsVoice(voiceId: string): Promise<void> {
  await LocalStorage.setItem(ACTIVE_TTS_VOICE_KEY, voiceId);
}

// --- Kokoro voices (shared model, ~300MB) ---

export const KOKORO_MODEL_ID = "hexgrad/Kokoro-82M";

export function isKokoroModelDownloaded(): boolean {
  return isModelDownloaded(KOKORO_MODEL_ID);
}

const ACTIVE_KOKORO_VOICE_KEY = "active_kokoro_voice";

export const KOKORO_VOICES: TtsVoice[] = [
  { title: "Kokoro - Heart (US, Female)", id: "af_heart" },
  { title: "Kokoro - Alloy (US, Female)", id: "af_alloy" },
  { title: "Kokoro - Bella (US, Female)", id: "af_bella" },
  { title: "Kokoro - Jessica (US, Female)", id: "af_jessica" },
  { title: "Kokoro - Nicole (US, Female)", id: "af_nicole" },
  { title: "Kokoro - Nova (US, Female)", id: "af_nova" },
  { title: "Kokoro - River (US, Female)", id: "af_river" },
  { title: "Kokoro - Sarah (US, Female)", id: "af_sarah" },
  { title: "Kokoro - Sky (US, Female)", id: "af_sky" },
  { title: "Kokoro - Adam (US, Male)", id: "am_adam" },
  { title: "Kokoro - Echo (US, Male)", id: "am_echo" },
  { title: "Kokoro - Eric (US, Male)", id: "am_eric" },
  { title: "Kokoro - Liam (US, Male)", id: "am_liam" },
  { title: "Kokoro - Michael (US, Male)", id: "am_michael" },
  { title: "Kokoro - Onyx (US, Male)", id: "am_onyx" },
  { title: "Kokoro - Alice (British, Female)", id: "bf_alice" },
  { title: "Kokoro - Emma (British, Female)", id: "bf_emma" },
  { title: "Kokoro - Lily (British, Female)", id: "bf_lily" },
  { title: "Kokoro - Daniel (British, Male)", id: "bm_daniel" },
  { title: "Kokoro - George (British, Male)", id: "bm_george" },
  { title: "Kokoro - Lewis (British, Male)", id: "bm_lewis" },
];

export async function getActiveKokoroVoice(): Promise<string | undefined> {
  return await LocalStorage.getItem<string>(ACTIVE_KOKORO_VOICE_KEY);
}

export async function setActiveKokoroVoice(voiceId: string): Promise<void> {
  await LocalStorage.setItem(ACTIVE_KOKORO_VOICE_KEY, voiceId);
}

// --- macOS system voices (built-in, no download) ---

const ACTIVE_SYSTEM_VOICE_KEY = "active_system_voice";

export const SYSTEM_VOICES: TtsVoice[] = [
  { title: "Samantha (US, Female)", id: "Samantha" },
  { title: "Alex (US, Male)", id: "Alex" },
  { title: "Daniel (British, Male)", id: "Daniel" },
  { title: "Karen (Australian, Female)", id: "Karen" },
  { title: "Moira (Irish, Female)", id: "Moira" },
  { title: "Tessa (South African, Female)", id: "Tessa" },
  { title: "Fiona (Scottish, Female)", id: "Fiona" },
  { title: "Veena (Indian, Female)", id: "Veena" },
];

export async function getActiveSystemVoice(): Promise<string | undefined> {
  return await LocalStorage.getItem<string>(ACTIVE_SYSTEM_VOICE_KEY);
}

export async function setActiveSystemVoice(voiceId: string): Promise<void> {
  await LocalStorage.setItem(ACTIVE_SYSTEM_VOICE_KEY, voiceId);
}

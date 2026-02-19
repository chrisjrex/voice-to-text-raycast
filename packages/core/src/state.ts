/**
 * State storage abstraction for voice/model preferences
 * Allows different consumers (CLI, Raycast) to provide their own storage
 */

export interface StateStorage {
  getString(key: string): Promise<string | undefined>;
  setString(key: string, value: string): Promise<void>;
  getBoolean(key: string): Promise<boolean | undefined>;
  setBoolean(key: string, value: boolean): Promise<void>;
  remove(key: string): Promise<void>;
}

export const StateKeys = {
  ACTIVE_MODEL: "active_model",
  ACTIVE_TTS_VOICE: "active_tts_voice",
  ACTIVE_KOKORO_VOICE: "active_kokoro_voice",
  ACTIVE_SYSTEM_VOICE: "active_system_voice",
  TTS_INITIALIZED: "tts_initialized",
} as const;

let currentStorage: StateStorage | null = null;

export function setStateStorage(storage: StateStorage): void {
  currentStorage = storage;
}

export function getStateStorage(): StateStorage {
  if (!currentStorage) {
    throw new Error("State storage not configured. Call setStateStorage() first.");
  }
  return currentStorage;
}

export function hasStateStorage(): boolean {
  return currentStorage !== null;
}

export async function getActiveModel(): Promise<string | undefined> {
  return getStateStorage().getString(StateKeys.ACTIVE_MODEL);
}

export async function setActiveModel(value: string): Promise<void> {
  return getStateStorage().setString(StateKeys.ACTIVE_MODEL, value);
}

export async function getActiveTtsVoice(): Promise<string | undefined> {
  return getStateStorage().getString(StateKeys.ACTIVE_TTS_VOICE);
}

export async function setActiveTtsVoice(voiceId: string): Promise<void> {
  return getStateStorage().setString(StateKeys.ACTIVE_TTS_VOICE, voiceId);
}

export async function getActiveKokoroVoice(): Promise<string | undefined> {
  return getStateStorage().getString(StateKeys.ACTIVE_KOKORO_VOICE);
}

export async function setActiveKokoroVoice(voiceId: string): Promise<void> {
  return getStateStorage().setString(StateKeys.ACTIVE_KOKORO_VOICE, voiceId);
}

export async function getActiveSystemVoice(): Promise<string | undefined> {
  return getStateStorage().getString(StateKeys.ACTIVE_SYSTEM_VOICE);
}

export async function setActiveSystemVoice(voiceId: string): Promise<void> {
  return getStateStorage().setString(StateKeys.ACTIVE_SYSTEM_VOICE, voiceId);
}

export async function clearActiveSystemVoice(): Promise<void> {
  return getStateStorage().remove(StateKeys.ACTIVE_SYSTEM_VOICE);
}

export async function clearActiveKokoroVoice(): Promise<void> {
  return getStateStorage().remove(StateKeys.ACTIVE_KOKORO_VOICE);
}

export async function clearActiveTtsVoice(): Promise<void> {
  return getStateStorage().remove(StateKeys.ACTIVE_TTS_VOICE);
}

export async function isTtsInitialized(): Promise<boolean> {
  const val = await getStateStorage().getBoolean(StateKeys.TTS_INITIALIZED);
  return val ?? false;
}

export async function setTtsInitialized(value: boolean): Promise<void> {
  return getStateStorage().setBoolean(StateKeys.TTS_INITIALIZED, value);
}

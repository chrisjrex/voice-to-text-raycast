/**
 * VTT Core Library
 * Voice-to-text and text-to-speech functionality
 */

// Aliases
export {
  VOICE_ALIASES,
  MODEL_ALIASES,
  getVoiceByAlias,
  getModelByAlias,
  listAllVoices,
  listAllModels,
  type VoiceInfo,
  type ModelInfo
} from "./aliases";

// Config
export {
  loadConfig,
  log,
  isUsingBundledRuntime,
  getRuntimeInfo,
  type Config
} from "./config";

// Audio
export {
  adjustAudioSpeed,
  playAudio,
  startRecording,
  recordAudio,
  stopCurrentPlayback,
  isPlaybackActive,
  getPlaybackPid,
  getPlaybackPidPath,
  type AudioProcessor,
  type RecordingResult,
  type RecordingOptions
} from "./audio";

// TTS
export {
  getTTSEngine,
  SystemTTSEngine,
  PiperTTSEngine,
  KokoroTTSEngine,
  type TTSEngine,
  type TTSConfig
} from "./tts";

// STT
export {
  getSTTEngine,
  WhisperEngine,
  ParakeetEngine,
  isSoxAvailable,
  type STTEngine
} from "./stt";

// Errors
export { ExitCodes, type ExitCode } from "./errors";

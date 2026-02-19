/**
 * VoiceKit Core Library
 * Voice-to-text and text-to-speech functionality
 */

// Aliases
export {
  VOICE_ALIASES,
  MODEL_ALIASES,
  VOICES_BY_ENGINE,
  getVoiceByAlias,
  getVoiceByAliasAndEngine,
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

// State
export {
  StateStorage,
  StateKeys,
  setStateStorage,
  getStateStorage,
  hasStateStorage,
  getActiveModel,
  setActiveModel,
  getActiveTtsVoice,
  setActiveTtsVoice,
  getActiveKokoroVoice,
  setActiveKokoroVoice,
  getActiveSystemVoice,
  setActiveSystemVoice,
  clearActiveSystemVoice,
  clearActiveKokoroVoice,
  clearActiveTtsVoice,
  isTtsInitialized,
  setTtsInitialized,
} from "./state";

// Errors
export { ExitCodes, type ExitCode } from "./errors";

// LaunchAgent
export {
  installLaunchAgent,
  uninstallLaunchAgent,
  startLaunchAgent,
  stopLaunchAgent,
  isLaunchAgentRunning,
  getLaunchAgentStatus,
  isLaunchAgentInstalled,
  type LaunchAgentConfig
} from "./launchagent";

// Model/Voice utilities
export {
  modelCacheDir,
  isModelDownloaded,
  isKokoroModelDownloaded,
  kokoroSnapshotDir,
  isKokoroVoiceDownloaded,
  isPiperVoiceDownloaded,
  KOKORO_MODEL_ID,
} from "./utils";

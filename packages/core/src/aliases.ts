/**
 * Voice and model aliases for simplified CLI usage
 */

export interface VoiceInfo {
  id: string;
  provider: 'piper' | 'kokoro' | 'system';
  name: string;
  accent: string;
  gender: string;
}

// Voices grouped by engine - names can be duplicated across engines
export const VOICES_BY_ENGINE: Record<string, Record<string, VoiceInfo>> = {
  system: {
    "Samantha": { id: "Samantha", provider: "system", name: "Samantha", accent: "US", gender: "Female" },
    "Alex": { id: "Alex", provider: "system", name: "Alex", accent: "US", gender: "Male" },
    "Daniel": { id: "Daniel", provider: "system", name: "Daniel", accent: "British", gender: "Male" },
    "Karen": { id: "Karen", provider: "system", name: "Karen", accent: "Australian", gender: "Female" },
    "Moira": { id: "Moira", provider: "system", name: "Moira", accent: "Irish", gender: "Female" },
    "Tessa": { id: "Tessa", provider: "system", name: "Tessa", accent: "South African", gender: "Female" },
    "Fiona": { id: "Fiona", provider: "system", name: "Fiona", accent: "Scottish", gender: "Female" },
    "Veena": { id: "Veena", provider: "system", name: "Veena", accent: "Indian", gender: "Female" },
  },
  piper: {
    "Amy": { id: "en_US-amy-medium", provider: "piper", name: "Amy", accent: "US", gender: "Female" },
    "Lessac": { id: "en_US-lessac-medium", provider: "piper", name: "Lessac", accent: "US", gender: "Female" },
    "Ryan": { id: "en_US-ryan-medium", provider: "piper", name: "Ryan", accent: "US", gender: "Male" },
    "Alba": { id: "en_GB-alba-medium", provider: "piper", name: "Alba", accent: "British", gender: "Female" },
    "Alan": { id: "en_GB-alan-medium", provider: "piper", name: "Alan", accent: "British", gender: "Male" },
  },
  kokoro: {
    // American Female
    "Heart": { id: "af_heart", provider: "kokoro", name: "Heart", accent: "US", gender: "Female" },
    "Alloy": { id: "af_alloy", provider: "kokoro", name: "Alloy", accent: "US", gender: "Female" },
    "Bella": { id: "af_bella", provider: "kokoro", name: "Bella", accent: "US", gender: "Female" },
    "Jessica": { id: "af_jessica", provider: "kokoro", name: "Jessica", accent: "US", gender: "Female" },
    "Nicole": { id: "af_nicole", provider: "kokoro", name: "Nicole", accent: "US", gender: "Female" },
    "Nova": { id: "af_nova", provider: "kokoro", name: "Nova", accent: "US", gender: "Female" },
    "River": { id: "af_river", provider: "kokoro", name: "River", accent: "US", gender: "Female" },
    "Sarah": { id: "af_sarah", provider: "kokoro", name: "Sarah", accent: "US", gender: "Female" },
    "Sky": { id: "af_sky", provider: "kokoro", name: "Sky", accent: "US", gender: "Female" },
    // American Male
    "Adam": { id: "am_adam", provider: "kokoro", name: "Adam", accent: "US", gender: "Male" },
    "Echo": { id: "am_echo", provider: "kokoro", name: "Echo", accent: "US", gender: "Male" },
    "Eric": { id: "am_eric", provider: "kokoro", name: "Eric", accent: "US", gender: "Male" },
    "Liam": { id: "am_liam", provider: "kokoro", name: "Liam", accent: "US", gender: "Male" },
    "Michael": { id: "am_michael", provider: "kokoro", name: "Michael", accent: "US", gender: "Male" },
    "Onyx": { id: "am_onyx", provider: "kokoro", name: "Onyx", accent: "US", gender: "Male" },
    // British Female
    "Alice": { id: "bf_alice", provider: "kokoro", name: "Alice", accent: "British", gender: "Female" },
    "Emma": { id: "bf_emma", provider: "kokoro", name: "Emma", accent: "British", gender: "Female" },
    "Lily": { id: "bf_lily", provider: "kokoro", name: "Lily", accent: "British", gender: "Female" },
    // British Male
    "Daniel": { id: "bm_daniel", provider: "kokoro", name: "Daniel", accent: "British", gender: "Male" },
    "George": { id: "bm_george", provider: "kokoro", name: "George", accent: "British", gender: "Male" },
    "Lewis": { id: "bm_lewis", provider: "kokoro", name: "Lewis", accent: "British", gender: "Male" },
  }
};

// Flattened list for lookup - last one wins if there are duplicates
export const VOICE_ALIASES: Record<string, VoiceInfo> = {};
for (const engine of Object.values(VOICES_BY_ENGINE)) {
  for (const [alias, info] of Object.entries(engine)) {
    VOICE_ALIASES[alias] = info;
    VOICE_ALIASES[alias.toLowerCase()] = info;
  }
}


export interface ModelInfo {
  id: string;
  provider: 'whisper' | 'parakeet';
  name: string;
  size: string;
  description: string;
}

export const MODEL_ALIASES: Record<string, ModelInfo> = {
  "whisper-tiny": { 
    id: "mlx-community/whisper-tiny", 
    provider: "whisper", 
    name: "Whisper Tiny",
    size: "~75MB",
    description: "Fastest, lower accuracy"
  },
  "whisper-small": { 
    id: "mlx-community/whisper-small-mlx", 
    provider: "whisper", 
    name: "Whisper Small",
    size: "~500MB",
    description: "Good balance"
  },
  "whisper-large": { 
    id: "mlx-community/whisper-large-v3-turbo", 
    provider: "whisper", 
    name: "Whisper Large v3 Turbo",
    size: "~1.6GB",
    description: "Best multilingual accuracy"
  },
  "parakeet-110m": { 
    id: "mlx-community/parakeet-tdt_ctc-110m", 
    provider: "parakeet", 
    name: "Parakeet 110M",
    size: "~220MB",
    description: "Fast, lightweight, English-only"
  },
  "parakeet-0.6b": { 
    id: "mlx-community/parakeet-tdt-0.6b-v2", 
    provider: "parakeet", 
    name: "Parakeet 0.6B",
    size: "~1.2GB",
    description: "Good accuracy, English-only"
  },
  "parakeet-1.1b": { 
    id: "mlx-community/parakeet-tdt-1.1b", 
    provider: "parakeet", 
    name: "Parakeet 1.1B",
    size: "~2.2GB",
    description: "Most accurate, English-only"
  },
};

export function getVoiceByAlias(alias: string): VoiceInfo | undefined {
  return VOICE_ALIASES[alias.toLowerCase()];
}

export function getVoiceByAliasAndEngine(alias: string, engine: string): VoiceInfo | undefined {
  const engineVoices = VOICES_BY_ENGINE[engine.toLowerCase()];
  if (!engineVoices) return undefined;
  const lowerAlias = alias.toLowerCase();
  for (const [key, info] of Object.entries(engineVoices)) {
    if (key.toLowerCase() === lowerAlias) {
      return info;
    }
  }
  return undefined;
}

export function getModelByAlias(alias: string): ModelInfo | undefined {
  return MODEL_ALIASES[alias];
}

export function listAllVoices(): Array<{ alias: string; info: VoiceInfo }> {
  const seen = new Set<string>();
  const voices: Array<{ alias: string; info: VoiceInfo }> = [];
  for (const [engineName, engineVoices] of Object.entries(VOICES_BY_ENGINE)) {
    for (const [alias, info] of Object.entries(engineVoices)) {
      const lowerAlias = alias.toLowerCase();
      if (seen.has(lowerAlias)) {
        continue;
      }
      seen.add(lowerAlias);
      voices.push({ alias, info });
    }
  }
  return voices;
}

export function listAllModels(): Array<{ alias: string; info: ModelInfo }> {
  return Object.entries(MODEL_ALIASES).map(([alias, info]) => ({ alias, info }));
}

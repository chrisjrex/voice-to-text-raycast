/**
 * Configuration management with environment variable support
 * Supports both bundled and system runtime
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

export interface Config {
  pythonPath: string;
  kokoroPythonPath: string;
  soxPath: string;
  dataDir: string;
  kokoroSocket: string;
  kokoroIdleTimeout: number;
  defaultSTTModel: string;
  defaultTTSEngine: string;
  defaultTTSVoice: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

const DEFAULT_CONFIG: Config = {
  pythonPath: "/opt/homebrew/bin/python3",
  kokoroPythonPath: `${homedir()}/.local/lib-kokoro/venv/bin/python3`,
  soxPath: "/opt/homebrew/bin/sox",
  dataDir: `${homedir()}/.cache/VoiceToText`,
  kokoroSocket: `/tmp/kokoro_tts_${process.getuid?.() ?? 0}.sock`,
  kokoroIdleTimeout: 120,
  defaultSTTModel: "", // No default - model must be specified or set via VTT_DEFAULT_STT_MODEL
  defaultTTSEngine: "", // No default - engine must be specified or set via VTT_DEFAULT_TTS_ENGINE
  defaultTTSVoice: "Samantha",
  logLevel: "info"
};

function resolveHomePath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get the bundled runtime path if it exists
 * Checks for bundled Python in the package assets or extracted location
 */
function getBundledPythonPath(): string | undefined {
  // Check multiple possible locations for bundled runtime
  const possiblePaths = [
    // Extracted runtime location (from standalone binary)
    join(homedir(), ".local", "share", "vtt", "runtime", "bin", "python3"),
    // From installed npm package
    join(__dirname, "../../../assets/runtime/bin/python3"),
    // From development environment
    join(__dirname, "../../cli/assets/runtime/bin/python3"),
    // Alternative path structure
    join(process.cwd(), "assets/runtime/bin/python3"),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return undefined;
}

/**
 * Get the bundled sox path if it exists
 */
function getBundledSoxPath(): string | undefined {
  const possiblePaths = [
    // Extracted runtime location (from standalone binary)
    join(homedir(), ".local", "share", "vtt", "runtime", "bin", "sox"),
    join(__dirname, "../../../assets/runtime/bin/sox"),
    join(__dirname, "../../cli/assets/runtime/bin/sox"),
    join(process.cwd(), "assets/runtime/bin/sox"),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  return undefined;
}

/**
 * Detect if we're using the bundled runtime
 */
export function isUsingBundledRuntime(): boolean {
  return !!getBundledPythonPath();
}

/**
 * Get the runtime info for display purposes
 */
export function getRuntimeInfo(): {
  type: "bundled" | "system" | "custom";
  pythonPath: string;
  soxPath: string;
} {
  // Check if using environment override (custom)
  if (process.env.VTT_PYTHON_PATH) {
    return {
      type: "custom",
      pythonPath: resolveHomePath(process.env.VTT_PYTHON_PATH),
      soxPath: process.env.VTT_SOX_PATH 
        ? resolveHomePath(process.env.VTT_SOX_PATH)
        : DEFAULT_CONFIG.soxPath,
    };
  }

  // Check for bundled runtime
  const bundledPython = getBundledPythonPath();
  if (bundledPython) {
    return {
      type: "bundled",
      pythonPath: bundledPython,
      soxPath: getBundledSoxPath() || DEFAULT_CONFIG.soxPath,
    };
  }

  // Fall back to system defaults
  return {
    type: "system",
    pythonPath: DEFAULT_CONFIG.pythonPath,
    soxPath: DEFAULT_CONFIG.soxPath,
  };
}

export function loadConfig(): Config {
  const runtimeInfo = getRuntimeInfo();
  
  // Start with runtime-detected paths
  const config: Config = {
    ...DEFAULT_CONFIG,
    pythonPath: runtimeInfo.pythonPath,
    soxPath: runtimeInfo.soxPath,
  };
  
  // Override from environment variables (always take precedence)
  if (process.env.VTT_PYTHON_PATH) {
    config.pythonPath = resolveHomePath(process.env.VTT_PYTHON_PATH);
  }
  
  if (process.env.VTT_KOKORO_PYTHON_PATH) {
    config.kokoroPythonPath = resolveHomePath(process.env.VTT_KOKORO_PYTHON_PATH);
  }
  
  if (process.env.VTT_SOX_PATH) {
    config.soxPath = resolveHomePath(process.env.VTT_SOX_PATH);
  }
  
  if (process.env.VTT_DATA_DIR) {
    config.dataDir = resolveHomePath(process.env.VTT_DATA_DIR);
  }
  
  if (process.env.VTT_KOKORO_SOCKET) {
    config.kokoroSocket = resolveHomePath(process.env.VTT_KOKORO_SOCKET);
  }
  
  if (process.env.VTT_KOKORO_IDLE_TIMEOUT) {
    config.kokoroIdleTimeout = parseIntOrDefault(process.env.VTT_KOKORO_IDLE_TIMEOUT, 120);
  }
  
  if (process.env.VTT_DEFAULT_STT_MODEL) {
    config.defaultSTTModel = process.env.VTT_DEFAULT_STT_MODEL;
  }

  if (process.env.VTT_DEFAULT_TTS_ENGINE) {
    config.defaultTTSEngine = process.env.VTT_DEFAULT_TTS_ENGINE;
  }

  if (process.env.VTT_DEFAULT_TTS_VOICE) {
    config.defaultTTSVoice = process.env.VTT_DEFAULT_TTS_VOICE;
  }
  
  if (process.env.VTT_LOG_LEVEL) {
    const level = process.env.VTT_LOG_LEVEL as Config["logLevel"];
    if (["debug", "info", "warn", "error"].includes(level)) {
      config.logLevel = level;
    }
  }
  
  // Ensure data directory exists
  if (!existsSync(config.dataDir)) {
    try {
      mkdirSync(config.dataDir, { recursive: true });
    } catch {
      // Ignore errors, will fail later if needed
    }
  }
  
  return config;
}

export function log(config: Config, level: Config["logLevel"], message: string): void {
  const levels: Config["logLevel"][] = ["debug", "info", "warn", "error"];
  const configLevelIndex = levels.indexOf(config.logLevel);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex >= configLevelIndex) {
    const prefix = `[${level.toUpperCase()}]`;
    console.error(`${prefix} ${message}`);
  }
}

/**
 * Speech-to-Text engines (Whisper and Parakeet via MLX)
 */

import { execFile, spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { promisify } from "util";
import type { Config } from "./config";
import type { ModelInfo } from "./aliases";

const execFileAsync = promisify(execFile);

export interface STTEngine {
  transcribe(audioPath: string, model: ModelInfo, config: Config): Promise<string>;
  isAvailable(config: Config): Promise<boolean>;
  isModelDownloaded(model: ModelInfo): boolean;
}

/**
 * Build Python script for transcription
 */
function buildTranscribeScript(
  provider: "whisper" | "parakeet",
  modelId: string,
  audioPath: string
): string {
  const escapedPath = audioPath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  
  if (provider === "whisper") {
    return [
      "import mlx_whisper",
      `r = mlx_whisper.transcribe("${escapedPath}", path_or_hf_repo="${modelId}")`,
      `print(r["text"], end="")`
    ].join("\n") + "\n";
  }
  
  return [
    "from parakeet_mlx import from_pretrained",
    `model = from_pretrained("${modelId}")`,
    `r = model.transcribe("${escapedPath}")`,
    `print(r.text, end="")`
  ].join("\n") + "\n";
}

/**
 * MLX Whisper STT Engine
 */
export class WhisperEngine implements STTEngine {
  async transcribe(
    audioPath: string,
    model: ModelInfo,
    config: Config
  ): Promise<string> {
    const scriptPath = `${audioPath}.py`;
    const script = buildTranscribeScript("whisper", model.id, audioPath);
    
    writeFileSync(scriptPath, script);
    
    try {
      const env = {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`
      };
      
      const { stdout } = await execFileAsync(config.pythonPath, [scriptPath], {
        timeout: 120_000,
        env
      });
      
      return stdout.trim();
    } finally {
      try {
        unlinkSync(scriptPath);
      } catch {
        // Ignore cleanup error
      }
    }
  }
  
  async isAvailable(config: Config): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(config.pythonPath, ["-c", "import mlx_whisper"], { timeout: 5000 });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }
  
  isModelDownloaded(model: ModelInfo): boolean {
    // Models are cached in ~/.cache/huggingface/hub/
    const { homedir } = require("os");
    const { join } = require("path");
    const { existsSync, readdirSync } = require("fs");
    
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
}

/**
 * Parakeet MLX STT Engine
 */
export class ParakeetEngine implements STTEngine {
  async transcribe(
    audioPath: string,
    model: ModelInfo,
    config: Config
  ): Promise<string> {
    const scriptPath = `${audioPath}.py`;
    const script = buildTranscribeScript("parakeet", model.id, audioPath);
    
    writeFileSync(scriptPath, script);
    
    try {
      const env = {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`
      };
      
      const { stdout } = await execFileAsync(config.pythonPath, [scriptPath], {
        timeout: 120_000,
        env
      });
      
      return stdout.trim();
    } finally {
      try {
        unlinkSync(scriptPath);
      } catch {
        // Ignore cleanup error
      }
    }
  }
  
  async isAvailable(config: Config): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(config.pythonPath, ["-c", "import parakeet_mlx"], { timeout: 5000 });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }
  
  isModelDownloaded(model: ModelInfo): boolean {
    // Same cache location as Whisper
    const { homedir } = require("os");
    const { join } = require("path");
    const { existsSync, readdirSync } = require("fs");
    
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
}

/**
 * Get appropriate STT engine for model
 */
export function getSTTEngine(model: ModelInfo): STTEngine {
  switch (model.provider) {
    case "whisper":
      return new WhisperEngine();
    case "parakeet":
      return new ParakeetEngine();
    default:
      throw new Error(`Unknown model provider: ${model.provider}`);
  }
}

/**
 * Check if sox is available
 */
export async function isSoxAvailable(soxPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(soxPath, ["--version"]);
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

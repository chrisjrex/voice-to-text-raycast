/**
 * Text-to-Speech engines with speed control support
 */

import { spawn } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { adjustAudioSpeed } from "./audio";
import type { VoiceInfo } from "./aliases";

export interface TTSEngine {
  speak(
    text: string, 
    voice: VoiceInfo, 
    outputPath: string, 
    config: TTSConfig,
    speed?: number
  ): Promise<void>;
  isAvailable(config: TTSConfig): Promise<boolean>;
  isVoiceDownloaded(voice: VoiceInfo, config: TTSConfig): boolean;
}

export interface TTSConfig {
  pythonPath: string;
  kokoroPythonPath: string;
  soxPath: string;
  dataDir: string;
  kokoroSocket: string;
  kokoroIdleTimeout: number;
}

/**
 * macOS System TTS using 'say' command
 * Supports native speed control via -r flag
 */
export class SystemTTSEngine implements TTSEngine {
  async speak(
    text: string,
    voice: VoiceInfo,
    outputPath: string,
    config: TTSConfig,
    speed: number = 1.0
  ): Promise<void> {
    // Default WPM is around 175, adjust based on speed
    const baseWPM = 175;
    const wpm = Math.round(baseWPM * speed);
    
    // say outputs AIFF format, use .aiff extension
    const aiffPath = outputPath.endsWith('.wav') ? outputPath.replace('.wav', '.aiff') : outputPath;
    
    return new Promise((resolve, reject) => {
      const proc = spawn("say", [
        "-v", voice.id,
        "-r", wpm.toString(),
        "-o", aiffPath,
        text
      ], {
        stdio: "ignore"
      });
      
      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`say command failed with code ${code}`));
        } else {
          // Rename AIFF to requested path if different extension
          if (outputPath !== aiffPath) {
            try {
              require("fs").renameSync(aiffPath, outputPath);
            } catch {
              // If rename fails, copy
              const fs = require("fs");
              fs.copyFileSync(aiffPath, outputPath);
              fs.unlinkSync(aiffPath);
            }
          }
          resolve();
        }
      });
      
      proc.on("error", reject);
    });
  }
  
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("which", ["say"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }
  
  isVoiceDownloaded(): boolean {
    return true; // System voices are always available
  }
}

/**
 * Piper TTS Engine
 * Uses sox tempo for speed adjustment
 */
export class PiperTTSEngine implements TTSEngine {
  async speak(
    text: string,
    voice: VoiceInfo,
    outputPath: string,
    config: TTSConfig,
    speed: number = 1.0
  ): Promise<void> {
    const ttsVoicesDir = join(config.dataDir, "tts-voices");
    const voicePath = join(ttsVoicesDir, `${voice.id}.onnx`);
    const tempPath = `${outputPath}.temp.wav`;
    
    // Generate audio with Piper
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        config.pythonPath,
        ["-m", "piper", "-m", voicePath, "-f", tempPath],
        {
          stdio: ["pipe", "ignore", "pipe"]
        }
      );
      
      proc.stdin.write(text);
      proc.stdin.end();
      
      let stderr = "";
      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
      
      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Piper exited with code ${code}`));
        } else {
          resolve();
        }
      });
      
      proc.on("error", reject);
    });
    
    // Adjust speed if needed
    if (speed !== 1.0) {
      await adjustAudioSpeed(tempPath, outputPath, speed, config.soxPath);
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup error
      }
    } else {
      // Just rename temp to output
      const buffer = readFileSync(tempPath);
      writeFileSync(outputPath, buffer);
      unlinkSync(tempPath);
    }
  }
  
  async isAvailable(config: TTSConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(config.pythonPath, ["-c", "import piper"], { timeout: 5000 });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }
  
  isVoiceDownloaded(voice: VoiceInfo, config: TTSConfig): boolean {
    const ttsVoicesDir = join(config.dataDir, "tts-voices");
    return existsSync(join(ttsVoicesDir, `${voice.id}.onnx`)) &&
           existsSync(join(ttsVoicesDir, `${voice.id}.onnx.json`));
  }
}

/**
 * Kokoro TTS Engine with server support
 */
export class KokoroTTSEngine implements TTSEngine {
  async speak(
    text: string,
    voice: VoiceInfo,
    outputPath: string,
    config: TTSConfig,
    speed: number = 1.0
  ): Promise<void> {
    // Try server first if running
    const serverRunning = await this.isServerRunning(config);
    
    if (serverRunning) {
      await this.speakWithServer(text, voice, outputPath, config);
    } else {
      await this.speakWithColdStart(text, voice, outputPath, config);
    }
    
    // Apply speed adjustment if needed
    if (speed !== 1.0) {
      const tempPath = `${outputPath}.orig.wav`;
      const buffer = readFileSync(outputPath);
      writeFileSync(tempPath, buffer);
      await adjustAudioSpeed(tempPath, outputPath, speed, config.soxPath);
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup error
      }
    }
  }
  
  private async speakWithServer(
    text: string,
    voice: VoiceInfo,
    outputPath: string,
    config: TTSConfig
  ): Promise<void> {
    const request = JSON.stringify({
      text,
      voice: voice.id,
      output: outputPath
    }) + "\n";
    
    return new Promise((resolve, reject) => {
      const conn = createConnection(config.kokoroSocket);
      let data = "";
      
      conn.on("connect", () => conn.write(request));
      
      conn.on("data", (chunk: Buffer) => {
        data += chunk.toString();
        if (data.includes("\n")) {
          conn.destroy();
          const response = data.trim();
          if (response === "ok") {
            resolve();
          } else {
            reject(new Error(response));
          }
        }
      });
      
      conn.on("error", reject);
      
      setTimeout(() => {
        conn.destroy();
        reject(new Error("Server response timeout"));
      }, 120000);
    });
  }
  
  private async speakWithColdStart(
    text: string,
    voice: VoiceInfo,
    outputPath: string,
    config: TTSConfig
  ): Promise<void> {
    const script = `
import sys, json, numpy as np, soundfile as sf
from kokoro import KPipeline
req = json.loads(sys.stdin.readline())
pipeline = KPipeline(lang_code=req["voice"][0])
chunks = [audio for _, _, audio in pipeline(req["text"], voice=req["voice"])]
sf.write(req["output"], np.concatenate(chunks), 24000)
`.trim();
    
    const input = JSON.stringify({
      text,
      voice: voice.id,
      output: outputPath
    }) + "\n";
    
    return new Promise((resolve, reject) => {
      const proc = spawn(config.kokoroPythonPath, ["-c", script], {
        stdio: ["pipe", "ignore", "pipe"]
      });
      
      proc.stdin.write(input);
      proc.stdin.end();
      
      let stderr = "";
      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
      
      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Kokoro exited with code ${code}`));
        } else {
          resolve();
        }
      });
      
      proc.on("error", reject);
    });
  }
  
  private async isServerRunning(config: TTSConfig): Promise<boolean> {
    if (!existsSync(config.kokoroSocket)) return false;
    
    return new Promise((resolve) => {
      const conn = createConnection(config.kokoroSocket);
      conn.on("connect", () => {
        conn.destroy();
        resolve(true);
      });
      conn.on("error", () => resolve(false));
      setTimeout(() => {
        conn.destroy();
        resolve(false);
      }, 500);
    });
  }
  
  async isAvailable(config: TTSConfig): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(config.kokoroPythonPath, ["-c", "import kokoro"], { timeout: 5000 });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }
  
  isVoiceDownloaded(voice: VoiceInfo, config: TTSConfig): boolean {
    const kokoroCacheDir = join(
      homedir(),
      ".cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots"
    );
    
    try {
      if (!existsSync(kokoroCacheDir)) return false;
      const dirs = readdirSync(kokoroCacheDir);
      if (dirs.length === 0) return false;
      const snapshotDir = join(kokoroCacheDir, dirs[0]);
      return existsSync(join(snapshotDir, "voices", `${voice.id}.pt`));
    } catch {
      return false;
    }
  }
}

import { createConnection } from "net";
import { homedir } from "os";
import { readdirSync, readFileSync, unlinkSync } from "fs";

/**
 * Get appropriate TTS engine for voice
 */
export function getTTSEngine(voice: VoiceInfo): TTSEngine {
  switch (voice.provider) {
    case "system":
      return new SystemTTSEngine();
    case "piper":
      return new PiperTTSEngine();
    case "kokoro":
      return new KokoroTTSEngine();
    default:
      throw new Error(`Unknown voice provider: ${voice.provider}`);
  }
}

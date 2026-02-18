/**
 * Audio processing utilities including speed adjustment, recording, and playback management
 */

import { spawn, execFile } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";
import type { Config } from "./config";

const execFileAsync = promisify(execFile);

export interface AudioProcessor {
  adjustSpeed(inputPath: string, outputPath: string, speed: number): Promise<void>;
}

export interface RecordingResult {
  stoppedBy: "silence" | "signal" | "duration" | "manual";
  durationMs: number;
}

/**
 * Adjust audio speed using sox tempo command
  * speed: 0.5-3.0 (0.5 = half speed, 3.0 = 3x speed)
 */
export async function adjustAudioSpeed(
  inputPath: string,
  outputPath: string,
  speed: number,
  soxPath: string
): Promise<void> {
  // Clamp speed to reasonable range
  const clampedSpeed = Math.max(0.5, Math.min(3.0, speed));
  
  // For speeds between 0.5-0.9 and 1.1-2.0, use tempo
  // For speed exactly 1.0, just copy
  if (clampedSpeed === 1.0) {
    // Just copy the file
    const buffer = readFileSync(inputPath);
    writeFileSync(outputPath, buffer);
    return;
  }
  
  // Use speed directly with sox tempo
  // speed > 1.0 = faster, speed < 1.0 = slower
  const tempoFactor = clampedSpeed;
  
  return new Promise((resolve, reject) => {
    const proc = spawn(soxPath, [
      inputPath,
      outputPath,
      "tempo",
      tempoFactor.toFixed(3)
    ], {
      stdio: ["ignore", "ignore", "pipe"]
    });
    
    let stderr = "";
    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });
    
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`sox tempo failed: ${stderr || `exit code ${code}`}`));
      } else {
        resolve();
      }
    });
    
    proc.on("error", reject);
  });
}

/**
 * Get playback PID file path
 */
export function getPlaybackPidPath(config: Config): string {
  return join(config.dataDir, "tts", "playback.pid");
}

/**
 * Stop any current playback
 */
export function stopCurrentPlayback(config: Config): void {
  const pidPath = getPlaybackPidPath(config);
  
  try {
    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Process might not exist
      }
      unlinkSync(pidPath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Check if playback is currently active
 */
export function isPlaybackActive(config: Config): boolean {
  const pidPath = getPlaybackPidPath(config);
  
  try {
    if (!existsSync(pidPath)) return false;
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    process.kill(pid, 0); // Check if process exists
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current playback PID (or null if not playing)
 */
export function getPlaybackPid(config: Config): number | null {
  const pidPath = getPlaybackPidPath(config);
  
  try {
    if (!existsSync(pidPath)) return null;
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    process.kill(pid, 0); // Verify process exists
    return pid;
  } catch {
    return null;
  }
}

/**
 * Play audio file using afplay
 */
export function playAudio(
  audioPath: string,
  config: Config,
  onComplete?: () => void
): { pid: number | undefined; stop: () => void } {
  // Stop any existing playback first
  stopCurrentPlayback(config);
  
  const player = spawn("afplay", [audioPath], {
    detached: true,
    stdio: "ignore"
  });
  
  // Write PID file
  if (player.pid) {
    writeFileSync(getPlaybackPidPath(config), String(player.pid));
  }
  
  player.on("exit", () => {
    try {
      unlinkSync(audioPath);
    } catch {
      // Ignore cleanup errors
    }
    // Clean up PID file
    try {
      const pidPath = getPlaybackPidPath(config);
      if (existsSync(pidPath)) {
        unlinkSync(pidPath);
      }
    } catch {
      // Ignore
    }
    onComplete?.();
  });
  
  player.unref();
  
  return {
    pid: player.pid,
    stop: () => {
      stopCurrentPlayback(config);
    }
  };
}

/**
 * Check if audio file has silence at the end
 * Returns the max amplitude of the last 1 second
 */
async function checkSilence(
  audioPath: string,
  soxPath: string
): Promise<{ isSilent: boolean; maxAmp: number }> {
  try {
    // Get file size
    const stats = statSync(audioPath);
    if (stats.size < 32000) {
      return { isSilent: false, maxAmp: 1.0 }; // Not enough data
    }
    
    // Read last 32000 bytes (2 seconds at 16kHz, 16-bit, mono)
    const { stdout } = await execFileAsync(soxPath, [
      audioPath,
      "-t", "raw",
      "-r", "16000",
      "-c", "1",
      "-b", "16",
      "-e", "signed-integer",
      "-",
      "trim", "-2", "2",  // Last 2 seconds
      "stat"
    ], { encoding: "utf-8" });
    
    const match = stdout.match(/Maximum amplitude:\s*([\d.]+)/);
    const maxAmp = match ? parseFloat(match[1]) : 1.0;
    
    return {
      isSilent: maxAmp < 0.02, // Default threshold
      maxAmp
    };
  } catch {
    return { isSilent: false, maxAmp: 1.0 };
  }
}

export interface RecordingOptions {
  silenceTimeout?: number;      // Seconds of silence before auto-stop (0 = disabled)
  silenceThreshold?: number;    // Amplitude threshold (default: 0.02)
  maxDuration?: number;         // Max recording duration in seconds (0 = unlimited)
  interactive?: boolean;        // Handle signals (default: true)
}

/**
 * Record audio using sox with optional silence detection and max duration
 */
export async function recordAudio(
  outputPath: string,
  config: Config,
  options: RecordingOptions = {}
): Promise<RecordingResult> {
  const {
    silenceTimeout = 0,
    silenceThreshold = 0.02,
    maxDuration = 0,
    interactive = true
  } = options;
  
  const startTime = Date.now();
  let stoppedBy: RecordingResult["stoppedBy"] = "manual";
  
  // Start recording process
  const recorder = spawn(
    config.soxPath,
    ["-d", "-t", "wav", "-r", "16000", "-c", "1", "-b", "16", outputPath],
    {
      detached: true,
      stdio: "ignore"
    }
  );
  
  if (!recorder.pid) {
    throw new Error("Failed to start recording process");
  }
  
  recorder.unref();
  
  let silenceCounter = 0;
  let signalReceived = false;
  
  // Setup signal handlers if interactive
  if (interactive) {
    let signalCount = 0;
    const handleSignal = () => {
      signalCount++;
      if (signalCount === 1) {
        signalReceived = true;
        stoppedBy = "signal";
      } else {
        // Second signal - force exit
        process.exit(1);
      }
    };
    
    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
  }
  
  // Monitoring loop
  const checkInterval = 1000; // Check every second
  
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      
      // Check max duration
      if (maxDuration > 0 && elapsed >= maxDuration * 1000) {
        stoppedBy = "duration";
        stopRecording();
        return;
      }
      
      // Check signal
      if (signalReceived) {
        stopRecording();
        return;
      }
      
      // Check silence if enabled
      if (silenceTimeout > 0 && existsSync(outputPath)) {
        try {
          const stats = statSync(outputPath);
          if (stats.size > 32000) { // At least 2 seconds of audio
            const { stdout } = await execFileAsync(config.soxPath, [
              outputPath,
              "-t", "raw",
              "-r", "16000",
              "-c", "1",
              "-b", "16",
              "-e", "signed-integer",
              "-",
              "trim", "-2", "2",
              "stat"
            ], { encoding: "utf-8" });
            
            const match = stdout.match(/Maximum amplitude:\s*([\d.]+)/);
            const maxAmp = match ? parseFloat(match[1]) : 1.0;
            
            if (maxAmp < silenceThreshold) {
              silenceCounter++;
              if (silenceCounter >= silenceTimeout) {
                stoppedBy = "silence";
                stopRecording();
                return;
              }
            } else {
              silenceCounter = 0;
            }
          }
        } catch {
          // Ignore errors during silence check
        }
      }
      
      // Check if recorder died unexpectedly
      if (recorder.exitCode !== null) {
        clearInterval(intervalId);
        reject(new Error("Recording process exited unexpectedly"));
      }
    }, checkInterval);
    
    function stopRecording() {
      clearInterval(intervalId);
      
      try {
        recorder.kill("SIGTERM");
      } catch {
        // Ignore
      }
      
      // Wait a bit for file to flush
      setTimeout(() => {
        resolve({
          stoppedBy,
          durationMs: Date.now() - startTime
        });
      }, 300);
    }
  });
}

/**
 * Simple recording without monitoring (for basic use)
 */
export function startRecording(
  outputPath: string,
  soxPath: string
): { pid: number | undefined; stop: () => void } {
  const recorder = spawn(
    soxPath,
    ["-d", "-t", "wav", "-r", "16000", "-c", "1", "-b", "16", outputPath],
    {
      detached: true,
      stdio: "ignore"
    }
  );
  
  recorder.unref();
  
  return {
    pid: recorder.pid,
    stop: () => {
      try {
        if (recorder.pid) {
          process.kill(recorder.pid, "SIGTERM");
        }
      } catch {
        // Ignore
      }
    }
  };
}

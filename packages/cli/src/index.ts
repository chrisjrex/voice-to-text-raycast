#!/usr/bin/env node
/**
 * VTT CLI - Voice-to-Text CLI
 * A composable Unix tool for local speech-to-text and text-to-speech
 */

import { Command } from "commander";
import { readFileSync, existsSync, statSync, unlinkSync } from "fs";
const TerminalTable = require("terminal-table");
import { loadConfig, log, getRuntimeInfo } from "../../core/dist/index.js";
import { getVoiceByAlias, listAllVoices, getModelByAlias, listAllModels } from "../../core/dist/index.js";
import { getTTSEngine, SystemTTSEngine } from "../../core/dist/index.js";
import { getSTTEngine, isSoxAvailable } from "../../core/dist/index.js";
import { 
  playAudio, 
  recordAudio, 
  stopCurrentPlayback,
  isPlaybackActive,
  getPlaybackPid,
  type RecordingResult,
  ExitCodes
} from "../../core/dist/index.js";
import { join } from "path";

const program = new Command();

// Helper to get pip install args based on whether we're in a venv
function getPipInstallArgs(pythonPath: string): string[] {
  // Check if running in a virtual environment
  const inVenv = pythonPath.includes("venv") || pythonPath.includes(".local");
  
  if (inVenv) {
    // In venv - don't use --user or --break-system-packages
    return ["-m", "pip", "install"];
  } else {
    // System Python - need --user and --break-system-packages
    return ["-m", "pip", "install", "--user", "--break-system-packages"];
  }
}

program
  .name("vtt")
  .description("Voice-to-Text CLI - Local STT and TTS\n\nRun 'vtt help-all' for comprehensive documentation")
  .version("1.0.0");

// Speak command with speed control
program
  .command("speak [text]")
  .description("Convert text to speech")
  .option("-f, --file <path>", "Read text from file")
  .option("-v, --voice <name>", "Voice alias (e.g., Heart, Amy, Samantha)", process.env.VTT_DEFAULT_TTS_VOICE || "Samantha")
  .option("-s, --speed <factor>", "Playback speed factor (0.5-2.0)", "1.0")
  .option("-o, --output <path>", "Save to file instead of playing")
  .option("-q, --quiet", "Suppress non-error output")
  .action(async (text: string | undefined, options) => {
    const config = loadConfig();
    const quiet = options.quiet || false;
    
    // Get text from various sources
    let textToSpeak: string;
    if (options.file) {
      try {
        textToSpeak = readFileSync(options.file, "utf-8");
      } catch (error) {
        console.error(`Error reading file: ${error}`);
        process.exit(1);
      }
    } else if (text) {
      textToSpeak = text;
    } else if (!process.stdin.isTTY) {
      // Read from pipe/stdin
      const chunks: Buffer[] = [];
      process.stdin.on("data", (chunk) => chunks.push(chunk));
      await new Promise((resolve) => process.stdin.on("end", resolve));
      textToSpeak = Buffer.concat(chunks).toString("utf-8").trim();
      
      if (!textToSpeak) {
        console.error("Error: No text provided. Use --file, provide text as argument, or pipe via stdin.");
        process.exit(1);
      }
    } else {
      console.error("Error: No text provided. Use --file, provide text as argument, or pipe via stdin.");
      console.error("Examples:");
      console.error('  vtt speak "Hello world"');
      console.error('  vtt speak -f file.txt');
      console.error('  echo "Hello" | vtt speak');
      process.exit(1);
    }
    
    // Parse speed
    const speed = parseFloat(options.speed);
    if (isNaN(speed) || speed < 0.5 || speed > 2.0) {
      console.error("Error: Speed must be between 0.5 and 2.0");
      process.exit(1);
    }
    
    // Resolve voice
    const voice = getVoiceByAlias(options.voice);
    if (!voice) {
      console.error(`Error: Unknown voice "${options.voice}"`);
      console.error(`Run 'vtt voices list' to see available voices.`);
      process.exit(ExitCodes.UNKNOWN_VOICE);
    }
    
    if (!quiet) {
      log(config, "info", `Speaking with voice: ${options.voice} (${voice.provider})`);
      log(config, "info", `Speed: ${speed}x`);
    }
    
    try {
      const engine = getTTSEngine(voice);
      
      // Check if voice is available
      if (voice.provider !== "system") {
        const isDownloaded = engine.isVoiceDownloaded(voice, config);
        if (!isDownloaded) {
          console.error(`Error: Voice "${options.voice}" (${voice.provider}) not downloaded.`);
          console.error(`Run: vtt voices download ${options.voice}`);
          process.exit(3);
        }
      }
      
      // Generate audio
      const outputPath = options.output || join(config.dataDir, `tts-${Date.now()}.wav`);
      
      if (voice.provider === "system") {
        // System voices use native speed control
        await (engine as SystemTTSEngine).speak(textToSpeak, voice, outputPath, config, speed);
      } else {
        // Piper and Kokoro use audio post-processing for speed
        await engine.speak(textToSpeak, voice, outputPath, config, speed);
      }
      
      if (options.output) {
        if (!quiet) {
          console.log(`Saved to: ${outputPath}`);
        }
      } else {
        // Play the audio (auto-stops any existing playback)
        if (!quiet) {
          log(config, "info", "Playing audio...");
        }
        const playback = playAudio(outputPath, config, () => {
          process.exit(0);
        });
        
        // Handle Ctrl+C
        process.on("SIGINT", () => {
          playback.stop();
          process.exit(0);
        });
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Playback command
const playbackCmd = program
  .command("playback")
  .description("Control audio playback");

playbackCmd
  .command("stop")
  .description("Stop current playback")
  .action(() => {
    const config = loadConfig();
    stopCurrentPlayback(config);
    process.exit(0);
  });

playbackCmd
  .command("status")
  .description("Check playback status (JSON output)")
  .action(() => {
    const config = loadConfig();
    const active = isPlaybackActive(config);
    const pid = getPlaybackPid(config);
    
    const status = {
      playing: active,
      pid: pid,
      timestamp: new Date().toISOString()
    };
    
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  });

playbackCmd
  .command("pid")
  .description("Get current playback PID (empty if not playing)")
  .action(() => {
    const config = loadConfig();
    const pid = getPlaybackPid(config);
    console.log(pid || "");
    process.exit(0);
  });

// Voices command
const voicesCmd = program
  .command("voices")
  .description("Manage TTS voices");

voicesCmd
  .command("list")
  .description("List all available voices")
  .action(async () => {
    const config = loadConfig();
    const voices = listAllVoices();
    
    // Group by provider
    const grouped = voices.reduce((acc, { alias, info }) => {
      if (!acc[info.provider]) acc[info.provider] = [];
      acc[info.provider].push({ alias, info });
      return acc;
    }, {} as Record<string, typeof voices>);
    
    const tableOpts = {
      borderStyle: 1,
      horizontalLine: true,
      leftPadding: 2,
      rightPadding: 2
    };
    
    // Print all voices in a single table
    const table = new TerminalTable(tableOpts);
    table.push(["Name", "Provider", "Status", "Accent", "Gender"]);
    
    // Print system voices first (always available)
    if (grouped["system"]) {
      for (const { alias, info } of grouped["system"]) {
        table.push([alias, "System", "Built-in", info.accent, info.gender]);
      }
    }
    
    // Print Piper voices
    if (grouped["piper"]) {
      for (const { alias, info } of grouped["piper"]) {
        const engine = getTTSEngine(info);
        const status = engine.isVoiceDownloaded(info, config) ? "✓ Downloaded" : "Not installed";
        table.push([alias, "Piper", status, info.accent, info.gender]);
      }
    }
    
    // Print Kokoro voices
    if (grouped["kokoro"]) {
      for (const { alias, info } of grouped["kokoro"]) {
        const engine = getTTSEngine(info);
        const status = engine.isVoiceDownloaded(info, config) ? "✓ Downloaded" : "Not installed";
        table.push([alias, "Kokoro", status, info.accent, info.gender]);
      }
    }
    
    console.log(table.toString());
  });

voicesCmd
  .command("download <voice>")
  .description("Download a voice by alias")
  .action(async (voiceAlias: string) => {
    const config = loadConfig();
    const voice = getVoiceByAlias(voiceAlias);
    const { homedir } = require("os");
    const { join } = require("path");
    const { existsSync, mkdirSync } = require("fs");
    
    if (!voice) {
      console.error(`Error: Unknown voice "${voiceAlias}"`);
      console.error(`Run 'vtt voices list' to see available voices.`);
      process.exit(ExitCodes.UNKNOWN_VOICE);
    }
    
    if (voice.provider === "system") {
      console.log(`Voice "${voiceAlias}" is a system voice and doesn't require downloading.`);
      return;
    }
    
    // Install required Python package if not already installed
    const requiredPackage = voice.provider === "piper" ? "piper-tts" : "kokoro";
    console.log(`Installing ${requiredPackage}...`);
    
    const { spawn } = require("child_process");
    const pipArgs = getPipInstallArgs(config.pythonPath);
    
    await new Promise<void>((resolve, reject) => {
      const installProc = spawn(config.pythonPath, [...pipArgs, requiredPackage], {
        stdio: "inherit"
      });
      
      installProc.on("close", (code: number) => {
        if (code !== 0) {
          reject(new Error(`Failed to install ${requiredPackage}`));
        } else {
          console.log(`✓ Installed ${requiredPackage}\n`);
          resolve();
        }
      });
      
      installProc.on("error", reject);
    }).catch((error) => {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
    
    console.log(`Downloading ${voiceAlias} (${voice.provider})...`);
    
    if (voice.provider === "piper") {
      // Download Piper voice files
      const ttsVoicesDir = join(config.dataDir, "tts-voices");
      if (!existsSync(ttsVoicesDir)) {
        mkdirSync(ttsVoicesDir, { recursive: true });
      }
      
      const voiceFileName = `${voice.id}.onnx`;
      const voicePath = join(ttsVoicesDir, voiceFileName);
      
      if (existsSync(voicePath)) {
        console.log(`Voice "${voiceAlias}" is already downloaded.`);
        return;
      }
      
      // Download from HuggingFace
      const script = `
from huggingface_hub import hf_hub_download
path = hf_hub_download(repo_id="rhasspy/pipervoices", filename="${voiceFileName}", repo_type="model")
print(path)
`;
      
      await new Promise<string>((resolve, reject) => {
        const proc = spawn(config.pythonPath, ["-c", script], { stdio: "pipe" });
        let output = "";
        
        proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
        proc.stderr.on("data", (data: Buffer) => { console.error(data.toString()); });
        
        proc.on("close", (code: number) => {
          if (code !== 0) {
            reject(new Error(`Download failed with code ${code}`));
          } else {
            resolve(output.trim());
          }
        });
        proc.on("error", reject);
      }).then((downloadedPath) => {
        const { copyFileSync } = require("fs");
        copyFileSync(downloadedPath, voicePath);
        console.log(`\n✓ Downloaded ${voiceAlias}`);
      }).catch((error) => {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      });
      
    } else if (voice.provider === "kokoro") {
      // Kokoro voices are downloaded as part of the package, just need to ensure it's set up
      console.log(`\n✓ Voice "${voiceAlias}" is ready (Kokoro package handles voice files)`);
    }
  });

voicesCmd
  .command("delete <voice>")
  .description("Delete a downloaded voice")
  .action(async (voiceAlias: string) => {
    const voice = getVoiceByAlias(voiceAlias);
    
    if (!voice) {
      console.error(`Error: Unknown voice "${voiceAlias}"`);
      console.error(`Run 'vtt voices list' to see available voices.`);
      process.exit(ExitCodes.UNKNOWN_VOICE);
    }
    
    if (voice.provider === "system") {
      console.error("System voices cannot be deleted.");
      process.exit(1);
    }
    
    console.log(`Deleting ${voiceAlias}...`);
    // TODO: Implement delete logic
    console.log("Delete functionality not yet implemented.");
  });

voicesCmd
  .command("preview <voice>")
  .description("Preview a voice")
  .option("-s, --speed <factor>", "Playback speed factor (0.5-2.0)", "1.0")
  .action(async (voiceAlias: string, options) => {
    const config = loadConfig();
    const voice = getVoiceByAlias(voiceAlias);
    
    if (!voice) {
      console.error(`Error: Unknown voice "${voiceAlias}"`);
      console.error(`Run 'vtt voices list' to see available voices.`);
      process.exit(ExitCodes.UNKNOWN_VOICE);
    }
    
    const speed = parseFloat(options.speed);
    if (isNaN(speed) || speed < 0.5 || speed > 2.0) {
      console.error("Error: Speed must be between 0.5 and 2.0");
      process.exit(1);
    }
    
    // Check if downloaded (skip for system)
    if (voice.provider !== "system") {
      const engine = getTTSEngine(voice);
      if (!engine.isVoiceDownloaded(voice, config)) {
        console.error(`Error: Voice "${voiceAlias}" (${voice.provider}) not downloaded.`);
        console.error(`Run: vtt voices download ${voiceAlias}`);
        process.exit(3);
      }
    }
    
    const previewText = "Hello! This is a preview of my voice.";
    const outputPath = join(config.dataDir, `preview-${voiceAlias}-${Date.now()}.wav`);
    
    try {
      const engine = getTTSEngine(voice);
      
      if (voice.provider === "system") {
        await (engine as SystemTTSEngine).speak(previewText, voice, outputPath, config, speed);
      } else {
        await engine.speak(previewText, voice, outputPath, config, speed);
      }
      
      log(config, "info", "Playing preview...");
      const playback = playAudio(outputPath, config, () => {
        process.exit(0);
      });
      
      // Handle Ctrl+C
      process.on("SIGINT", () => {
        playback.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error(`Error generating preview: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Transcribe command with new options
const transcribeCmd = program
  .command("transcribe")
  .description("Record and transcribe speech to text")
  .action(async () => {
    console.log(`Usage: vtt transcribe [command]

Record and transcribe speech to text

Commands:
  start           Start background transcription (daemon mode)
  stop            Stop background transcription
  status          Check background transcription status
  record          Record and transcribe (single session)

Examples:
  # Start background recording (runs until stopped):
  vtt transcribe start

  # Start with options:
  vtt transcribe start --silence-timeout 15 -o result.json

  # Stop background recording and transcribe:
  vtt transcribe stop

  # Check if daemon is running:
  vtt transcribe status

  # Single session transcription:
  vtt transcribe record

Run 'vtt transcribe <command> --help' for more information on a command.`);
  });

transcribeCmd
  .command("start")
  .description("Start background transcription (daemon mode)")
  .option("-m, --model <alias>", "Model alias (e.g., whisper-tiny, parakeet-110m)")
  .option("--silence-timeout <sec>", "Auto-stop after N seconds of silence (0 = disabled)", "0")
  .option("--silence-threshold <amp>", "Amplitude threshold for silence detection", "0.02")
  .option("--max-duration <sec>", "Maximum recording duration (0 = unlimited)", "0")
  .option("-o, --output <path>", "Output file for transcription result")
  .action(async (options) => {
    const config = loadConfig();
    const outputPath = options.output || join(config.dataDir, "transcription.json");
    const { spawn } = require("child_process");
    const { writeFileSync, existsSync, readFileSync } = require("fs");
    
    // Check if model is provided or if VTT_DEFAULT_STT_MODEL is set
    let modelAlias = options.model || config.defaultSTTModel || process.env.VTT_DEFAULT_STT_MODEL;
    if (!modelAlias) {
      console.error("Error: No model specified.");
      console.error("Either:");
      console.error("  1. Use -m/--model flag: vtt transcribe start -m whisper-tiny");
      console.error("  2. Set VTT_DEFAULT_STT_MODEL environment variable");
      console.error("");
      console.error("Available models:");
      console.error("  vtt models list");
      process.exit(1);
    }
    
    // Check if already running
    const pidPath = join(config.dataDir, "transcribe_daemon.pid");
    if (existsSync(pidPath)) {
      try {
        const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
        process.kill(pid, 0);
        console.error("Error: Transcription daemon is already running");
        process.exit(1);
      } catch {
        // Process not running, clean up
        try { require("fs").unlinkSync(pidPath); } catch {}
      }
    }
    
    const model = getModelByAlias(modelAlias);
    if (!model) {
      console.error(`Error: Unknown model "${modelAlias}"`);
      process.exit(ExitCodes.UNKNOWN_MODEL);
    }
    
    console.log(`Starting transcription daemon with model: ${modelAlias}`);
    
    // Create daemon script
    const daemonScript = `
import os, sys, json, signal, time
import subprocess

PID_PATH = ${JSON.stringify(pidPath)}
OUTPUT_PATH = ${JSON.stringify(outputPath)}
SOX_PATH = ${JSON.stringify(config.soxPath)}
VTT_CLI_PATH = ${JSON.stringify(join(__dirname, ".."))}

# Recording settings
SILENCE_TIMEOUT = ${parseInt(options.silenceTimeout) || 0}
SILENCE_THRESHOLD = ${parseFloat(options.silenceThreshold) || 0.02}
MAX_DURATION = ${parseInt(options.maxDuration) || 0}

# Cleanup handler
def cleanup(*args):
    sys.exit(0)

signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

# Write PID
with open(PID_PATH, "w") as f:
    f.write(str(os.getpid()))

# Start recording
audio_path = os.path.join(${JSON.stringify(config.dataDir)}, f"recording_{os.getpid()}.wav")
print(f"Recording to: {audio_path}", flush=True)

# Build sox command
cmd = [SOX_PATH, "-d", "-t", "wav", "-r", "16000", "-c", "1", "-b", "16", audio_path]

# Run sox
proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
start_time = time.time()
silence_start = None

def stop_recording():
    proc.terminate()
    try:
        proc.wait(timeout=2)
    except subprocess.TimeoutExpired:
        proc.kill()

while proc.poll() is None:
    time.sleep(0.5)
    
    # Check max duration
    if MAX_DURATION > 0 and time.time() - start_time >= MAX_DURATION:
        print("Max duration reached", flush=True)
        stop_recording()
        break
    
    # Check silence
    if SILENCE_TIMEOUT > 0 and os.path.exists(audio_path) and os.path.getsize(audio_path) > 32000:
        try:
            result = subprocess.run(
                [SOX_PATH, audio_path, "-t", "raw", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed-integer", "-", "trim", "-2", "2", "stat"],
                capture_output=True, text=True, timeout=5
            )
            match = result.stdout.match(r"Maximum amplitude:\\s*([\\d.]+)")
            max_amp = float(match.group(1)) if match else 1.0
            
            if max_amp < SILENCE_THRESHOLD:
                if silence_start is None:
                    silence_start = time.time()
                elif time.time() - silence_start >= SILENCE_TIMEOUT:
                    print("Silence timeout reached", flush=True)
                    stop_recording()
                    break
            else:
                silence_start = None
        except:
            pass

# Now transcribe using vtt CLI
print("Transcribing...", flush=True)

transcribe_proc = subprocess.run(
    [sys.executable, "-m", "vtt", "transcribe", "record", "-i", audio_path, "-o", OUTPUT_PATH, "-f", "json"],
    capture_output=True, text=True, timeout=300
)

# Write result
if transcribe_proc.returncode == 0:
    try:
        result = json.loads(transcribe_proc.stdout.strip())
        with open(OUTPUT_PATH, "w") as f:
            json.dump(result, f)
        print(f"Transcription saved to: {OUTPUT_PATH}")
    except:
        print("Failed to parse transcription result")
else:
    print(f"Transcription failed: {transcribe_proc.stderr}")

# Cleanup
try:
    os.unlink(audio_path)
except:
    pass
try:
    os.unlink(PID_PATH)
except:
    pass
`.trim();

    const daemonPath = join(config.dataDir, "transcribe_daemon.py");
    writeFileSync(daemonPath, daemonScript);
    
    // Start daemon
    const { openSync } = require("fs");
    const logFd = openSync(join(config.dataDir, "transcribe_daemon.log"), "a");
    
    const daemonProc = spawn(config.pythonPath, [daemonPath], {
      detached: true,
      stdio: ["ignore", logFd, logFd]
    });
    
    daemonProc.unref();
    
    // Wait a moment to verify it started
    await new Promise(r => setTimeout(r, 1000));
    
    if (existsSync(pidPath)) {
      console.log(`✓ Transcription daemon started (PID: ${readFileSync(pidPath, "utf-8").trim()})`);
      console.log(`Output will be saved to: ${outputPath}`);
    } else {
      console.error("Failed to start daemon");
      process.exit(1);
    }
  });

transcribeCmd
  .command("stop")
  .description("Stop background transcription and transcribe audio")
  .action(async () => {
    const config = loadConfig();
    const pidPath = join(config.dataDir, "transcribe_daemon.pid");
    
    if (!existsSync(pidPath)) {
      console.error("No transcription daemon is running");
      process.exit(1);
    }
    
    try {
      const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      process.kill(pid, "SIGTERM");
      console.log("✓ Sent stop signal to transcription daemon");
    } catch (error) {
      console.error(`Error stopping daemon: ${error instanceof Error ? error.message : String(error)}`);
      try { unlinkSync(pidPath); } catch {}
    }
  });

transcribeCmd
  .command("status")
  .description("Check background transcription status")
  .action(async () => {
    const config = loadConfig();
    const pidPath = join(config.dataDir, "transcribe_daemon.pid");
    const outputPath = join(config.dataDir, "transcription.json");
    
    let isRunning = false;
    let pid: number | null = null;
    
    if (existsSync(pidPath)) {
      try {
        pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
        process.kill(pid, 0);
        isRunning = true;
      } catch {
        // Process not running
        try { unlinkSync(pidPath); } catch {}
      }
    }
    
    const status = {
      running: isRunning,
      pid: pid,
      output_exists: existsSync(outputPath),
      timestamp: new Date().toISOString()
    };
    
    console.log(JSON.stringify(status, null, 2));
  });

// Main transcribe command (original behavior)
transcribeCmd
  .command("record")
  .description("Record and transcribe (single session)")
  .option("-m, --model <alias>", "Model alias (e.g., whisper-tiny, parakeet-110m)")
  .option("-o, --output <path>", "Save transcription to file (instead of stdout)")
  .option("-f, --format <type>", "Output format: json, text, raw (default: json)", "json")
  .option("-i, --input <path>", "Transcribe existing audio file instead of recording")
  .option("--silence-timeout <sec>", "Auto-stop after N seconds of silence (0 = disabled)", "0")
  .option("--silence-threshold <amp>", "Amplitude threshold for silence detection", "0.02")
  .option("--max-duration <sec>", "Maximum recording duration (0 = unlimited)", "0")
  .option("-q, --quiet", "Suppress non-error output (same as --format raw)")
  .action(async (options) => {
    const config = loadConfig();
    const quiet = options.quiet || false;
    
    // Check if model is provided or if VTT_DEFAULT_STT_MODEL is set
    let modelAlias = options.model || config.defaultSTTModel || process.env.VTT_DEFAULT_STT_MODEL;
    if (!modelAlias) {
      console.error("Error: No model specified.");
      console.error("Either:");
      console.error("  1. Use -m/--model flag: vtt transcribe -m whisper-tiny");
      console.error("  2. Set VTT_DEFAULT_STT_MODEL environment variable");
      console.error("");
      console.error("Available models:");
      console.error("  vtt models list");
      process.exit(1);
    }
    
    // Resolve model
    const model = getModelByAlias(modelAlias);
    if (!model) {
      console.error(`Error: Unknown model "${modelAlias}"`);
      console.error(`Run 'vtt models list' to see available models.`);
      process.exit(ExitCodes.UNKNOWN_MODEL);
    }
    
    if (!quiet) {
      log(config, "info", `Using model: ${modelAlias} (${model.provider})`);
    }
    
    // Check dependencies
    const soxAvailable = await isSoxAvailable(config.soxPath);
    if (!soxAvailable) {
      console.error(`Error: sox not found at ${config.soxPath}`);
      console.error("Install with: brew install sox");
      process.exit(2);
    }
    
    const engine = getSTTEngine(model);
    let engineAvailable = await engine.isAvailable(config);
    
    // If engine not available, try to install it
    if (!engineAvailable) {
      const pkgName = model.provider === "whisper" ? "mlx-whisper" : "parakeet-mlx";
      console.log(`Installing ${pkgName}...`);
      
      const { spawn } = require("child_process");
      const pipArgs = getPipInstallArgs(config.pythonPath);
      
      await new Promise<void>((resolve, reject) => {
        const installProc = spawn(config.pythonPath, [...pipArgs, pkgName], {
          stdio: "inherit"
        });
        
        installProc.on("close", (code: number) => {
          if (code !== 0) {
            reject(new Error(`Failed to install ${pkgName}`));
          } else {
            console.log(`✓ Installed ${pkgName}\n`);
            resolve();
          }
        });
        
        installProc.on("error", reject);
      }).catch((error) => {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      });
      
      // Check again after install
      engineAvailable = await engine.isAvailable(config);
      if (!engineAvailable) {
        console.error(`Error: ${pkgName} still not available after installation.`);
        process.exit(2);
      }
    }
    
    // Check if model is downloaded
    if (!engine.isModelDownloaded(model)) {
      console.error(`Error: Model "${options.model}" not downloaded.`);
      console.error(`Run: vtt models download ${options.model}`);
      process.exit(3);
    }
    
    let audioPath: string;
    let recordingResult: RecordingResult | undefined;
    
    if (options.input) {
      // Use existing audio file
      if (!existsSync(options.input)) {
        console.error(`Error: Audio file not found: ${options.input}`);
        process.exit(1);
      }
      audioPath = options.input;
      if (!quiet) {
        log(config, "info", `Transcribing: ${audioPath}`);
      }
    } else {
      // Record audio
      audioPath = join(config.dataDir, `recording-${Date.now()}.wav`);
      
      const silenceTimeout = parseInt(options.silenceTimeout, 10) || 0;
      const silenceThreshold = parseFloat(options.silenceThreshold) || 0.02;
      const maxDuration = parseInt(options.maxDuration, 10) || 0;
      
      if (!quiet) {
        if (silenceTimeout > 0) {
          log(config, "info", `Recording... Auto-stop after ${silenceTimeout}s of silence.`);
        } else {
          log(config, "info", "Recording... Press Ctrl+C to stop.");
        }
      }
      
      try {
        recordingResult = await recordAudio(audioPath, config, {
          silenceTimeout: silenceTimeout > 0 ? silenceTimeout : 0,
          silenceThreshold,
          maxDuration: maxDuration > 0 ? maxDuration : 0,
          interactive: true
        });
        
        if (!quiet) {
          log(config, "info", `Recording stopped (${recordingResult.stoppedBy})`);
        }
      } catch (error) {
        console.error(`Error recording: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
      
      // Check recording
      if (!existsSync(audioPath)) {
        console.error("Error: No audio file created");
        process.exit(1);
      }
      
      const fileSize = statSync(audioPath).size;
      if (fileSize < 1000) {
        unlinkSync(audioPath);
        console.error("Error: Recording too short");
        process.exit(1);
      }
      
      if (!quiet) {
        log(config, "info", "Transcribing...");
      }
    }
    
    try {
      const transcribeStart = Date.now();
      const text = await engine.transcribe(audioPath, model, config);
      const transcriptionMs = Date.now() - transcribeStart;
      
      // Clean up temporary recording
      if (!options.input) {
        try {
          unlinkSync(audioPath);
        } catch {
          // Ignore cleanup error
        }
      }
      
      if (!text) {
        if (!quiet) {
          console.error("Error: No speech detected");
        }
        process.exit(1);
      }
      
      // Build result
      const result = {
        text,
        stopped_by: recordingResult?.stoppedBy || "manual",
        duration_ms: recordingResult?.durationMs || 0,
        transcription_ms: transcriptionMs,
        model: options.model
      };
      
      // Determine output format
      let format = options.format || "json";
      if (options.quiet) {
        format = "raw";  // --quiet implies raw format
      }
      
      // Validate format
      if (!["json", "text", "raw"].includes(format)) {
        console.error(`Error: Unknown format "${format}". Use: json, text, or raw`);
        process.exit(1);
      }
      
      // Output handling
      let outputContent: string;
      switch (format) {
        case "json":
          outputContent = JSON.stringify(result, null, 2);
          break;
        case "text":
          outputContent = text + "\n";
          break;
        case "raw":
        default:
          outputContent = text;
          break;
      }
      
      if (options.output) {
        const fs = require("fs");
        fs.writeFileSync(options.output, outputContent);
        if (format === "json") {
          console.log(`Saved to: ${options.output}`);
        }
      } else {
        // Output to stdout
        if (format === "json" || format === "text") {
          console.log(outputContent);
        } else {
          // Raw format - use process.stdout.write to avoid extra newline
          process.stdout.write(outputContent);
        }
      }
      
      process.exit(0);
    } catch (error) {
      // Clean up on error
      if (!options.input) {
        try {
          unlinkSync(audioPath);
        } catch {
          // Ignore cleanup error
        }
      }
      
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Models command
const modelsCmd = program
  .command("models")
  .description("Manage STT models");

modelsCmd
  .command("list")
  .description("List all available models")
  .action(async () => {
    const models = listAllModels();
    
    const tableOpts = {
      borderStyle: 1,
      horizontalLine: true,
      leftPadding: 2,
      rightPadding: 2
    };
    
    const table = new TerminalTable(tableOpts);
    table.push(["Alias", "Provider", "Status", "Size", "Description"]);
    
    for (const { alias, info } of models) {
      const engine = getSTTEngine(info);
      const status = engine.isModelDownloaded(info) ? "✓ Downloaded" : "Not installed";
      table.push([alias, info.provider, status, info.size, info.description]);
    }
    
    console.log(table.toString());
  });

modelsCmd
  .command("download <model>")
  .description("Download a model by alias")
  .action(async (modelAlias: string) => {
    const config = loadConfig();
    const model = getModelByAlias(modelAlias);
    
    if (!model) {
      console.error(`Error: Unknown model "${modelAlias}"`);
      console.error(`Run 'vtt models list' to see available models.`);
      process.exit(ExitCodes.UNKNOWN_MODEL);
    }
    
    // Check if already downloaded
    const engine = getSTTEngine(model);
    if (engine.isModelDownloaded(model)) {
      console.log(`Model "${modelAlias}" is already downloaded.`);
      return;
    }
    
    // Install required Python package if not already installed
    const requiredPackage = model.provider === "whisper" ? "mlx-whisper" : "parakeet-mlx";
    console.log(`Installing ${requiredPackage}...`);
    
    const { spawn } = require("child_process");
    const pipArgs = getPipInstallArgs(config.pythonPath);
    
    await new Promise<void>((resolve, reject) => {
      const installProc = spawn(config.pythonPath, [...pipArgs, requiredPackage], {
        stdio: "inherit"
      });
      
      installProc.on("close", (code: number) => {
        if (code !== 0) {
          reject(new Error(`Failed to install ${requiredPackage}`));
        } else {
          console.log(`✓ Installed ${requiredPackage}\n`);
          resolve();
        }
      });
      
      installProc.on("error", reject);
    }).catch((error) => {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
    
    console.log(`Downloading ${modelAlias} (${model.id})...`);
    console.log(`Size: ${model.size}`);
    console.log("This may take several minutes...");
    
    const script = `from huggingface_hub import snapshot_download; snapshot_download("${model.id}")`;
    
    return new Promise<void>((resolve, reject) => {
      const proc = spawn(config.pythonPath, ["-c", script], {
        stdio: "inherit",
        timeout: 600_000
      });
      
      proc.on("close", (code: number) => {
        if (code !== 0) {
          reject(new Error(`Download failed with code ${code}`));
        } else {
          console.log(`\n✓ Downloaded ${modelAlias}`);
          resolve();
        }
      });
      
      proc.on("error", reject);
    }).catch((error) => {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
  });

modelsCmd
  .command("delete <model>")
  .description("Delete a downloaded model")
  .action(async (modelAlias: string) => {
    const model = getModelByAlias(modelAlias);
    
    if (!model) {
      console.error(`Error: Unknown model "${modelAlias}"`);
      console.error(`Run 'vtt models list' to see available models.`);
      process.exit(ExitCodes.UNKNOWN_MODEL);
    }
    
    const engine = getSTTEngine(model);
    if (!engine.isModelDownloaded(model)) {
      console.log(`Model "${modelAlias}" is not downloaded.`);
      return;
    }
    
    const { homedir } = require("os");
    const { join } = require("path");
    const { rmSync } = require("fs");
    
    const cacheDir = join(
      homedir(),
      ".cache/huggingface/hub",
      `models--${model.id.replace(/\//g, "--")}`
    );
    
    try {
      rmSync(cacheDir, { recursive: true, force: true });
      console.log(`Deleted ${modelAlias}`);
    } catch (error) {
      console.error(`Error deleting model: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Server command for Kokoro
const serverCmd = program
  .command("server")
  .description("Manage Kokoro TTS server");

serverCmd
  .command("start")
  .description("Start the Kokoro TTS server")
  .option("-t, --timeout <seconds>", "Idle timeout in seconds", process.env.VTT_KOKORO_IDLE_TIMEOUT || "120")
  .action(async (options) => {
    const config = loadConfig();
    const timeout = parseInt(options.timeout, 10);
    
    // Check if already running
    const { createConnection } = require("net");
    const isRunning = await new Promise<boolean>((resolve) => {
      if (!existsSync(config.kokoroSocket)) {
        resolve(false);
        return;
      }
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
    
    if (isRunning) {
      console.log("Kokoro server is already running.");
      return;
    }
    
    // Check if Kokoro is installed
    const { spawn } = require("child_process");
    const kokoroAvailable = await new Promise<boolean>((resolve) => {
      const proc = spawn(config.kokoroPythonPath, ["-c", "import kokoro"], { timeout: 5000 });
      proc.on("close", (code: number) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
    
    if (!kokoroAvailable) {
      console.error("Error: Kokoro not found.");
      console.error(`Install with: ${config.kokoroPythonPath} -m pip install kokoro soundfile numpy`);
      process.exit(2);
    }
    
    console.log(`Starting Kokoro server (timeout: ${timeout}s)...`);
    
    // Build server script
    const serverScript = `
import json, os, select, signal, socket, sys, time, numpy as np, soundfile as sf
from kokoro import KPipeline

SOCK_PATH = ${JSON.stringify(config.kokoroSocket)}
PID_PATH = ${JSON.stringify(join(config.dataDir, "kokoro_server.pid"))}
IDLE_TIMEOUT = ${timeout}

pipelines = {}

def get_pipeline(lang_code):
    if lang_code not in pipelines:
        pipelines[lang_code] = KPipeline(lang_code=lang_code)
    return pipelines[lang_code]

def handle_client(conn):
    data = b""
    while True:
        chunk = conn.recv(4096)
        if not chunk:
            return
        data += chunk
        if b"\\n" in data:
            break
    line = data.split(b"\\n", 1)[0]
    try:
        req = json.loads(line)
        text, voice, output = req["text"], req["voice"], req["output"]
        pipeline = get_pipeline(voice[0])
        chunks = [audio for _, _, audio in pipeline(text, voice=voice)]
        sf.write(output, np.concatenate(chunks), 24000)
        conn.sendall(b"ok\\n")
    except Exception as e:
        conn.sendall(f"error: {e}\\n".encode())

def cleanup(*_):
    try: os.unlink(SOCK_PATH)
    except: pass
    try: os.unlink(PID_PATH)
    except: pass
    sys.exit(0)

signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

try: os.unlink(SOCK_PATH)
except: pass

with open(PID_PATH, "w") as f:
    f.write(str(os.getpid()))

sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
sock.bind(SOCK_PATH)
sock.listen(1)

print(f"Server listening on {SOCK_PATH}")

last_activity = time.monotonic()
while True:
    ready, _, _ = select.select([sock], [], [], 10)
    if not ready:
        if time.monotonic() - last_activity >= IDLE_TIMEOUT:
            print(f"Idle timeout reached ({IDLE_TIMEOUT}s), shutting down...")
            cleanup()
        continue
    conn, _ = sock.accept()
    try:
        handle_client(conn)
    finally:
        conn.close()
    last_activity = time.monotonic()
`.trim();
    
    const scriptPath = join(config.dataDir, "kokoro_server.py");
    const { writeFileSync } = require("fs");
    writeFileSync(scriptPath, serverScript);
    
    // Start server in background
    const { openSync } = require("fs");
    const logFd = openSync(join(config.dataDir, "kokoro_server.log"), "a");
    
    const proc = spawn(config.kokoroPythonPath, [scriptPath], {
      detached: true,
      stdio: ["ignore", logFd, logFd]
    });
    
    proc.unref();
    
    // Wait for server to start
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500));
      
      const running = await new Promise<boolean>((resolve) => {
        if (!existsSync(config.kokoroSocket)) {
          resolve(false);
          return;
        }
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
      
      if (running) {
        console.log("✓ Kokoro server started");
        return;
      }
      
      // Check for errors in log
      try {
        const log = readFileSync(join(config.dataDir, "kokoro_server.log"), "utf-8").trim();
        if (log.includes("Traceback") || log.includes("Error")) {
          const lastLines = log.split("\n").slice(-3).join(" ").slice(0, 120);
          throw new Error(lastLines);
        }
      } catch {
        // Ignore
      }
    }
    
    throw new Error("Server failed to start within 8s");
  });

serverCmd
  .command("stop")
  .description("Stop the Kokoro TTS server")
  .action(async () => {
    const config = loadConfig();
    const pidPath = join(config.dataDir, "kokoro_server.pid");
    
    if (!existsSync(pidPath)) {
      console.log("Server is not running (no PID file found).");
      return;
    }
    
    try {
      const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      process.kill(pid, "SIGTERM");
      console.log("✓ Kokoro server stopped");
    } catch (error) {
      console.error(`Error stopping server: ${error instanceof Error ? error.message : String(error)}`);
      
      // Cleanup socket and PID file
      try {
        unlinkSync(config.kokoroSocket);
      } catch {}
      try {
        unlinkSync(pidPath);
      } catch {}
    }
  });

serverCmd
  .command("status")
  .description("Check Kokoro TTS server status")
  .action(async () => {
    const config = loadConfig();
    const { createConnection } = require("net");
    
    const isRunning = await new Promise<boolean>((resolve) => {
      if (!existsSync(config.kokoroSocket)) {
        resolve(false);
        return;
      }
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
    
    if (isRunning) {
      console.log("Status: Running");
      console.log(`Socket: ${config.kokoroSocket}`);
      
      const pidPath = join(config.dataDir, "kokoro_server.pid");
      if (existsSync(pidPath)) {
        const pid = readFileSync(pidPath, "utf-8").trim();
        console.log(`PID: ${pid}`);
      }
    } else {
      console.log("Status: Not running");
    }
  });

// Doctor command
program
  .command("doctor")
  .description("Check system health and diagnose issues")
  .option("-j, --json", "Output in JSON format")
  .action(async (options) => {
    const config = loadConfig();
    const runtimeInfo = getRuntimeInfo();
    const { spawn } = require("child_process");
    const { homedir } = require("os");
    const { join } = require("path");
    const { readdirSync, existsSync } = require("fs");
    
    // Helper to run checks
    async function checkCommand(cmd: string, args: string[], timeout = 5000): Promise<boolean> {
      return new Promise((resolve) => {
        const proc = spawn(cmd, args, { timeout });
        proc.on("close", (code: number) => resolve(code === 0));
        proc.on("error", () => resolve(false));
      });
    }
    
    // Check which environment variables are actually set
    const configuredEnvVars: Record<string, string> = {};
    if (process.env.VTT_PYTHON_PATH) configuredEnvVars.VTT_PYTHON_PATH = process.env.VTT_PYTHON_PATH;
    if (process.env.VTT_KOKORO_PYTHON_PATH) configuredEnvVars.VTT_KOKORO_PYTHON_PATH = process.env.VTT_KOKORO_PYTHON_PATH;
    if (process.env.VTT_SOX_PATH) configuredEnvVars.VTT_SOX_PATH = process.env.VTT_SOX_PATH;
    if (process.env.VTT_DATA_DIR) configuredEnvVars.VTT_DATA_DIR = process.env.VTT_DATA_DIR;
    if (process.env.VTT_DEFAULT_STT_MODEL) configuredEnvVars.VTT_DEFAULT_STT_MODEL = process.env.VTT_DEFAULT_STT_MODEL;
    if (process.env.VTT_DEFAULT_TTS_VOICE) configuredEnvVars.VTT_DEFAULT_TTS_VOICE = process.env.VTT_DEFAULT_TTS_VOICE;
    
    // Check dependencies
    const soxInstalled = await checkCommand(config.soxPath, ["--version"]);
    const afplayInstalled = await checkCommand("which", ["afplay"]);
    const sayInstalled = await checkCommand("which", ["say"]);
    
    // Check Python packages
    const pythonAvailable = await checkCommand(config.pythonPath, ["--version"]);
    const mlxWhisperInstalled = pythonAvailable ? await checkCommand(config.pythonPath, ["-c", "import mlx_whisper"]) : false;
    const parakeetInstalled = pythonAvailable ? await checkCommand(config.pythonPath, ["-c", "import parakeet_mlx"]) : false;
    const piperInstalled = pythonAvailable ? await checkCommand(config.pythonPath, ["-c", "import piper"]) : false;
    
    const kokoroPythonAvailable = await checkCommand(config.kokoroPythonPath, ["--version"]);
    const kokoroInstalled = kokoroPythonAvailable ? await checkCommand(config.kokoroPythonPath, ["-c", "import kokoro"]) : false;
    
    // Count downloaded voices
    let piperVoices = 0;
    let kokoroVoices = 0;
    
    // Count Piper voices
    const ttsVoicesDir = join(config.dataDir, "tts-voices");
    if (existsSync(ttsVoicesDir)) {
      try {
        const files = readdirSync(ttsVoicesDir);
        piperVoices = files.filter((f: string) => f.endsWith(".onnx") && !f.endsWith(".json")).length;
      } catch {}
    }
    
    // Count Kokoro voices
    const kokoroCacheDir = join(homedir(), ".cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots");
    if (existsSync(kokoroCacheDir)) {
      try {
        const snapshots = readdirSync(kokoroCacheDir);
        if (snapshots.length > 0) {
          const voicesDir = join(kokoroCacheDir, snapshots[0], "voices");
          if (existsSync(voicesDir)) {
            const files = readdirSync(voicesDir);
            kokoroVoices = files.filter((f: string) => f.endsWith(".pt")).length;
          }
        }
      } catch {}
    }
    
    // Count downloaded models
    const allModels = listAllModels();
    let downloadedModels = 0;
    const modelStatusList: Array<{ name: string; downloaded: boolean; engine: string; type: string }> = [];
    
    for (const { alias, info } of allModels) {
      const engine = getSTTEngine(info);
      const isDownloaded = engine.isModelDownloaded(info);
      if (isDownloaded) downloadedModels++;
      modelStatusList.push({
        name: info.name,
        downloaded: isDownloaded,
        engine: info.provider === "whisper" ? "Whisper" : "Parakeet",
        type: "STT"
      });
    }
    
    // Check Kokoro server status
    const { createConnection } = require("net");
    const kokoroServerRunning = await new Promise<boolean>((resolve) => {
      if (!existsSync(config.kokoroSocket)) {
        resolve(false);
        return;
      }
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
    
    // Check playback status
    const playbackActive = isPlaybackActive(config);
    const playbackPid = getPlaybackPid(config);
    
    // Check data directory
    const dataDirExists = existsSync(config.dataDir);
    
    // Build report
    const report = {
      timestamp: new Date().toISOString(),
      runtime: {
        type: runtimeInfo.type,
        python: config.pythonPath,
        sox: config.soxPath,
        data_dir: config.dataDir,
        data_dir_exists: dataDirExists
      },
      environment: Object.keys(configuredEnvVars).length > 0 ? configuredEnvVars : undefined,
      dependencies: {
        system: {
          sox: soxInstalled,
          afplay: afplayInstalled,
          say: sayInstalled
        },
        engines: {
          whisper: mlxWhisperInstalled,
          parakeet: parakeetInstalled,
          piper: {
            available: piperInstalled,
            voices: piperVoices
          },
          kokoro: {
            available: kokoroInstalled,
            voices: kokoroVoices,
            server_running: kokoroServerRunning
          }
        }
      },
      models: {
        total: allModels.length,
        downloaded: downloadedModels
      },
      playback: {
        active: playbackActive,
        pid: playbackPid
      }
    };
    
    // Output
    if (options.json) {
      // Remove undefined values for cleaner JSON
      const cleanReport = JSON.parse(JSON.stringify(report));
      console.log(JSON.stringify(cleanReport, null, 2));
    } else {
      const tableOpts = {
        borderStyle: 1,
        horizontalLine: true,
        leftPadding: 1,
        rightPadding: 1
      };
      
      console.log("\nVTT Doctor - System Health Check");
      console.log("═".repeat(50));
      
      // Runtime
      const runtimeTypeDisplay = {
        bundled: "✓ Bundled (self-contained)",
        system: "System",
        custom: "Custom (env override)"
      };
      console.log(`\nRuntime: ${runtimeTypeDisplay[runtimeInfo.type]}`);
      console.log(`  Python: ${config.pythonPath}`);
      if (runtimeInfo.type === "custom" || (runtimeInfo.type === "system" && config.soxPath !== "/opt/homebrew/bin/sox")) {
        console.log(`  Sox: ${config.soxPath}`);
      }
      console.log(`  Data: ${config.dataDir} ${dataDirExists ? "✓" : "✗"}`);
      
      // Environment Variables (only if any are set)
      if (Object.keys(configuredEnvVars).length > 0) {
        console.log("\nEnvironment Variables (custom overrides):");
        for (const [key, value] of Object.entries(configuredEnvVars)) {
          console.log(`  ${key}=${value}`);
        }
      }
      
      // Dependencies
      console.log("\nDependencies:");
      const depsTable = new TerminalTable(tableOpts);
      depsTable.push(["Component", "Status"]);
      depsTable.push(["Sox", soxInstalled ? "✓" : "✗"]);
      depsTable.push(["afplay", afplayInstalled ? "✓" : "✗"]);
      depsTable.push(["say", sayInstalled ? "✓" : "✗"]);
      console.log(depsTable.toString());
      
      // Engines
      console.log("\nSpeech Engines:");
      const enginesTable = new TerminalTable(tableOpts);
      enginesTable.push(["Engine", "Status", "Voices"]);
      enginesTable.push(["Whisper", mlxWhisperInstalled ? "✓" : "✗", "-"]);
      enginesTable.push(["Parakeet", parakeetInstalled ? "✓" : "✗", "-"]);
      enginesTable.push(["Piper", piperInstalled ? "✓" : "✗", piperVoices.toString()]);
      enginesTable.push(["Kokoro", kokoroInstalled ? "✓" : "✗", `${kokoroVoices}${kokoroServerRunning ? " (server)" : ""}`]);
      console.log(enginesTable.toString());
      
      // Models
      console.log("\nModels Downloaded:");
      if (downloadedModels === 0) {
        console.log("  None. Run: vtt models download <model>");
      } else {
        const modelsTable = new TerminalTable(tableOpts);
        modelsTable.push(["Name", "Engine"]);
        for (const m of modelStatusList.filter(m => m.downloaded)) {
          modelsTable.push([m.name, m.engine]);
        }
        console.log(modelsTable.toString());
      }
      
      // Playback
      console.log("\nBackground Services:");
      console.log(`  Playback: ${playbackActive ? `Active (PID: ${playbackPid})` : "Stopped"}`);
      console.log(`  Kokoro Server: ${kokoroServerRunning ? "Running" : "Not running"}`);
      
      // Summary
      const issues: string[] = [];
      if (!soxInstalled) issues.push("Sox not installed");
      if (!mlxWhisperInstalled && !parakeetInstalled) issues.push("No STT engine available");
      if (downloadedModels === 0) issues.push("No models downloaded");
      
      console.log("\n" + "═".repeat(50));
      if (issues.length === 0) {
        console.log("✓ All systems ready!");
      } else {
        console.log("⚠ Issues found:");
        for (const issue of issues) {
          console.log(`  - ${issue}`);
        }
      }
      console.log();
    }
  });

// Help command with comprehensive documentation
program
  .command("help-all")
  .alias("h")
  .description("Show comprehensive help with examples")
  .action(() => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    VTT - Voice-to-Text CLI                     ║
║            Local Speech-to-Text & Text-to-Speech               ║
╚════════════════════════════════════════════════════════════════╝

VTT is a composable Unix CLI for local speech recognition and synthesis
using Apple MLX. All processing happens on-device - no cloud APIs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QUICK START
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Check system health:
     $ vtt doctor

  2. List available voices:
     $ vtt voices list

  3. Download a voice:
     $ vtt voices download Heart

  4. Transcribe speech:
     $ vtt transcribe
     (Press Ctrl+C to stop recording)

  5. Read text aloud:
     $ vtt speak "Hello world" -v Heart

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 COMMANDS OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  transcribe    Record and transcribe speech to text
  speak         Convert text to speech
  playback      Control audio playback
  voices        Manage TTS voices
  models        Manage STT models
  server        Manage Kokoro TTS server
  doctor        Check system health and diagnose issues

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TRANSCRIBE - Speech to Text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Record from microphone:
    $ vtt transcribe

  Use specific model:
    $ vtt transcribe --model whisper-tiny
    $ vtt transcribe --model parakeet-1.1b

  Auto-stop on silence:
    $ vtt transcribe --silence-timeout 15
    (Stops after 15 seconds of silence)

  Custom silence threshold:
    $ vtt transcribe --silence-timeout 15 --silence-threshold 0.015
    (Default threshold is 0.02 amplitude)

  Set maximum duration:
    $ vtt transcribe --max-duration 300
    (Stops after 5 minutes regardless)

  Transcribe existing audio file:
    $ vtt transcribe --input recording.wav

  Output formats:
    $ vtt transcribe --format json              # Full JSON (default)
    $ vtt transcribe --format text              # Text with newline
    $ vtt transcribe --format raw               # Raw text, no newline
    $ vtt transcribe --quiet                    # Same as --format raw

  Save to file:
    $ vtt transcribe --output meeting.txt
    $ vtt transcribe -o meeting.txt --format text

  Background transcription (runs in background):
    $ vtt transcribe start
    $ vtt transcribe start --silence-timeout 15
    $ vtt transcribe stop  # Stops recording and transcribes

  Check background status:
    $ vtt transcribe status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPEAK - Text to Speech
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Speak text directly:
    $ vtt speak "Hello world"

  Use specific voice:
    $ vtt speak -v Heart "Hello world"
    $ vtt speak --voice Amy "Hello world"
    $ vtt speak -v Samantha "Hello world"

  Control playback speed (0.5-2.0x):
    $ vtt speak -v Heart --speed 1.5 "Fast speech"
    $ vtt speak -v Amy --speed 0.8 "Slow and clear"

  Read from file:
    $ vtt speak -f document.txt
    $ vtt speak --file essay.txt -v Heart

  Pipe from stdin (automatically detected):
    $ echo "Hello world" | vtt speak
    $ cat script.txt | vtt speak -v Daniel
    $ ls -la | vtt speak -v Alex
    $ date | vtt speak

  Save to file (don't play):
    $ vtt speak "Hello" --output greeting.wav
    $ vtt speak -f input.txt -o output.wav

  Quiet mode:
    $ vtt speak "Hello" --quiet

  Features:
    • Auto-stops any existing playback before starting new audio
    • Supports 3 voice types: System, Piper, Kokoro
    • Speed control works for all voice types

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PLAYBACK - Audio Control
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Stop current playback:
    $ vtt playback stop

  Check playback status:
    $ vtt playback status
    (Outputs JSON: {"playing": true, "pid": 12345})

  Get current playback PID:
    $ vtt playback pid
    (Returns PID or empty string)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 VOICES - Voice Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  List all voices:
    $ vtt voices list
    (Shows download status for each voice)

  Download a voice:
    $ vtt voices download Heart
    $ vtt voices download Amy
    $ vtt voices download Adam

  Delete a voice:
    $ vtt voices delete Heart

  Preview a voice:
    $ vtt voices preview Heart
    $ vtt voices preview Heart --speed 1.2

  Available Voices:
    
    System (built-in, no download):
      Samantha, Alex, Daniel, Karen, Moira, Tessa, Fiona, Veena
    
    Piper (~60MB each):
      Amy, Lessac, Ryan, Alba, Alan
    
    Kokoro (~500KB each, requires ~350MB base model):
      Heart, Alloy, Bella, Jessica, Nicole, Nova, River, Sarah, Sky,
      Adam, Echo, Eric, Liam, Michael, Onyx, Alice, Emma, Lily,
      Daniel, George, Lewis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MODELS - Model Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  List all models:
    $ vtt models list
    (Shows download status for each model)

  Download a model:
    $ vtt models download whisper-tiny
    $ vtt models download whisper-small
    $ vtt models download parakeet-110m

  Delete a model:
    $ vtt models delete whisper-large

  Available Models:
    
    Whisper (multilingual):
      whisper-tiny    ~75MB   Fastest, lower accuracy
      whisper-small   ~500MB  Good balance
      whisper-large   ~1.6GB  Best multilingual accuracy
    
    Parakeet (English-only):
      parakeet-110m   ~220MB  Fast, lightweight
      parakeet-0.6b   ~1.2GB  Good accuracy
      parakeet-1.1b   ~2.2GB  Best English accuracy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SERVER - Kokoro TTS Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  The Kokoro server keeps the TTS model loaded in memory for
  instant responses. Without it, each request has a ~5-10s cold start.

  Start server:
    $ vtt server start

  Start with custom idle timeout:
    $ vtt server start --timeout 300
    (Server stops after 5 minutes of inactivity)

  Check status:
    $ vtt server status

  Stop server:
    $ vtt server stop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DOCTOR - System Health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Check system health:
    $ vtt doctor

  Output as JSON:
    $ vtt doctor --json

  Checks:
    • Environment variables configured
    • Dependencies installed (sox, afplay, say)
    • STT engines available (Whisper, Parakeet)
    • TTS engines available (Piper, Kokoro)
    • Voices downloaded per engine
    • Models downloaded
    • Kokoro server status
    • Playback status

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Environment Variables:
    VTT_PYTHON_PATH          Path to Python 3.10+ (default: /opt/homebrew/bin/python3)
    VTT_KOKORO_PYTHON_PATH   Path to Python for Kokoro (default: ~/.local/lib-kokoro/venv/bin/python3)
    VTT_SOX_PATH             Path to sox binary (default: /opt/homebrew/bin/sox)
    VTT_DATA_DIR             Data directory (default: ~/.local/share/vtt)
    VTT_KOKORO_SOCKET        Unix socket path (default: /tmp/kokoro_tts_<uid>.sock)
    VTT_KOKORO_IDLE_TIMEOUT  Server idle timeout (default: 120)
    VTT_DEFAULT_STT_MODEL    Default model (default: whisper-tiny)
    VTT_DEFAULT_TTS_VOICE    Default voice (default: Samantha)
    VTT_LOG_LEVEL            Log level: debug, info, warn, error (default: info)

  Set in your shell profile:
    export VTT_PYTHON_PATH=/opt/homebrew/bin/python3
    export VTT_DEFAULT_TTS_VOICE=Heart

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXIT CODES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  0  Success
  1  General error (file not found, recording too short, etc.)
  2  Missing dependency (sox, Python package not installed)
  3  Model/voice not downloaded
  4  Unknown voice (voice name doesn't exist in any engine)
  5  Unknown model (model-id doesn't exist)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Record meeting with auto-stop:
    $ vtt transcribe --silence-timeout 15 -o meeting.txt

  Read document with speed boost:
    $ vtt speak -f report.txt -v Heart --speed 1.3

  Chain commands (transcribe and read back):
    $ TEXT=$(vtt transcribe --silence-timeout 10 --quiet)
    $ echo "You said: $TEXT" | vtt speak -v Samantha

  Script automation:
    #!/bin/bash
    RESULT=$(vtt transcribe --silence-timeout 5 --format json)
    TEXT=$(echo $RESULT | jq -r '.text')
    echo "Transcribed: $TEXT"

  Stop all audio:
    $ vtt playback stop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  • First run: Run 'vtt doctor' to check your setup
  • Silence detection: Use --silence-timeout for hands-free operation
  • Kokoro server: Start it for faster TTS responses
  • Speed control: 1.0 = normal, 0.5 = half, 2.0 = double
  • Raw output: Use --format raw or --quiet for piping
  • Interactive mode: Ctrl+C once to stop gracefully, twice to force exit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For more help on a specific command:
  $ vtt <command> --help

Examples:
  $ vtt transcribe --help
  $ vtt speak --help
  $ vtt voices --help
`);
    process.exit(0);
  });

// Override default help
program.on("--help", () => {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For comprehensive help with examples:
  $ vtt help-all
  $ vtt h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
});

program.parse();
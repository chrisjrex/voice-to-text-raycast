#!/usr/bin/env node
/**
 * VTT CLI - Voice-to-Text CLI
 * A composable Unix tool for local speech-to-text and text-to-speech
 */

import { Command } from "commander";
import { readFileSync, existsSync, statSync, unlinkSync, readdirSync, rmdirSync } from "fs";
import { loadConfig, log, getRuntimeInfo } from "../../core/dist/index.js";
import { getVoiceByAlias, getVoiceByAliasAndEngine, listAllVoices, getModelByAlias, listAllModels } from "../../core/dist/index.js";
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

function cleanupRecordingsDir(dirPath: string): void {
  try {
    if (!existsSync(dirPath)) return;
    const files = readdirSync(dirPath);
    for (const file of files) {
      const filePath = join(dirPath, file);
      try {
        const stat = statSync(filePath);
        if (stat.isFile()) {
          unlinkSync(filePath);
        }
      } catch {
        // Ignore individual file errors
      }
    }
    // Try to remove empty directory
    try {
      rmdirSync(dirPath);
    } catch {
      // Ignore if not empty
    }
  } catch {
    // Ignore directory errors
  }
}

function shouldAutoCleanRecordings(): boolean {
  return process.env.VTT_AUTO_CLEAN_RECORDINGS !== "false";
}

function getTtsRecordingsPath(config: { dataDir: string }): string {
  return process.env.VTT_TTS_RECORDINGS_PATH || join(config.dataDir, "tts", "recordings");
}

function getSttRecordingsPath(config: { dataDir: string }): string {
  return process.env.VTT_STT_RECORDINGS_PATH || join(config.dataDir, "stt", "recordings");
}

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
  .option("-e, --engine <engine>", "TTS engine (piper, kokoro, system)")
  .option("-v, --voice <name>", "Voice alias (e.g., Heart, Amy, Samantha)", process.env.VTT_DEFAULT_TTS_VOICE || "Samantha")
  .option("-s, --speed <factor>", "Playback speed factor (0.5-2.0)", "1.0")
  .option("-o, --output <path>", "Save to file instead of playing")
  .option("-q, --quiet", "Suppress non-error output")
  .action(async (text: string | undefined, options: { file?: string; engine?: string; voice: string; speed: string; output?: string; quiet?: boolean }) => {
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

    // Engine is required - from command line, config, or environment variable
    const engineName = options.engine || config.defaultTTSEngine || process.env.VTT_DEFAULT_TTS_ENGINE;

    if (!engineName) {
      console.error(`Error: --engine is required for speaking.`);
      console.error(`Usage: vtt speak "Hello" --engine <piper|kokoro|system>`);
      console.error(`Or set VTT_DEFAULT_TTS_ENGINE environment variable.`);
      console.error(`Run 'vtt voices list' to see available voices and their engines.`);
      process.exit(ExitCodes.GENERAL_ERROR);
    }

    // Look up voice by alias and specific engine
    const voice = getVoiceByAliasAndEngine(options.voice, engineName);
    if (!voice) {
      console.error(`Error: Unknown voice "${options.voice}" for engine "${engineName}"`);
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
          console.error(`Run: vtt voices download ${options.voice} --engine ${voice.provider}`);
          process.exit(3);
        }
      }
      
      // Generate audio
      const ttsRecordingsPath = getTtsRecordingsPath(config);
      const outputPath = options.output || join(ttsRecordingsPath, `${Date.now()}.wav`);
      
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
        const recordingsDir = ttsRecordingsPath;
        const playback = playAudio(outputPath, config, () => {
          if (shouldAutoCleanRecordings()) {
            cleanupRecordingsDir(recordingsDir);
          }
          process.exit(0);
        });
        
        // Handle Ctrl+C
        process.on("SIGINT", () => {
          playback.stop();
          if (shouldAutoCleanRecordings()) {
            cleanupRecordingsDir(recordingsDir);
          }
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
    
    // Helper to format row
    const formatRow = (cols: string[], widths: number[]) => {
      return cols.map((col, i) => col.padEnd(widths[i])).join("  ");
    };
    
    // Calculate column widths
    const nameWidth = Math.max("Name".length, ...voices.map(v => v.alias.length)) + 2;
    const providerWidth = Math.max("Provider".length, ...voices.map(v => v.info.provider.length)) + 2;
    const statusWidth = Math.max("Status".length, "Built-in".length, "✓ Downloaded".length, "Not installed".length) + 2;
    const accentWidth = Math.max("Accent".length, ...voices.map(v => v.info.accent.length)) + 2;
    const genderWidth = Math.max("Gender".length, ...voices.map(v => v.info.gender.length)) + 2;
    
    const widths = [nameWidth, providerWidth, statusWidth, accentWidth, genderWidth];
    
    // Print header
    console.log(formatRow(["Name", "Provider", "Status", "Accent", "Gender"], widths));
    
    // Print system voices first (always available)
    if (grouped["system"]) {
      for (const { alias, info } of grouped["system"]) {
        console.log(formatRow([alias, "System", "Built-in", info.accent, info.gender], widths));
      }
    }
    
    // Print Piper voices
    if (grouped["piper"]) {
      for (const { alias, info } of grouped["piper"]) {
        const engine = getTTSEngine(info);
        const status = engine.isVoiceDownloaded(info, config) ? "✓ Downloaded" : "Not installed";
        console.log(formatRow([alias, "Piper", status, info.accent, info.gender], widths));
      }
    }
    
    // Print Kokoro voices
    if (grouped["kokoro"]) {
      for (const { alias, info } of grouped["kokoro"]) {
        const engine = getTTSEngine(info);
        const status = engine.isVoiceDownloaded(info, config) ? "✓ Downloaded" : "Not installed";
        console.log(formatRow([alias, "Kokoro", status, info.accent, info.gender], widths));
      }
    }
  });

voicesCmd
  .command("download <voice>")
  .description("Download a voice by alias (requires --engine or VTT_DEFAULT_TTS_ENGINE)")
  .option("-e, --engine <engine>", "TTS engine (piper, kokoro, system)")
  .action(async (voiceAlias: string, options: { engine?: string }) => {
    const config = loadConfig();
    const { homedir } = require("os");
    const { join } = require("path");
    const { existsSync, mkdirSync } = require("fs");

    // Engine is required - from command line, config, or environment variable
    const engineName = options.engine || config.defaultTTSEngine || process.env.VTT_DEFAULT_TTS_ENGINE;

    if (!engineName) {
      console.error(`Error: --engine is required for downloading voices.`);
      console.error(`Usage: vtt voices download ${voiceAlias} --engine <piper|kokoro>`);
      console.error(`Or set VTT_DEFAULT_TTS_ENGINE environment variable.`);
      console.error(`Run 'vtt voices list' to see available voices and their engines.`);
      process.exit(ExitCodes.GENERAL_ERROR);
    }

    // Look up voice by alias and specific engine
    const voice = getVoiceByAliasAndEngine(voiceAlias, engineName);

    if (!voice) {
      console.error(`Error: Unknown voice "${voiceAlias}" for engine "${engineName}"`);
      console.error(`Run 'vtt voices list' to see available voices.`);
      process.exit(ExitCodes.UNKNOWN_VOICE);
    }

    // System voices cannot be downloaded
    if (voice.provider === "system") {
      console.error(`Error: Voice "${voiceAlias}" is a system voice and cannot be downloaded.`);
      console.error(`System voices are built-in and always available.`);
      process.exit(ExitCodes.GENERAL_ERROR);
    }
    
    // Check if engine is already installed
    const engine = getTTSEngine(voice);
    const engineAvailable = await engine.isAvailable(config);
    
    if (!engineAvailable) {
      const requiredPackage = voice.provider === "piper" ? "piper-tts" : "kokoro";
      const askPermission = process.env.VTT_ASK_PERMISSION !== "false";
      
      if (askPermission) {
        // Interactive mode - ask for permission
        const readline = require("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question(`The ${voice.provider} engine is not installed. Install ${requiredPackage}? (y/N): `, resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
          console.log("Installation cancelled.");
          console.log(`To skip this prompt in the future, set VTT_ASK_PERMISSION=false`);
          process.exit(ExitCodes.GENERAL_ERROR);
        }
      } else {
        // Headless mode - auto-install
        console.log(`VTT_ASK_PERMISSION=false: Auto-installing ${requiredPackage}...`);
      }
      
      // Install required Python package
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
    }
    
    console.log(`Downloading ${voiceAlias} (${voice.provider})...`);
    const { spawn } = require("child_process");
    
    if (voice.provider === "piper") {
      // Download Piper voice files
      const ttsVoicesDir = join(config.dataDir, "tts", "voices");
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
  .description("Delete a downloaded voice (requires --engine or VTT_DEFAULT_TTS_ENGINE)")
  .option("-e, --engine <engine>", "TTS engine (piper, kokoro, system)")
  .action(async (voiceAlias: string, options: { engine?: string }) => {
    const config = loadConfig();

    // Engine is required - from command line, config, or environment variable
    const engineName = options.engine || config.defaultTTSEngine || process.env.VTT_DEFAULT_TTS_ENGINE;

    if (!engineName) {
      console.error(`Error: --engine is required for deleting voices.`);
      console.error(`Usage: vtt voices delete ${voiceAlias} --engine <piper|kokoro>`);
      console.error(`Or set VTT_DEFAULT_TTS_ENGINE environment variable.`);
      console.error(`Run 'vtt voices list' to see available voices and their engines.`);
      process.exit(ExitCodes.GENERAL_ERROR);
    }

    // Look up voice by alias and specific engine
    const voice = getVoiceByAliasAndEngine(voiceAlias, engineName);

    if (!voice) {
      console.error(`Error: Unknown voice "${voiceAlias}" for engine "${engineName}"`);
      console.error(`Run 'vtt voices list' to see available voices.`);
      process.exit(ExitCodes.UNKNOWN_VOICE);
    }

    // System voices cannot be deleted
    if (voice.provider === "system") {
      console.error(`Error: Voice "${voiceAlias}" is a system voice and cannot be deleted.`);
      console.error(`System voices are built-in and always available.`);
      process.exit(ExitCodes.GENERAL_ERROR);
    }

    console.log(`Deleting ${voiceAlias} (${voice.provider})...`);
    // TODO: Implement delete logic
    console.log("Delete functionality not yet implemented.");
  });

voicesCmd
  .command("preview <voice>")
  .description("Preview a voice (requires --engine or VTT_DEFAULT_TTS_ENGINE)")
  .option("-e, --engine <engine>", "TTS engine (piper, kokoro, system)")
  .option("-s, --speed <factor>", "Playback speed factor (0.5-2.0)", "1.0")
  .action(async (voiceAlias: string, options: { engine?: string; speed: string }) => {
    const config = loadConfig();

    // Engine is required - from command line, config, or environment variable
    const engineName = options.engine || config.defaultTTSEngine || process.env.VTT_DEFAULT_TTS_ENGINE;

    if (!engineName) {
      console.error(`Error: --engine is required for previewing voices.`);
      console.error(`Usage: vtt voices preview ${voiceAlias} --engine <piper|kokoro|system>`);
      console.error(`Or set VTT_DEFAULT_TTS_ENGINE environment variable.`);
      console.error(`Run 'vtt voices list' to see available voices and their engines.`);
      process.exit(ExitCodes.GENERAL_ERROR);
    }

    // Look up voice by alias and specific engine
    const voice = getVoiceByAliasAndEngine(voiceAlias, engineName);

    if (!voice) {
      console.error(`Error: Unknown voice "${voiceAlias}" for engine "${engineName}"`);
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
        console.error(`Run: vtt voices download ${voiceAlias} --engine ${voice.provider}`);
        process.exit(3);
      }
    }
    
    const previewText = "Hello! This is a preview of my voice.";
    const outputPath = join(config.dataDir, "tts", "previews", `preview-${voiceAlias}-${Date.now()}.wav`);
    
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
    const pidPath = join(config.dataDir, "stt", "daemon", "transcribe_daemon.pid");
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

    const daemonPath = join(config.dataDir, "stt", "daemon", "transcribe_daemon.py");
    writeFileSync(daemonPath, daemonScript);
    
    // Start daemon
    const { openSync } = require("fs");
    const logFd = openSync(join(config.dataDir, "stt", "daemon", "transcribe_daemon.log"), "a");
    
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
    const pidPath = join(config.dataDir, "stt", "daemon", "transcribe_daemon.pid");
    
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
    const pidPath = join(config.dataDir, "stt", "daemon", "transcribe_daemon.pid");
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
      const sttRecordingsPath = getSttRecordingsPath(config);
      audioPath = join(sttRecordingsPath, `recording-${Date.now()}.wav`);
      
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
        // Clean up recordings directory
        if (shouldAutoCleanRecordings()) {
          const recordingsDir = getSttRecordingsPath(config);
          cleanupRecordingsDir(recordingsDir);
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
        // Clean up recordings directory on error
        if (shouldAutoCleanRecordings()) {
          const recordingsDir = getSttRecordingsPath(config);
          cleanupRecordingsDir(recordingsDir);
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
    
    // Helper to format row
    const formatRow = (cols: string[], widths: number[]) => {
      return cols.map((col, i) => col.padEnd(widths[i])).join("  ");
    };
    
    // Calculate column widths
    const aliasWidth = Math.max("Alias".length, ...models.map(m => m.alias.length)) + 2;
    const providerWidth = Math.max("Provider".length, ...models.map(m => m.info.provider.length)) + 2;
    const statusWidth = Math.max("Status".length, "✓ Downloaded".length, "Not installed".length) + 2;
    const sizeWidth = Math.max("Size".length, ...models.map(m => m.info.size.length)) + 2;
    const descWidth = Math.max("Description".length, ...models.map(m => m.info.description.length)) + 2;
    
    const widths = [aliasWidth, providerWidth, statusWidth, sizeWidth, descWidth];
    
    // Print header and rows
    console.log(formatRow(["Alias", "Provider", "Status", "Size", "Description"], widths));
    
    for (const { alias, info } of models) {
      const engine = getSTTEngine(info);
      const status = engine.isModelDownloaded(info) ? "✓ Downloaded" : "Not installed";
      console.log(formatRow([alias, info.provider, status, info.size, info.description], widths));
    }
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
PID_PATH = ${JSON.stringify(join(config.dataDir, "tts", "daemon", "kokoro_server.pid"))}
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
    
    const scriptPath = join(config.dataDir, "tts", "daemon", "kokoro_server.py");
    const { writeFileSync } = require("fs");
    writeFileSync(scriptPath, serverScript);
    
    // Start server in background
    const { openSync } = require("fs");
    const logFd = openSync(join(config.dataDir, "tts", "daemon", "kokoro_server.log"), "a");
    
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
    const pidPath = join(config.dataDir, "tts", "daemon", "kokoro_server.pid");
    
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
      
      const pidPath = join(config.dataDir, "tts", "daemon", "kokoro_server.pid");
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
    if (process.env.VTT_KOKORO_SOCKET) configuredEnvVars.VTT_KOKORO_SOCKET = process.env.VTT_KOKORO_SOCKET;
    if (process.env.VTT_KOKORO_IDLE_TIMEOUT) configuredEnvVars.VTT_KOKORO_IDLE_TIMEOUT = process.env.VTT_KOKORO_IDLE_TIMEOUT;
    if (process.env.VTT_DEFAULT_STT_MODEL) configuredEnvVars.VTT_DEFAULT_STT_MODEL = process.env.VTT_DEFAULT_STT_MODEL;
    if (process.env.VTT_DEFAULT_TTS_ENGINE) configuredEnvVars.VTT_DEFAULT_TTS_ENGINE = process.env.VTT_DEFAULT_TTS_ENGINE;
    if (process.env.VTT_DEFAULT_TTS_VOICE) configuredEnvVars.VTT_DEFAULT_TTS_VOICE = process.env.VTT_DEFAULT_TTS_VOICE;
    if (process.env.VTT_LOG_LEVEL) configuredEnvVars.VTT_LOG_LEVEL = process.env.VTT_LOG_LEVEL;
    if (process.env.VTT_AUTO_CLEAN_RECORDINGS) configuredEnvVars.VTT_AUTO_CLEAN_RECORDINGS = process.env.VTT_AUTO_CLEAN_RECORDINGS;
    if (process.env.VTT_TTS_RECORDINGS_PATH) configuredEnvVars.VTT_TTS_RECORDINGS_PATH = process.env.VTT_TTS_RECORDINGS_PATH;
    if (process.env.VTT_STT_RECORDINGS_PATH) configuredEnvVars.VTT_STT_RECORDINGS_PATH = process.env.VTT_STT_RECORDINGS_PATH;
    if (process.env.VTT_ASK_PERMISSION) configuredEnvVars.VTT_ASK_PERMISSION = process.env.VTT_ASK_PERMISSION;
    
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
    const ttsVoicesDir = join(config.dataDir, "tts", "voices");
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
    let whisperModels = 0;
    let parakeetModels = 0;
    const modelStatusList: Array<{ name: string; downloaded: boolean; engine: string; type: string }> = [];

    for (const { alias, info } of allModels) {
      const engine = getSTTEngine(info);
      const isDownloaded = engine.isModelDownloaded(info);
      if (isDownloaded) {
        downloadedModels++;
        if (info.provider === "whisper") {
          whisperModels++;
        } else if (info.provider === "parakeet") {
          parakeetModels++;
        }
      }
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
        downloaded: downloadedModels,
        whisper: whisperModels,
        parakeet: parakeetModels
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
      // Use Python script for formatted tables
      const { execSync } = require("child_process");
      const scriptPath = join(__dirname, "..", "assets", "format-doctor-tables.js");
      const fallbackScriptPath = join(__dirname, "..", "assets", "format-doctor-tables.py");
      
      // Runtime display helpers
      const runtimeTypeDisplay = {
        bundled: "✓ Bundled (self-contained)",
        system: "System",
        custom: "Custom (env override)"
      };
      
      // Print header
      console.log("\nVTT Doctor - System Health Check");
      console.log("══════════════════════════════════════════════════");
      
      let tablesOutput = "";
      
      try {
        const scriptToUse = existsSync(scriptPath) ? scriptPath : fallbackScriptPath;
        tablesOutput = execSync(`"${config.pythonPath}" "${scriptToUse}"`, {
          input: JSON.stringify(report),
          encoding: "utf-8",
          timeout: 30000
        }).trimStart();
      } catch {
        // Fallback to manual output - build the tables manually
        const runtimeTypeValue = runtimeInfo.type === "system" 
          ? runtimeTypeDisplay[runtimeInfo.type]
          : "✓ " + runtimeTypeDisplay[runtimeInfo.type];
        
        const runtimeTable = [
          "Runtime:",
          `  Type     ${runtimeTypeValue}`,
          `  Python   ${config.pythonPath}`,
          `  Sox      ${config.soxPath}`,
          `  Data     ${config.dataDir}`
        ].join("\n");
        
        const depsTable = [
          "Dependencies:",
          "  Component  Status",
          `  Sox        ${soxInstalled ? "✓" : "✗"}`,
          `  afplay     ${afplayInstalled ? "✓" : "✗"}`,
          `  say        ${sayInstalled ? "✓" : "✗"}`
        ].join("\n");
        
        const sttTable = [
          "Speech-to-Text:",
          "  Engine    installed  Models",
          `  Whisper   ${mlxWhisperInstalled ? "✓" : "✗"}         ${whisperModels}`,
          `  Parakeet  ${parakeetInstalled ? "✓" : "✗"}         ${parakeetModels}`
        ].join("\n");
        
        const ttsTable = [
          "Text-to-Speech:",
          "  Engine    installed  Voices",
          `  Piper     ${piperInstalled ? "✓" : "✗"}         ${piperVoices}`,
          `  Kokoro    ${kokoroInstalled ? "✓" : "✗"}         ${kokoroVoices}${kokoroServerRunning ? " (server)" : ""}`
        ].join("\n");
        
        const servicesTable = [
          "Background Services:",
          `  Playback: ${playbackActive ? `Active (PID: ${playbackPid})` : "Stopped"}`,
          `  Kokoro Server: ${kokoroServerRunning ? "Running" : "Not running"}`
        ].join("\n");
        
        tablesOutput = `
${runtimeTable}

${depsTable}

${sttTable}

${ttsTable}

${servicesTable}`;
      }
      
      console.log(tablesOutput.trimStart());
      
      // Summary
      const issues: string[] = [];
      if (!soxInstalled) issues.push("Sox not installed");
      if (!mlxWhisperInstalled && !parakeetInstalled) issues.push("No STT engine available");
      if (downloadedModels === 0) issues.push("No models downloaded");
      
      console.log("══════════════════════════════════════════════════");
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

// Storage command - shows paths and sizes of dependencies and downloads
program
  .command("storage")
  .description("Show storage usage of dependencies, models, and voices")
  .option("-j, --json", "Output in JSON format")
  .action(async (options) => {
    const config = loadConfig();
    const runtimeInfo = getRuntimeInfo();
    const { spawn } = require("child_process");
    const { homedir } = require("os");
    const { join } = require("path");
    const { readdirSync, existsSync, statSync } = require("fs");
    
    // Helper to format bytes to human readable
    function formatBytes(bytes: number): string {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
    
    // Helper to get file/directory size
    function getSize(path: string): number {
      if (!existsSync(path)) return 0;
      const stats = statSync(path);
      if (!stats.isDirectory()) return stats.size;
      
      let total = 0;
      try {
        const files = readdirSync(path, { recursive: true }) as string[];
        for (const file of files) {
          const filePath = join(path, file);
          try {
            const s = statSync(filePath);
            if (s.isFile()) total += s.size;
          } catch {}
        }
      } catch {}
      return total;
    }
    
    // Helper to check if command exists and get its path
    async function getCommandPath(cmd: string): Promise<string | null> {
      return new Promise((resolve) => {
        const proc = spawn("which", [cmd], { timeout: 5000 });
        let output = "";
        proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
        proc.on("close", (code: number) => resolve(code === 0 ? output.trim() : null));
        proc.on("error", () => resolve(null));
      });
    }
    
    // Get executable paths
    const pythonPath = config.pythonPath;
    const soxPath = config.soxPath;
    const afplayPath = await getCommandPath("afplay");
    const sayPath = await getCommandPath("say");
    
    // Get executable sizes
    const pythonSize = existsSync(pythonPath) ? getSize(pythonPath) : 0;
    const soxSize = existsSync(soxPath) ? getSize(soxPath) : 0;
    const afplaySize = afplayPath && existsSync(afplayPath) ? getSize(afplayPath) : 0;
    const saySize = sayPath && existsSync(sayPath) ? getSize(sayPath) : 0;
    
    // Get HuggingFace cache directory
    const hfCacheDir = join(homedir(), ".cache/huggingface/hub");
    const hfCacheSize = existsSync(hfCacheDir) ? getSize(hfCacheDir) : 0;
    
    // Get data directory subdirectories
    const sttDaemonDir = join(config.dataDir, "stt", "daemon");
    const sttRecordingsDir = join(config.dataDir, "stt", "recordings");
    const ttsTmpDir = join(config.dataDir, "tts", "tmp");
    const ttsPreviewsDir = join(config.dataDir, "tts", "previews");
    const ttsRecordingsDir = join(config.dataDir, "tts", "recordings");
    const ttsVoicesDir = join(config.dataDir, "tts", "voices");
    const venvDir = join(config.dataDir, "venv");

    const sttDaemonSize = existsSync(sttDaemonDir) ? getSize(sttDaemonDir) : 0;
    const sttRecordingsSize = existsSync(sttRecordingsDir) ? getSize(sttRecordingsDir) : 0;
    const ttsTmpSize = existsSync(ttsTmpDir) ? getSize(ttsTmpDir) : 0;
    const ttsPreviewsSize = existsSync(ttsPreviewsDir) ? getSize(ttsPreviewsDir) : 0;
    const ttsRecordingsSize = existsSync(ttsRecordingsDir) ? getSize(ttsRecordingsDir) : 0;
    const ttsVoicesSize = existsSync(ttsVoicesDir) ? getSize(ttsVoicesDir) : 0;
    const venvSize = existsSync(venvDir) ? getSize(venvDir) : 0;

    const sttSize = sttDaemonSize + sttRecordingsSize;
    const ttsSize = ttsTmpSize + ttsPreviewsSize + ttsRecordingsSize + ttsVoicesSize;
    const dataDirSize = sttSize + ttsSize + venvSize;
    
    // Get models info
    const allModels = listAllModels();
    const modelsInfo: Array<{
      alias: string;
      id: string;
      provider: string;
      downloaded: boolean;
      path: string | null;
      size: number;
    }> = [];
    
    for (const { alias, info } of allModels) {
      const engine = getSTTEngine(info);
      const isDownloaded = engine.isModelDownloaded(info);
      let modelPath: string | null = null;
      let modelSize = 0;
      
      if (isDownloaded) {
        const downloadedModelPath = join(hfCacheDir, `models--${info.id.replace(/\//g, "--")}`);
        modelPath = downloadedModelPath;
        modelSize = existsSync(downloadedModelPath) ? getSize(downloadedModelPath) : 0;
      }
      
      modelsInfo.push({
        alias,
        id: info.id,
        provider: info.provider,
        downloaded: isDownloaded,
        path: modelPath,
        size: modelSize
      });
    }
    
    // Get voices info
    const allVoices = listAllVoices();
    const voicesInfo: Array<{
      alias: string;
      provider: string;
      downloaded: boolean;
      path: string | null;
      size: number;
    }> = [];
    
    // Piper voices directory
    const piperVoicesDir = join(config.dataDir, "tts", "voices");
    
    // Kokoro voices directory
    const kokoroCacheDir = join(homedir(), ".cache/huggingface/hub/models--hexgrad--Kokoro-82M/snapshots");
    let kokoroVoicesDir: string | null = null;
    if (existsSync(kokoroCacheDir)) {
      try {
        const snapshots = readdirSync(kokoroCacheDir);
        if (snapshots.length > 0) {
          kokoroVoicesDir = join(kokoroCacheDir, snapshots[0], "voices");
        }
      } catch {}
    }
    
    for (const { alias, info } of allVoices) {
      if (info.provider === "system") {
        voicesInfo.push({
          alias,
          provider: "system",
          downloaded: true,
          path: null,
          size: 0
        });
        continue;
      }
      
      const engine = getTTSEngine(info);
      const isDownloaded = engine.isVoiceDownloaded(info, config);
      let voicePath: string | null = null;
      let voiceSize = 0;
      
      if (isDownloaded && info.provider === "piper") {
        const piperVoicePath = join(piperVoicesDir, `${info.id}.onnx`);
        voicePath = piperVoicePath;
        if (existsSync(piperVoicePath)) {
          voiceSize = getSize(piperVoicePath);
          // Add config file size if exists
          const configPath = `${piperVoicePath}.json`;
          if (existsSync(configPath)) {
            voiceSize += getSize(configPath);
          }
        }
      } else if (isDownloaded && info.provider === "kokoro" && kokoroVoicesDir) {
        const kokoroVoicePath = join(kokoroVoicesDir, `${info.id}.pt`);
        voicePath = kokoroVoicePath;
        if (existsSync(kokoroVoicePath)) {
          voiceSize = getSize(kokoroVoicePath);
        }
      }
      
      voicesInfo.push({
        alias,
        provider: info.provider,
        downloaded: isDownloaded,
        path: voicePath,
        size: voiceSize
      });
    }
    
    // Calculate totals
    const totalModelSize = modelsInfo.reduce((sum, m) => sum + m.size, 0);
    const totalVoiceSize = voicesInfo.reduce((sum, v) => sum + v.size, 0);
    const totalDependencySize = pythonSize + soxSize;
    
    if (options.json) {
      const report = {
        timestamp: new Date().toISOString(),
        dependencies: {
          python: {
            path: pythonPath,
            size: pythonSize,
            size_human: formatBytes(pythonSize)
          },
          sox: {
            path: soxPath,
            size: soxSize,
            size_human: formatBytes(soxSize)
          },
          total_size: totalDependencySize,
          total_size_human: formatBytes(totalDependencySize)
        },
        storage: {
          data_dir: {
            path: config.dataDir,
            size: dataDirSize,
            size_human: formatBytes(dataDirSize),
            stt: {
              size: sttSize,
              size_human: formatBytes(sttSize),
              daemon: { size: sttDaemonSize, size_human: formatBytes(sttDaemonSize) },
              recordings: { size: sttRecordingsSize, size_human: formatBytes(sttRecordingsSize) }
            },
            tts: {
              size: ttsSize,
              size_human: formatBytes(ttsSize),
              voices: { size: ttsVoicesSize, size_human: formatBytes(ttsVoicesSize) },
              previews: { size: ttsPreviewsSize, size_human: formatBytes(ttsPreviewsSize) },
              recordings: { size: ttsRecordingsSize, size_human: formatBytes(ttsRecordingsSize) },
              tmp: { size: ttsTmpSize, size_human: formatBytes(ttsTmpSize) }
            },
            venv: { size: venvSize, size_human: formatBytes(venvSize) }
          },
          huggingface_cache: {
            path: hfCacheDir,
            size: hfCacheSize,
            size_human: formatBytes(hfCacheSize),
            models: { size: totalModelSize, size_human: formatBytes(totalModelSize) }
          }
        },
        models: {
          items: modelsInfo.map(m => ({
            alias: m.alias,
            id: m.id,
            provider: m.provider,
            downloaded: m.downloaded,
            path: m.path,
            size: m.size,
            size_human: formatBytes(m.size)
          })),
          total_size: totalModelSize,
          total_size_human: formatBytes(totalModelSize),
          downloaded_count: modelsInfo.filter(m => m.downloaded).length
        },
        voices: {
          items: voicesInfo.map(v => ({
            alias: v.alias,
            provider: v.provider,
            downloaded: v.downloaded,
            path: v.path,
            size: v.size,
            size_human: formatBytes(v.size)
          })),
          total_size: totalVoiceSize,
          total_size_human: formatBytes(totalVoiceSize),
          downloaded_count: voicesInfo.filter(v => v.downloaded && v.provider !== "system").length
        },
        totals: {
          stt: sttSize,
          stt_human: formatBytes(sttSize),
          stt_daemon: sttDaemonSize,
          stt_daemon_human: formatBytes(sttDaemonSize),
          stt_recordings: sttRecordingsSize,
          stt_recordings_human: formatBytes(sttRecordingsSize),
          tts: ttsSize,
          tts_human: formatBytes(ttsSize),
          tts_voices: ttsVoicesSize,
          tts_voices_human: formatBytes(ttsVoicesSize),
          tts_previews: ttsPreviewsSize,
          tts_previews_human: formatBytes(ttsPreviewsSize),
          tts_recordings: ttsRecordingsSize,
          tts_recordings_human: formatBytes(ttsRecordingsSize),
          tts_tmp: ttsTmpSize,
          tts_tmp_human: formatBytes(ttsTmpSize),
          venv: venvSize,
          venv_human: formatBytes(venvSize),
          huggingface: hfCacheSize,
          huggingface_human: formatBytes(hfCacheSize),
          grand_total: dataDirSize + hfCacheSize,
          grand_total_human: formatBytes(dataDirSize + hfCacheSize)
        }
      };
      console.log(JSON.stringify(report, null, 2));
    } else {
      const report = {
        timestamp: new Date().toISOString(),
        dependencies: {
          python: {
            path: pythonPath,
            size: pythonSize,
            size_human: formatBytes(pythonSize)
          },
          sox: {
            path: soxPath,
            size: soxSize,
            size_human: formatBytes(soxSize)
          },
          total_size: totalDependencySize,
          total_size_human: formatBytes(totalDependencySize)
        },
        storage: {
          data_dir: {
            path: config.dataDir,
            size: dataDirSize,
            size_human: formatBytes(dataDirSize),
            stt: {
              size: sttSize,
              size_human: formatBytes(sttSize),
              daemon: { size: sttDaemonSize, size_human: formatBytes(sttDaemonSize) },
              recordings: { size: sttRecordingsSize, size_human: formatBytes(sttRecordingsSize) }
            },
            tts: {
              size: ttsSize,
              size_human: formatBytes(ttsSize),
              voices: { size: ttsVoicesSize, size_human: formatBytes(ttsVoicesSize) },
              previews: { size: ttsPreviewsSize, size_human: formatBytes(ttsPreviewsSize) },
              recordings: { size: ttsRecordingsSize, size_human: formatBytes(ttsRecordingsSize) },
              tmp: { size: ttsTmpSize, size_human: formatBytes(ttsTmpSize) }
            },
            venv: { size: venvSize, size_human: formatBytes(venvSize) }
          },
          huggingface_cache: {
            path: hfCacheDir,
            size: hfCacheSize,
            size_human: formatBytes(hfCacheSize),
            models: { size: totalModelSize, size_human: formatBytes(totalModelSize) }
          }
        },
        models: {
          items: modelsInfo.map(m => ({
            alias: m.alias,
            id: m.id,
            provider: m.provider,
            downloaded: m.downloaded,
            path: m.path,
            size: m.size,
            size_human: formatBytes(m.size)
          })),
          total_size: totalModelSize,
          total_size_human: formatBytes(totalModelSize),
          downloaded_count: modelsInfo.filter(m => m.downloaded).length
        },
        voices: {
          items: voicesInfo.map(v => ({
            alias: v.alias,
            provider: v.provider,
            downloaded: v.downloaded,
            path: v.path,
            size: v.size,
            size_human: formatBytes(v.size)
          })),
          total_size: totalVoiceSize,
          total_size_human: formatBytes(totalVoiceSize),
          downloaded_count: voicesInfo.filter(v => v.downloaded && v.provider !== "system").length
        },
        totals: {
          stt: sttSize,
          stt_human: formatBytes(sttSize),
          stt_daemon: sttDaemonSize,
          stt_daemon_human: formatBytes(sttDaemonSize),
          stt_recordings: sttRecordingsSize,
          stt_recordings_human: formatBytes(sttRecordingsSize),
          tts: ttsSize,
          tts_human: formatBytes(ttsSize),
          tts_voices: ttsVoicesSize,
          tts_voices_human: formatBytes(ttsVoicesSize),
          tts_previews: ttsPreviewsSize,
          tts_previews_human: formatBytes(ttsPreviewsSize),
          tts_recordings: ttsRecordingsSize,
          tts_recordings_human: formatBytes(ttsRecordingsSize),
          tts_tmp: ttsTmpSize,
          tts_tmp_human: formatBytes(ttsTmpSize),
          venv: venvSize,
          venv_human: formatBytes(venvSize),
          huggingface: hfCacheSize,
          huggingface_human: formatBytes(hfCacheSize),
          grand_total: dataDirSize + hfCacheSize,
          grand_total_human: formatBytes(dataDirSize + hfCacheSize)
        }
      };

      const { execSync } = require("child_process");
      const scriptPath = join(config.dataDir, "format-storage-table.py");
      try {
        const output = execSync(`"${config.pythonPath}" "${scriptPath}"`, {
          input: JSON.stringify(report),
          encoding: "utf-8",
          timeout: 30000
        });
        console.log(output);
      } catch (error) {
        console.error("Error formatting storage output:", (error as Error).message);
        console.log(JSON.stringify(report, null, 2));
      }
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
     $ vtt voices download Heart --engine kokoro

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
  storage       Show storage usage of dependencies and downloads
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

  Use specific voice and engine:
    $ vtt speak -e kokoro -v Heart "Hello world"
    $ vtt speak --engine piper --voice Amy "Hello world"
    $ vtt speak -e system -v Samantha "Hello world"

  Control playback speed (0.5-2.0x):
    $ vtt speak -e kokoro -v Heart --speed 1.5 "Fast speech"
    $ vtt speak -e piper -v Amy --speed 0.8 "Slow and clear"

  Read from file:
    $ vtt speak -e kokoro -f document.txt
    $ vtt speak --engine piper --file essay.txt -v Amy

  Pipe from stdin (automatically detected):
    $ echo "Hello world" | vtt speak -e kokoro
    $ cat script.txt | vtt speak -e system -v Daniel
    $ ls -la | vtt speak -e piper -v Alex
    $ date | vtt speak -e system

  Save to file (don't play):
    $ vtt speak -e kokoro "Hello" --output greeting.wav
    $ vtt speak -e piper -f input.txt -o output.wav

  Quiet mode:
    $ vtt speak -e kokoro "Hello" --quiet

  With environment variables set (no --engine needed):
    $ export VTT_DEFAULT_TTS_ENGINE=kokoro
    $ export VTT_DEFAULT_TTS_VOICE=Heart
    $ vtt speak "Hello world"

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
    $ vtt voices download Heart --engine kokoro
    $ vtt voices download Amy --engine piper
    $ vtt voices download Adam --engine kokoro

  Delete a voice:
    $ vtt voices delete Heart --engine kokoro

  Preview a voice:
    $ vtt voices preview Heart --engine kokoro
    $ vtt voices preview Amy --engine piper
    $ vtt voices preview Samantha --engine system
    $ vtt voices preview Heart --engine kokoro --speed 1.2

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
 STORAGE - Storage Usage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Show storage usage for dependencies, models, and voices:
    $ vtt storage

  Output as JSON:
    $ vtt storage --json

  Shows:
    • Dependency paths and sizes (Python, sox, afplay, say)
    • Storage directory paths and sizes
    • Downloaded models with their paths and sizes
    • Downloaded voices with their paths and sizes
    • Grand total storage used

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
    VTT_DEFAULT_TTS_ENGINE   Default TTS engine (piper, kokoro, system)
    VTT_DEFAULT_TTS_VOICE    Default voice (default: Samantha)
    VTT_LOG_LEVEL            Log level: debug, info, warn, error (default: info)
    VTT_ASK_PERMISSION       Prompt before installing engine dependencies (default: true)
                             Set to 'false' for headless/automated usage

  Set in your shell profile:
    export VTT_PYTHON_PATH=/opt/homebrew/bin/python3
    export VTT_DEFAULT_TTS_ENGINE=kokoro
    export VTT_DEFAULT_TTS_VOICE=Heart
    export VTT_ASK_PERMISSION=false  # Skip prompts for automated scripts

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
    $ vtt speak -f report.txt -e kokoro -v Heart --speed 1.3

  Chain commands (transcribe and read back):
    $ TEXT=$(vtt transcribe --silence-timeout 10 --quiet)
    $ echo "You said: $TEXT" | vtt speak -e system -v Samantha

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
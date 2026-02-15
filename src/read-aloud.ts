import { Clipboard, environment, getPreferenceValues, getSelectedText, showHUD } from "@raycast/api";
import { execFile, spawn } from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { getActiveTtsVoice, isTtsVoiceDownloaded, ttsVoicesDir } from "./models";

const execFileAsync = promisify(execFile);

interface Preferences {
  ttsEngine: "none" | "piper" | "kokoro";
  ttsVoice: string;
  pythonPath: string;
}

function buildKokoroScript(text: string, voice: string, outputPath: string): string {
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  const v = voice || "af_heart";
  return [
    "import kokoro",
    "import soundfile as sf",
    `pipeline = kokoro.KPipeline(lang_code="${v[0]}${v[1]}")`,
    `audio, sr = pipeline("${escaped}", voice="${v}")`,
    `sf.write("${outputPath}", audio, sr)`,
  ].join("\n") + "\n";
}

async function speakWithPiper(text: string, pythonPath: string, voiceId: string): Promise<void> {
  const outputPath = join(environment.supportPath, `tts-${Date.now()}.wav`);
  const dataDir = ttsVoicesDir();

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(pythonPath, ["-m", "piper", "-m", voiceId, "--data-dir", dataDir, "-f", outputPath], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    proc.stdin.write(text);
    proc.stdin.end();
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `piper exited with code ${code}`));
      else resolve();
    });
    proc.on("error", reject);
  });

  const player = spawn("/bin/sh", ["-c", `afplay "${outputPath}" && rm -f "${outputPath}"`], {
    detached: true,
    stdio: "ignore",
  });
  player.unref();
}

async function speakWithKokoro(text: string, pythonPath: string, voice: string): Promise<void> {
  const outputPath = join(environment.supportPath, `tts-${Date.now()}.wav`);
  const scriptPath = join(environment.supportPath, "tts_kokoro.py");

  writeFileSync(scriptPath, buildKokoroScript(text, voice, outputPath));

  try {
    const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}` };
    await execFileAsync(pythonPath, [scriptPath], { timeout: 120_000, env });
  } finally {
    try { unlinkSync(scriptPath); } catch {}
  }

  const player = spawn("/bin/sh", ["-c", `afplay "${outputPath}" && rm -f "${outputPath}"`], {
    detached: true,
    stdio: "ignore",
  });
  player.unref();
}

export default async function Command() {
  const prefs = getPreferenceValues<Preferences>();

  let text: string | undefined;
  try {
    const selected = await getSelectedText();
    if (selected?.trim()) text = selected.trim();
  } catch {
    // No selection available
  }

  if (!text) {
    const clipboard = await Clipboard.readText();
    if (clipboard?.trim()) text = clipboard.trim();
  }

  if (!text) {
    await showHUD("No text selected and clipboard is empty");
    return;
  }

  // Determine engine: active managed voice implies piper, otherwise use preference
  const activeVoice = await getActiveTtsVoice();
  let engine = prefs.ttsEngine;
  let voiceId = prefs.ttsVoice;

  if (activeVoice && isTtsVoiceDownloaded(activeVoice)) {
    engine = "piper";
    voiceId = activeVoice;
  }

  if (engine === "none") {
    await showHUD("No TTS voice set. Use Manage Models to download one.");
    return;
  }

  if (engine === "piper" && !voiceId) {
    await showHUD("No TTS voice set. Use Manage Models to download one.");
    return;
  }

  if (engine === "kokoro") {
    try {
      await execFileAsync(prefs.pythonPath, ["-c", "import kokoro"]);
    } catch {
      await showHUD("kokoro not found. Install with: pip install kokoro");
      return;
    }
  }

  await showHUD("Speaking...");

  try {
    if (engine === "piper") {
      await speakWithPiper(text, prefs.pythonPath, voiceId);
    } else {
      await speakWithKokoro(text, prefs.pythonPath, prefs.ttsVoice);
    }
    const preview = text.length > 50 ? text.slice(0, 50) + "..." : text;
    await showHUD(`🔊 ${preview}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await showHUD(`TTS failed: ${msg.slice(0, 80)}`);
  }
}

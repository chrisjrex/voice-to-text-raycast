import { Clipboard, environment, getPreferenceValues, getSelectedText, showHUD, updateCommandMetadata } from "@raycast/api";
import { execFile, spawn } from "child_process";
import { existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { createConnection } from "net";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";
import { getActiveTtsVoice, getActiveKokoroVoice, isTtsVoiceDownloaded, ttsVoicesDir } from "./models";

const execFileAsync = promisify(execFile);

interface Preferences {
  ttsEngine: "none" | "piper" | "kokoro";
  pythonPath: string;
  kokoroPythonPath: string;
  kokoroServerMode: boolean;
}

function buildKokoroScript(text: string, voice: string, outputPath: string): string {
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  const v = voice || "af_heart";
  return [
    "from kokoro import KPipeline",
    "import soundfile as sf",
    "import numpy as np",
    `pipeline = KPipeline(lang_code="${v[0]}")`,
    `chunks = [audio for _, _, audio in pipeline("${escaped}", voice="${v}")]`,
    `sf.write("${outputPath}", np.concatenate(chunks), 24000)`,
  ].join("\n") + "\n";
}

const KOKORO_SOCK = `/tmp/kokoro_tts_${process.getuid()}.sock`;
const KOKORO_PID = join(environment.supportPath, "kokoro_server.pid");
const KOKORO_SERVER_SCRIPT = join(environment.supportPath, "kokoro_server.py");

function resolveKokoroPython(prefs: Preferences): string {
  const raw = prefs.kokoroPythonPath || "~/.local/lib-kokoro/venv/bin/python3";
  return raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
}

function buildKokoroServerScript(): string {
  return `
import json, os, signal, socket, sys, numpy as np, soundfile as sf
from kokoro import KPipeline

SOCK_PATH = ${JSON.stringify(KOKORO_SOCK)}
PID_PATH = ${JSON.stringify(KOKORO_PID)}

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

while True:
    conn, _ = sock.accept()
    try:
        handle_client(conn)
    finally:
        conn.close()
`.trimStart();
}

function isKokoroServerRunning(): Promise<boolean> {
  if (!existsSync(KOKORO_SOCK)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const conn = createConnection(KOKORO_SOCK);
    conn.on("connect", () => { conn.destroy(); resolve(true); });
    conn.on("error", () => resolve(false));
    setTimeout(() => { conn.destroy(); resolve(false); }, 500);
  });
}

const KOKORO_LOG = join(environment.supportPath, "kokoro_server.log");

async function startKokoroServer(pythonPath: string): Promise<void> {
  writeFileSync(KOKORO_SERVER_SCRIPT, buildKokoroServerScript());
  writeFileSync(KOKORO_LOG, "");
  const logFd = openSync(KOKORO_LOG, "a");
  const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}` };
  const proc = spawn(pythonPath, [KOKORO_SERVER_SCRIPT], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env,
  });
  proc.unref();

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isKokoroServerRunning()) return;
    if (existsSync(KOKORO_LOG)) {
      const log = readFileSync(KOKORO_LOG, "utf-8").trim();
      if (log.includes("Traceback") || log.includes("Error")) {
        const lastLines = log.split("\n").slice(-3).join(" ");
        throw new Error(lastLines.slice(0, 120));
      }
    }
  }
  const log = existsSync(KOKORO_LOG) ? readFileSync(KOKORO_LOG, "utf-8").trim() : "";
  const tail = log ? log.split("\n").slice(-3).join(" ").slice(0, 120) : "no output";
  throw new Error(`Server failed to start within 8s: ${tail}`);
}

async function speakWithKokoroServer(text: string, voice: string): Promise<void> {
  const outputPath = join(environment.supportPath, `tts-${Date.now()}.wav`);
  const v = voice || "af_heart";
  const request = JSON.stringify({ text, voice: v, output: outputPath }) + "\n";

  const response = await new Promise<string>((resolve, reject) => {
    const conn = createConnection(KOKORO_SOCK);
    let data = "";
    conn.on("connect", () => conn.write(request));
    conn.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      if (data.includes("\n")) { conn.destroy(); resolve(data.trim()); }
    });
    conn.on("error", reject);
    setTimeout(() => { conn.destroy(); reject(new Error("Server response timeout")); }, 120_000);
  });

  if (!response.startsWith("ok")) {
    throw new Error(response);
  }

  startPlayback(outputPath);
}

function stopKokoroServer(): void {
  try {
    const pid = readFileSync(KOKORO_PID, "utf-8").trim();
    process.kill(Number(pid), "SIGTERM");
  } catch {
    try { unlinkSync(KOKORO_SOCK); } catch {}
    try { unlinkSync(KOKORO_PID); } catch {}
  }
}

export { KOKORO_PID, KOKORO_SOCK, isKokoroServerRunning, startKokoroServer, stopKokoroServer, resolveKokoroPython };
export type { Preferences as ReadAloudPreferences };

const PLAYBACK_PID = join(environment.supportPath, "tts_playback.pid");

function isPlaying(): boolean {
  try {
    const pid = Number(readFileSync(PLAYBACK_PID, "utf-8").trim());
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopCurrentPlayback(): void {
  try {
    const pid = Number(readFileSync(PLAYBACK_PID, "utf-8").trim());
    process.kill(pid, "SIGTERM");
  } catch {}
  try { unlinkSync(PLAYBACK_PID); } catch {}
}

function startPlayback(outputPath: string): void {
  stopCurrentPlayback();
  const player = spawn("afplay", [outputPath], {
    detached: true,
    stdio: "ignore",
  });
  writeFileSync(PLAYBACK_PID, String(player.pid));
  player.on("exit", () => {
    try { unlinkSync(outputPath); } catch {}
    try { unlinkSync(PLAYBACK_PID); } catch {}
  });
  player.unref();
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

  startPlayback(outputPath);
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

  startPlayback(outputPath);
}

export default async function Command() {
  const prefs = getPreferenceValues<Preferences>();
  const playing = isPlaying();

  let selectedText: string | undefined;
  try {
    const selected = await getSelectedText();
    if (selected?.trim()) selectedText = selected.trim();
  } catch {}

  if (playing && !selectedText) {
    stopCurrentPlayback();
    await updateCommandMetadata({ subtitle: "" });
    await showHUD("Stopped reading");
    return;
  }

  stopCurrentPlayback();

  const text = selectedText ?? (await Clipboard.readText())?.trim();

  if (!text) {
    await updateCommandMetadata({ subtitle: "" });
    await showHUD("No text selected and clipboard is empty");
    return;
  }

  const activePiperVoice = await getActiveTtsVoice();
  const activeKokoro = await getActiveKokoroVoice();
  let engine = prefs.ttsEngine;
  let voiceId = "";

  if (activeKokoro) {
    engine = "kokoro";
    voiceId = activeKokoro;
  } else if (activePiperVoice && isTtsVoiceDownloaded(activePiperVoice)) {
    engine = "piper";
    voiceId = activePiperVoice;
  }

  if (engine === "none") {
    await showHUD("No TTS voice set. Use Manage Models to select one.");
    return;
  }

  if (engine === "piper" && !voiceId) {
    await showHUD("No Piper voice set. Use Manage Models to download one.");
    return;
  }

  const kokoroPython = resolveKokoroPython(prefs);

  if (engine === "kokoro" && !prefs.kokoroServerMode) {
    try {
      await execFileAsync(kokoroPython, ["-c", "import kokoro"]);
    } catch {
      await showHUD("kokoro not found. Check Kokoro Python Path in preferences.");
      return;
    }
  }

  try {
    if (engine === "piper") {
      await showHUD("Speaking...");
      await speakWithPiper(text, prefs.pythonPath, voiceId);
    } else if (prefs.kokoroServerMode) {
      if (!await isKokoroServerRunning()) {
        await showHUD("Starting Kokoro server...");
        await startKokoroServer(kokoroPython);
      }
      await showHUD("Speaking...");
      await speakWithKokoroServer(text, voiceId);
    } else {
      await showHUD("Speaking...");
      await speakWithKokoro(text, kokoroPython, voiceId);
    }
    await updateCommandMetadata({ subtitle: "Speaking" });
    const preview = text.length > 50 ? text.slice(0, 50) + "..." : text;
    await showHUD(`🔊 ${preview}`);
  } catch (err: unknown) {
    await updateCommandMetadata({ subtitle: "" });
    const msg = err instanceof Error ? err.message : String(err);
    await showHUD(`TTS failed: ${msg.slice(0, 80)}`);
  }
}

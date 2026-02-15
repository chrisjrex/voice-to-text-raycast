import {
  Clipboard,
  environment,
  getPreferenceValues,
  getSelectedText,
  showHUD,
  updateCommandMetadata,
} from "@raycast/api";
import { spawn } from "child_process";
import {
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { createConnection } from "net";
import { homedir } from "os";
import { join } from "path";
import {
  getActiveTtsVoice,
  getActiveKokoroVoice,
  getActiveSystemVoice,
  isTtsVoiceDownloaded,
  ttsVoicesDir,
  ensureDefaultTtsVoice,
} from "./models";

interface Preferences {
  pythonPath: string;
  kokoroPythonPath: string;
}

const KOKORO_SOCK = `/tmp/kokoro_tts_${process.getuid?.() ?? 0}.sock`;
const KOKORO_PID = join(environment.supportPath, "kokoro_server.pid");
const KOKORO_SERVER_SCRIPT = join(environment.supportPath, "kokoro_server.py");

function resolveKokoroPython(prefs: Preferences): string {
  const raw = prefs.kokoroPythonPath || "~/.local/lib-kokoro/venv/bin/python3";
  const resolved = raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
  if (!prefs.kokoroPythonPath && !existsSync(resolved)) return prefs.pythonPath;
  return resolved;
}

function buildKokoroServerScript(idleTimeout = 120): string {
  return `
import json, os, select, signal, socket, sys, time, numpy as np, soundfile as sf
from kokoro import KPipeline

SOCK_PATH = ${JSON.stringify(KOKORO_SOCK)}
PID_PATH = ${JSON.stringify(KOKORO_PID)}
IDLE_TIMEOUT = ${idleTimeout}

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

last_activity = time.monotonic()
while True:
    ready, _, _ = select.select([sock], [], [], 10)
    if not ready:
        if time.monotonic() - last_activity >= IDLE_TIMEOUT:
            cleanup()
        continue
    conn, _ = sock.accept()
    try:
        handle_client(conn)
    finally:
        conn.close()
    last_activity = time.monotonic()
`.trimStart();
}

function isKokoroServerRunning(): Promise<boolean> {
  if (!existsSync(KOKORO_SOCK)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const conn = createConnection(KOKORO_SOCK);
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

const KOKORO_LOG = join(environment.supportPath, "kokoro_server.log");

async function startKokoroServer(
  pythonPath: string,
  idleTimeout = 120,
): Promise<void> {
  writeFileSync(KOKORO_SERVER_SCRIPT, buildKokoroServerScript(idleTimeout));
  writeFileSync(KOKORO_LOG, "");
  const logFd = openSync(KOKORO_LOG, "a");
  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
  };
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
  const log = existsSync(KOKORO_LOG)
    ? readFileSync(KOKORO_LOG, "utf-8").trim()
    : "";
  const tail = log
    ? log.split("\n").slice(-3).join(" ").slice(0, 120)
    : "no output";
  throw new Error(`Server failed to start within 8s: ${tail}`);
}

async function speakWithKokoroServer(
  text: string,
  voice: string,
): Promise<void> {
  const outputPath = join(environment.supportPath, `tts-${Date.now()}.wav`);
  const v = voice || "af_heart";
  const request = JSON.stringify({ text, voice: v, output: outputPath }) + "\n";

  const response = await new Promise<string>((resolve, reject) => {
    const conn = createConnection(KOKORO_SOCK);
    let data = "";
    conn.on("connect", () => conn.write(request));
    conn.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      if (data.includes("\n")) {
        conn.destroy();
        resolve(data.trim());
      }
    });
    conn.on("error", reject);
    setTimeout(() => {
      conn.destroy();
      reject(new Error("Server response timeout"));
    }, 120_000);
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
    try {
      unlinkSync(KOKORO_SOCK);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(KOKORO_PID);
    } catch {
      /* ignore */
    }
  }
}

export {
  KOKORO_PID,
  KOKORO_SOCK,
  isKokoroServerRunning,
  startKokoroServer,
  stopKokoroServer,
  resolveKokoroPython,
  buildKokoroServerScript,
};
export type { Preferences as ReadAloudPreferences };

export const PLAYBACK_PID = join(environment.supportPath, "tts_playback.pid");

function isPlaying(): boolean {
  try {
    const pid = Number(readFileSync(PLAYBACK_PID, "utf-8").trim());
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function stopCurrentPlayback(): void {
  try {
    const pid = Number(readFileSync(PLAYBACK_PID, "utf-8").trim());
    process.kill(pid, "SIGTERM");
  } catch {
    /* ignore */
  }
  try {
    unlinkSync(PLAYBACK_PID);
  } catch {
    /* ignore */
  }
}

function startPlayback(outputPath: string): void {
  stopCurrentPlayback();
  const player = spawn("afplay", [outputPath], {
    detached: true,
    stdio: "ignore",
  });
  writeFileSync(PLAYBACK_PID, String(player.pid));
  player.on("exit", () => {
    try {
      unlinkSync(outputPath);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(PLAYBACK_PID);
    } catch {
      /* ignore */
    }
  });
  player.unref();
}

async function speakWithKokoroColdStart(
  text: string,
  pythonPath: string,
  voice: string,
): Promise<void> {
  const outputPath = join(environment.supportPath, `tts-${Date.now()}.wav`);
  const v = voice || "af_heart";
  const script = `
import sys, json, numpy as np, soundfile as sf
from kokoro import KPipeline
req = json.loads(sys.stdin.readline())
pipeline = KPipeline(lang_code=req["voice"][0])
chunks = [audio for _, _, audio in pipeline(req["text"], voice=req["voice"])]
sf.write(req["output"], np.concatenate(chunks), 24000)
`.trim();

  const input = JSON.stringify({ text, voice: v, output: outputPath }) + "\n";
  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
  };

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(pythonPath, ["-c", script], {
      stdio: ["pipe", "ignore", "pipe"],
      env,
    });
    proc.stdin.write(input);
    proc.stdin.end();
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0)
        reject(new Error(stderr || `kokoro exited with code ${code}`));
      else resolve();
    });
    proc.on("error", reject);
  });

  startPlayback(outputPath);
}

async function speakWithPiper(
  text: string,
  pythonPath: string,
  voiceId: string,
): Promise<void> {
  const outputPath = join(environment.supportPath, `tts-${Date.now()}.wav`);
  const dataDir = ttsVoicesDir();

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      pythonPath,
      ["-m", "piper", "-m", voiceId, "--data-dir", dataDir, "-f", outputPath],
      {
        stdio: ["pipe", "ignore", "pipe"],
      },
    );
    proc.stdin.write(text);
    proc.stdin.end();
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0)
        reject(new Error(stderr || `piper exited with code ${code}`));
      else resolve();
    });
    proc.on("error", reject);
  });

  startPlayback(outputPath);
}

function speakWithSay(text: string, voice: string): void {
  stopCurrentPlayback();
  const child = spawn("say", ["-v", voice, text], {
    detached: true,
    stdio: "ignore",
  });
  if (child.pid) {
    writeFileSync(PLAYBACK_PID, String(child.pid));
  }
  child.on("exit", () => {
    try {
      unlinkSync(PLAYBACK_PID);
    } catch {
      /* ignore */
    }
  });
  child.unref();
}

export async function speakText(text: string): Promise<void> {
  const prefs = getPreferenceValues<Preferences>();

  stopCurrentPlayback();

  await ensureDefaultTtsVoice();
  const activeSystem = await getActiveSystemVoice();
  const activeKokoro = await getActiveKokoroVoice();
  const activePiperVoice = await getActiveTtsVoice();

  if (activeSystem) {
    await speakWithSay(text, activeSystem);
    return;
  }

  if (activeKokoro) {
    if (await isKokoroServerRunning()) {
      await speakWithKokoroServer(text, activeKokoro);
    } else {
      const kokoroPython = resolveKokoroPython(prefs);
      await speakWithKokoroColdStart(text, kokoroPython, activeKokoro);
    }
    return;
  }

  if (activePiperVoice && isTtsVoiceDownloaded(activePiperVoice)) {
    await speakWithPiper(text, prefs.pythonPath, activePiperVoice);
    return;
  }

  throw new Error("No TTS voice set. Use Manage Models to select one.");
}

export default async function Command() {
  const playing = isPlaying();

  let selectedText: string | undefined;
  try {
    const selected = await getSelectedText();
    if (selected?.trim()) selectedText = selected.trim();
  } catch {
    /* ignore */
  }

  if (playing && !selectedText) {
    stopCurrentPlayback();
    await updateCommandMetadata({ subtitle: "" });
    await showHUD("Stopped reading");
    return;
  }

  const text = selectedText ?? (await Clipboard.readText())?.trim();

  if (!text) {
    await updateCommandMetadata({ subtitle: "" });
    await showHUD("No text selected and clipboard is empty");
    return;
  }

  try {
    await speakText(text);
    await showHUD("Speaking...");
  } catch (err: unknown) {
    await updateCommandMetadata({ subtitle: "" });
    const msg = err instanceof Error ? err.message : String(err);
    await showHUD(`TTS failed: ${msg.slice(0, 80)}`);
  }
}

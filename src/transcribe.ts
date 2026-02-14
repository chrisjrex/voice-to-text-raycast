import { execFile } from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export function parseModel(pref: string): { provider: "whisper" | "parakeet"; modelId: string } {
  const idx = pref.indexOf(":");
  const provider = pref.slice(0, idx) as "whisper" | "parakeet";
  const modelId = pref.slice(idx + 1);
  return { provider, modelId };
}

export function buildTranscribeScript(provider: string, modelId: string, audioPath: string): string {
  const escapedPath = audioPath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  if (provider === "whisper") {
    return [
      "import mlx_whisper",
      `r = mlx_whisper.transcribe("${escapedPath}", path_or_hf_repo="${modelId}")`,
      `print(r["text"], end="")`,
    ].join("\n") + "\n";
  }
  return [
    "from parakeet_mlx import from_pretrained",
    `model = from_pretrained("${modelId}")`,
    `r = model.transcribe("${escapedPath}")`,
    `print(r.text, end="")`,
  ].join("\n") + "\n";
}

export async function transcribe(
  pythonPath: string,
  provider: string,
  modelId: string,
  audioPath: string,
  scriptPath: string,
): Promise<string> {
  writeFileSync(scriptPath, buildTranscribeScript(provider, modelId, audioPath));
  try {
    const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}` };
    const { stdout } = await execFileAsync(pythonPath, [scriptPath], { timeout: 120_000, env });
    return stdout.trim();
  } finally {
    try { unlinkSync(scriptPath); } catch {}
  }
}

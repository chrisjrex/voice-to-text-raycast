import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { join } from "path";
import { parseModel, buildTranscribeScript, transcribe } from "../transcribe";

const PYTHON = "/opt/homebrew/bin/python3";
const FIXTURE_WAV = join(__dirname, "fixtures", "speech.wav");

describe("parseModel", () => {
  it("parses whisper model", () => {
    const result = parseModel("whisper:mlx-community/whisper-tiny");
    expect(result).toEqual({ provider: "whisper", modelId: "mlx-community/whisper-tiny" });
  });

  it("parses parakeet model", () => {
    const result = parseModel("parakeet:mlx-community/parakeet-tdt-0.6b-v2");
    expect(result).toEqual({ provider: "parakeet", modelId: "mlx-community/parakeet-tdt-0.6b-v2" });
  });

  it("handles model IDs with multiple colons", () => {
    const result = parseModel("whisper:org/model:variant");
    expect(result).toEqual({ provider: "whisper", modelId: "org/model:variant" });
  });
});

describe("buildTranscribeScript", () => {
  it("generates whisper script", () => {
    const script = buildTranscribeScript("whisper", "mlx-community/whisper-tiny", "/tmp/audio.wav");
    expect(script).toContain("import mlx_whisper");
    expect(script).toContain('path_or_hf_repo="mlx-community/whisper-tiny"');
    expect(script).toContain('print(r["text"], end="")');
  });

  it("generates parakeet script", () => {
    const script = buildTranscribeScript("parakeet", "mlx-community/parakeet-tdt-0.6b-v2", "/tmp/audio.wav");
    expect(script).toContain("from parakeet_mlx import from_pretrained");
    expect(script).toContain('from_pretrained("mlx-community/parakeet-tdt-0.6b-v2")');
    expect(script).toContain("print(r.text, end=");
  });

  it("escapes quotes in audio path", () => {
    const script = buildTranscribeScript("whisper", "model", '/tmp/has"quote.wav');
    expect(script).toContain('/tmp/has\\"quote.wav');
  });

  it("escapes backslashes in audio path", () => {
    const script = buildTranscribeScript("whisper", "model", "C:\\Users\\audio.wav");
    expect(script).toContain("C:\\\\Users\\\\audio.wav");
  });

  it("produces valid python syntax for whisper", () => {
    const script = buildTranscribeScript("whisper", "mlx-community/whisper-tiny", "/tmp/a.wav");
    execFileSync(PYTHON, ["-c", `import ast; ast.parse(${JSON.stringify(script)})`]);
  });

  it("produces valid python syntax for parakeet", () => {
    const script = buildTranscribeScript("parakeet", "mlx-community/parakeet-tdt-0.6b-v2", "/tmp/a.wav");
    execFileSync(PYTHON, ["-c", `import ast; ast.parse(${JSON.stringify(script)})`]);
  });
});

describe("transcribe integration", () => {
  it("transcribes with whisper-tiny", async () => {
    const text = await transcribe(
      PYTHON,
      "whisper",
      "mlx-community/whisper-tiny",
      FIXTURE_WAV,
      join(__dirname, "fixtures", "_tmp_script.py"),
    );
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toMatch(/quick|brown|fox|lazy|dog/);
  }, 120_000);

  it("transcribes with parakeet-0.6b", async () => {
    const text = await transcribe(
      PYTHON,
      "parakeet",
      "mlx-community/parakeet-tdt-0.6b-v2",
      FIXTURE_WAV,
      join(__dirname, "fixtures", "_tmp_script.py"),
    );
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toMatch(/quick|brown|fox|lazy|dog/);
  }, 120_000);
});

import { getSTTEngine, getModelByAlias, type ModelInfo } from "@voicekit/core";

export function parseModel(pref: string): {
  provider: "whisper" | "parakeet";
  modelId: string;
  modelInfo: ModelInfo | undefined;
} {
  const idx = pref.indexOf(":");
  const provider = pref.slice(0, idx) as "whisper" | "parakeet";
  const modelId = pref.slice(idx + 1);

  const modelInfo = getModelByAlias(
    `${provider === "whisper" ? "whisper" : "parakeet"}-${modelId.split("/")[1]?.split("-")[0] || "tiny"}`,
  );

  return { provider, modelId, modelInfo };
}

export async function transcribe(
  pythonPath: string,
  provider: string,
  modelId: string,
  audioPath: string,
): Promise<string> {
  const modelAlias = modelId.includes("whisper")
    ? `whisper-${modelId.split("-").pop() || "tiny"}`
    : `parakeet-${modelId.split("-").pop() || "110m"}`;

  const model = getModelByAlias(modelAlias);
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const engine = getSTTEngine(model);
  const config = {
    pythonPath,
    kokoroPythonPath: pythonPath,
    soxPath: "/opt/homebrew/bin/sox",
    dataDir: "",
    kokoroSocket: "",
    kokoroIdleTimeout: 120,
    defaultSTTModel: "",
    defaultTTSEngine: "",
    defaultTTSVoice: "",
    logLevel: "info" as const,
  };

  return engine.transcribe(audioPath, model, config);
}

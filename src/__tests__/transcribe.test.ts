import { describe, expect, it } from "vitest";
import { parseModel } from "../transcribe";

describe("parseModel", () => {
  it("parses whisper model", () => {
    const result = parseModel("whisper:mlx-community/whisper-tiny");
    expect(result).toEqual({
      provider: "whisper",
      modelId: "mlx-community/whisper-tiny",
    });
  });

  it("parses parakeet model", () => {
    const result = parseModel("parakeet:mlx-community/parakeet-tdt-0.6b-v2");
    expect(result).toEqual({
      provider: "parakeet",
      modelId: "mlx-community/parakeet-tdt-0.6b-v2",
    });
  });

  it("handles model IDs with multiple colons", () => {
    const result = parseModel("whisper:org/model:variant");
    expect(result).toEqual({
      provider: "whisper",
      modelId: "org/model:variant",
    });
  });
});

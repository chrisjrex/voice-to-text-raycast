import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  modelIdFromValue,
  isModelDownloaded,
  isTtsVoiceDownloaded,
} from "../models";
import { existsSync, readdirSync } from "fs";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn(), readdirSync: vi.fn() };
});

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);

describe("modelIdFromValue", () => {
  it("extracts model ID after first colon", () => {
    expect(modelIdFromValue("whisper:mlx-community/whisper-tiny")).toBe("mlx-community/whisper-tiny");
  });

  it("handles multiple colons", () => {
    expect(modelIdFromValue("whisper:org/model:variant")).toBe("org/model:variant");
  });
});

describe("isModelDownloaded", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true when snapshots directory has entries", () => {
    mockReaddirSync.mockReturnValue(["abc123" as unknown as import("fs").Dirent]);
    expect(isModelDownloaded("mlx-community/whisper-tiny")).toBe(true);
  });

  it("returns false when snapshots directory is empty", () => {
    mockReaddirSync.mockReturnValue([]);
    expect(isModelDownloaded("mlx-community/whisper-tiny")).toBe(false);
  });

  it("returns false when snapshots directory does not exist", () => {
    mockReaddirSync.mockImplementation(() => { throw new Error("ENOENT"); });
    expect(isModelDownloaded("mlx-community/whisper-tiny")).toBe(false);
  });
});

describe("isTtsVoiceDownloaded", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true when both onnx and json exist", () => {
    mockExistsSync.mockReturnValue(true);
    expect(isTtsVoiceDownloaded("en_US-amy-medium")).toBe(true);
  });

  it("returns false when onnx file is missing", () => {
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(isTtsVoiceDownloaded("en_US-amy-medium")).toBe(false);
  });
});

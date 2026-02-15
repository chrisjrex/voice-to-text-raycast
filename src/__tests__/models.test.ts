import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  modelIdFromValue,
  isModelDownloaded,
  isTtsVoiceDownloaded,
  isKokoroModelDownloaded,
  isKokoroVoiceDownloaded,
  ensureDefaultTtsVoice,
  getActiveModel,
  setActiveModel,
  getActiveTtsVoice,
  setActiveTtsVoice,
  clearActiveTtsVoice,
  getActiveKokoroVoice,
  setActiveKokoroVoice,
  clearActiveKokoroVoice,
  getActiveSystemVoice,
  setActiveSystemVoice,
  clearActiveSystemVoice,
} from "../models";
import { existsSync, readdirSync } from "fs";
import { LocalStorage } from "@raycast/api";

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

describe("isKokoroModelDownloaded", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true when kokoro-v1_0.pth exists in snapshot", () => {
    mockReaddirSync.mockReturnValue(["snapshot1" as unknown as import("fs").Dirent]);
    mockExistsSync.mockReturnValue(true);
    expect(isKokoroModelDownloaded()).toBe(true);
  });

  it("returns false when no snapshot directory exists", () => {
    mockReaddirSync.mockImplementation(() => { throw new Error("ENOENT"); });
    expect(isKokoroModelDownloaded()).toBe(false);
  });

  it("returns false when model file is missing from snapshot", () => {
    mockReaddirSync.mockReturnValue(["snapshot1" as unknown as import("fs").Dirent]);
    mockExistsSync.mockReturnValue(false);
    expect(isKokoroModelDownloaded()).toBe(false);
  });
});

describe("isKokoroVoiceDownloaded", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true when voice .pt file exists in snapshot", () => {
    mockReaddirSync.mockReturnValue(["snapshot1" as unknown as import("fs").Dirent]);
    mockExistsSync.mockReturnValue(true);
    expect(isKokoroVoiceDownloaded("af_heart")).toBe(true);
  });

  it("returns false when no snapshot exists", () => {
    mockReaddirSync.mockImplementation(() => { throw new Error("ENOENT"); });
    expect(isKokoroVoiceDownloaded("af_heart")).toBe(false);
  });

  it("returns false when voice file is missing", () => {
    mockReaddirSync.mockReturnValue(["snapshot1" as unknown as import("fs").Dirent]);
    mockExistsSync.mockReturnValue(false);
    expect(isKokoroVoiceDownloaded("af_heart")).toBe(false);
  });
});

describe("ensureDefaultTtsVoice", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await LocalStorage.clear();
  });

  it("sets Samantha when no voice is active", async () => {
    await ensureDefaultTtsVoice();

    expect(await getActiveSystemVoice()).toBe("Samantha");
  });

  it("is a no-op when a voice is already set", async () => {
    await setActiveSystemVoice("Alex");

    await ensureDefaultTtsVoice();

    expect(await getActiveSystemVoice()).toBe("Alex");
  });

  it("is a no-op on subsequent calls", async () => {
    await ensureDefaultTtsVoice();
    expect(await getActiveSystemVoice()).toBe("Samantha");

    await clearActiveSystemVoice();
    await ensureDefaultTtsVoice();

    // initialized flag prevents re-setting
    expect(await getActiveSystemVoice()).toBeUndefined();
  });
});

describe("active voice persistence", () => {
  beforeEach(async () => {
    await LocalStorage.clear();
  });

  it("round-trips active model", async () => {
    await setActiveModel("whisper:mlx-community/whisper-tiny");
    expect(await getActiveModel()).toBe("whisper:mlx-community/whisper-tiny");
  });

  it("round-trips active piper voice", async () => {
    await setActiveTtsVoice("en_US-amy-medium");
    expect(await getActiveTtsVoice()).toBe("en_US-amy-medium");
  });

  it("round-trips active kokoro voice", async () => {
    await setActiveKokoroVoice("af_heart");
    expect(await getActiveKokoroVoice()).toBe("af_heart");
  });

  it("round-trips active system voice", async () => {
    await setActiveSystemVoice("Samantha");
    expect(await getActiveSystemVoice()).toBe("Samantha");
  });
});

describe("clear functions", () => {
  beforeEach(async () => {
    await LocalStorage.clear();
  });

  it("clearActiveTtsVoice removes stored value", async () => {
    await setActiveTtsVoice("en_US-amy-medium");
    await clearActiveTtsVoice();
    expect(await getActiveTtsVoice()).toBeUndefined();
  });

  it("clearActiveKokoroVoice removes stored value", async () => {
    await setActiveKokoroVoice("af_heart");
    await clearActiveKokoroVoice();
    expect(await getActiveKokoroVoice()).toBeUndefined();
  });

  it("clearActiveSystemVoice removes stored value", async () => {
    await setActiveSystemVoice("Samantha");
    await clearActiveSystemVoice();
    expect(await getActiveSystemVoice()).toBeUndefined();
  });
});

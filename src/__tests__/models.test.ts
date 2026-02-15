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
  installPiperEngine,
  uninstallPiperEngine,
  installKokoroEngine,
  uninstallKokoroEngine,
} from "../models";
import { existsSync, readdirSync, rmSync } from "fs";
import { execFile } from "child_process";
import { LocalStorage } from "@raycast/api";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    rmSync: vi.fn(),
  };
});
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return { ...actual, execFile: vi.fn() };
});

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);

describe("modelIdFromValue", () => {
  it("extracts model ID after first colon", () => {
    expect(modelIdFromValue("whisper:mlx-community/whisper-tiny")).toBe(
      "mlx-community/whisper-tiny",
    );
  });

  it("handles multiple colons", () => {
    expect(modelIdFromValue("whisper:org/model:variant")).toBe(
      "org/model:variant",
    );
  });
});

describe("isModelDownloaded", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true when snapshots directory has entries", () => {
    mockReaddirSync.mockReturnValue([
      "abc123" as unknown as import("fs").Dirent,
    ]);
    expect(isModelDownloaded("mlx-community/whisper-tiny")).toBe(true);
  });

  it("returns false when snapshots directory is empty", () => {
    mockReaddirSync.mockReturnValue([]);
    expect(isModelDownloaded("mlx-community/whisper-tiny")).toBe(false);
  });

  it("returns false when snapshots directory does not exist", () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
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
    mockReaddirSync.mockReturnValue([
      "snapshot1" as unknown as import("fs").Dirent,
    ]);
    mockExistsSync.mockReturnValue(true);
    expect(isKokoroModelDownloaded()).toBe(true);
  });

  it("returns false when no snapshot directory exists", () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(isKokoroModelDownloaded()).toBe(false);
  });

  it("returns false when model file is missing from snapshot", () => {
    mockReaddirSync.mockReturnValue([
      "snapshot1" as unknown as import("fs").Dirent,
    ]);
    mockExistsSync.mockReturnValue(false);
    expect(isKokoroModelDownloaded()).toBe(false);
  });
});

describe("isKokoroVoiceDownloaded", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true when voice .pt file exists in snapshot", () => {
    mockReaddirSync.mockReturnValue([
      "snapshot1" as unknown as import("fs").Dirent,
    ]);
    mockExistsSync.mockReturnValue(true);
    expect(isKokoroVoiceDownloaded("af_heart")).toBe(true);
  });

  it("returns false when no snapshot exists", () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(isKokoroVoiceDownloaded("af_heart")).toBe(false);
  });

  it("returns false when voice file is missing", () => {
    mockReaddirSync.mockReturnValue([
      "snapshot1" as unknown as import("fs").Dirent,
    ]);
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

// Helper to make execFile invoke its callback successfully
function mockExecFileSuccess() {
  vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, cb) => {
    if (typeof cb === "function") (cb as (err: Error | null) => void)(null);
    return {} as ReturnType<typeof execFile>;
  });
}

function mockExecFileFailure(msg: string) {
  vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, cb) => {
    if (typeof cb === "function")
      (cb as (err: Error | null) => void)(new Error(msg));
    return {} as ReturnType<typeof execFile>;
  });
}

describe("installPiperEngine", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls pip install piper-tts", async () => {
    mockExecFileSuccess();
    await installPiperEngine("/usr/bin/python3");
    expect(execFile).toHaveBeenCalledWith(
      "/usr/bin/python3",
      ["-m", "pip", "install", "--break-system-packages", "piper-tts"],
      expect.objectContaining({ timeout: 300_000 }),
      expect.any(Function),
    );
  });

  it("rejects on failure", async () => {
    mockExecFileFailure("pip error");
    await expect(installPiperEngine("/usr/bin/python3")).rejects.toThrow(
      "pip error",
    );
  });
});

describe("uninstallPiperEngine", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("removes voice directory and calls pip uninstall", async () => {
    mockExecFileSuccess();
    await uninstallPiperEngine("/usr/bin/python3");
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining("tts-voices"), {
      recursive: true,
      force: true,
    });
    expect(execFile).toHaveBeenCalledWith(
      "/usr/bin/python3",
      ["-m", "pip", "uninstall", "--break-system-packages", "-y", "piper-tts"],
      expect.objectContaining({ timeout: 60_000 }),
      expect.any(Function),
    );
  });
});

describe("installKokoroEngine", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates venv when kokoroPython does not exist, then pip installs", async () => {
    mockExistsSync.mockReturnValue(false);
    const calls: string[] = [];
    vi.mocked(execFile).mockImplementation((cmd, _args, _opts, cb) => {
      calls.push(cmd as string);
      if (typeof cb === "function") (cb as (err: Error | null) => void)(null);
      return {} as ReturnType<typeof execFile>;
    });

    await installKokoroEngine("/usr/bin/python3", "/tmp/venv/bin/python3");

    expect(calls).toEqual(["/usr/bin/python3", "/tmp/venv/bin/python3"]);
  });

  it("skips venv creation when kokoroPython exists", async () => {
    mockExistsSync.mockReturnValue(true);
    mockExecFileSuccess();

    await installKokoroEngine("/usr/bin/python3", "/tmp/venv/bin/python3");

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile).toHaveBeenCalledWith(
      "/tmp/venv/bin/python3",
      ["-m", "pip", "install", "kokoro", "soundfile", "numpy"],
      expect.anything(),
      expect.any(Function),
    );
  });
});

describe("uninstallKokoroEngine", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("removes model cache and pip uninstalls when python exists", async () => {
    mockExistsSync.mockReturnValue(true);
    mockExecFileSuccess();

    await uninstallKokoroEngine("/tmp/venv/bin/python3");

    expect(rmSync).toHaveBeenCalledWith(
      expect.stringContaining("models--hexgrad--Kokoro-82M"),
      { recursive: true, force: true },
    );
    expect(execFile).toHaveBeenCalledWith(
      "/tmp/venv/bin/python3",
      ["-m", "pip", "uninstall", "-y", "kokoro", "soundfile", "numpy"],
      expect.anything(),
      expect.any(Function),
    );
  });

  it("skips pip uninstall when python does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await uninstallKokoroEngine("/tmp/venv/bin/python3");

    expect(rmSync).toHaveBeenCalled();
    expect(execFile).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    openSync: vi.fn(() => 3),
  };
});
vi.mock("net", () => ({
  createConnection: vi.fn(),
}));
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    spawn: vi.fn(() => ({
      pid: 1234,
      unref: vi.fn(),
      on: vi.fn(),
    })),
  };
});
vi.mock("../models", () => ({
  getActiveTtsVoice: vi.fn(async () => undefined),
  getActiveKokoroVoice: vi.fn(async () => undefined),
  getActiveSystemVoice: vi.fn(async () => undefined),
  isTtsVoiceDownloaded: vi.fn(() => false),
  ttsVoicesDir: vi.fn(() => "/tmp/test-voices"),
  ensureDefaultTtsVoice: vi.fn(async () => {}),
}));

import {
  speakText,
  isKokoroServerRunning,
  buildKokoroServerScript,
} from "../read-aloud";
import { readFileSync, existsSync } from "fs";
import { createConnection } from "net";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import {
  getActiveSystemVoice,
  getActiveKokoroVoice,
  getActiveTtsVoice,
  isTtsVoiceDownloaded,
} from "../models";
import * as raycastApi from "@raycast/api";
import { _setPrefs, _setSelectedText, _setClipboardText } from "@raycast/api";

_setPrefs({ pythonPath: "/opt/homebrew/bin/python3", kokoroPythonPath: "" });

const showHUDSpy = vi.spyOn(raycastApi, "showHUD");

describe("Read Aloud Command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _setSelectedText("");
    _setClipboardText(undefined);
    // Default: not playing (readFileSync throws → isPlaying returns false)
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    vi.mocked(existsSync).mockReturnValue(false);
    // Default: system voice active so speakText succeeds
    vi.mocked(getActiveSystemVoice).mockResolvedValue("Samantha");
    vi.mocked(getActiveKokoroVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveTtsVoice).mockResolvedValue(undefined);
  });

  async function runCommand() {
    const mod = await import("../read-aloud");
    return mod.default();
  }

  it("speaks selected text and shows Speaking HUD", async () => {
    _setSelectedText("Hello world");

    await runCommand();

    expect(showHUDSpy).toHaveBeenCalledWith("Speaking...");
    expect(spawn).toHaveBeenCalledWith(
      "say",
      expect.arrayContaining(["Hello world"]),
      expect.anything(),
    );
  });

  it("falls back to clipboard when no text is selected", async () => {
    _setSelectedText("");
    _setClipboardText("clipboard content");

    await runCommand();

    expect(showHUDSpy).toHaveBeenCalledWith("Speaking...");
    expect(spawn).toHaveBeenCalledWith(
      "say",
      expect.arrayContaining(["clipboard content"]),
      expect.anything(),
    );
  });

  it("shows error when no text anywhere", async () => {
    _setSelectedText("");
    _setClipboardText(undefined);

    await runCommand();

    expect(showHUDSpy).toHaveBeenCalledWith(
      "No text selected and clipboard is empty",
    );
  });

  it("stops playback when already playing and no new text", async () => {
    // Simulate a playing process
    vi.mocked(readFileSync).mockReturnValue("9999");
    vi.spyOn(process, "kill").mockImplementation(() => true);
    _setSelectedText("");

    await runCommand();

    expect(showHUDSpy).toHaveBeenCalledWith("Stopped reading");
  });

  it("speaks new text even when already playing", async () => {
    // Simulate a playing process
    vi.mocked(readFileSync).mockReturnValue("9999");
    vi.spyOn(process, "kill").mockImplementation(() => true);
    _setSelectedText("new text");

    await runCommand();

    expect(showHUDSpy).toHaveBeenCalledWith("Speaking...");
    expect(showHUDSpy).not.toHaveBeenCalledWith("Stopped reading");
  });

  it("shows error HUD on TTS failure", async () => {
    _setSelectedText("Hello");
    vi.mocked(getActiveSystemVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveKokoroVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveTtsVoice).mockResolvedValue(undefined);

    await runCommand();

    expect(showHUDSpy).toHaveBeenCalledWith(
      expect.stringContaining("TTS failed"),
    );
  });
});

describe("isKokoroServerRunning", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reports not running when socket file is absent", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(await isKokoroServerRunning()).toBe(false);
  });

  it("reports running when server accepts connections", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const emitter = new EventEmitter();
    (emitter as unknown as Record<string, unknown>).destroy = vi.fn();
    vi.mocked(createConnection).mockReturnValue(emitter as never);

    const promise = isKokoroServerRunning();
    emitter.emit("connect");
    expect(await promise).toBe(true);
  });

  it("reports not running when connection is refused", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const emitter = new EventEmitter();
    (emitter as unknown as Record<string, unknown>).destroy = vi.fn();
    vi.mocked(createConnection).mockReturnValue(emitter as never);

    const promise = isKokoroServerRunning();
    emitter.emit("error", new Error("ECONNREFUSED"));
    expect(await promise).toBe(false);
  });
});

describe("speakText voice selection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("errors when no voice is active", async () => {
    vi.mocked(getActiveSystemVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveKokoroVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveTtsVoice).mockResolvedValue(undefined);

    await expect(speakText("hello")).rejects.toThrow("No TTS voice set");
  });

  it("prefers system voice over kokoro when both active", async () => {
    vi.mocked(getActiveSystemVoice).mockResolvedValue("Samantha");
    vi.mocked(getActiveKokoroVoice).mockResolvedValue("af_heart");

    await speakText("hello");

    expect(createConnection).not.toHaveBeenCalled();
  });

  it("uses piper when active and downloaded", async () => {
    vi.mocked(getActiveSystemVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveKokoroVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveTtsVoice).mockResolvedValue("en_US-amy-medium");
    vi.mocked(isTtsVoiceDownloaded).mockReturnValue(true);

    const mockProc = new EventEmitter();
    (mockProc as unknown as Record<string, unknown>).pid = 5678;
    (mockProc as unknown as Record<string, unknown>).unref = vi.fn();
    (mockProc as unknown as Record<string, unknown>).stdin = {
      write: vi.fn(),
      end: vi.fn(),
    };
    (mockProc as unknown as Record<string, unknown>).stderr =
      new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc as never);

    const promise = speakText("hello");
    setTimeout(() => mockProc.emit("close", 0), 10);
    await promise;

    expect(createConnection).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalled();
  });

  it("skips piper when voice is not downloaded", async () => {
    vi.mocked(getActiveSystemVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveKokoroVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveTtsVoice).mockResolvedValue("en_US-amy-medium");
    vi.mocked(isTtsVoiceDownloaded).mockReturnValue(false);

    await expect(speakText("hello")).rejects.toThrow("No TTS voice set");
  });

  it("uses kokoro server when server is running", async () => {
    vi.mocked(getActiveSystemVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveKokoroVoice).mockResolvedValue("af_heart");
    vi.mocked(getActiveTtsVoice).mockResolvedValue(undefined);
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(createConnection).mockImplementation(() => {
      const emitter = new EventEmitter();
      (emitter as unknown as Record<string, unknown>).destroy = vi.fn();
      (emitter as unknown as Record<string, unknown>).write = vi.fn();
      // Auto-connect on next tick for the server check
      setTimeout(() => emitter.emit("connect"), 0);
      // Auto-respond ok on next tick for the speak request
      setTimeout(() => emitter.emit("data", Buffer.from("ok\n")), 5);
      return emitter as never;
    });

    await speakText("hello");

    // Should have used the server (createConnection called twice), not spawned a cold start process
    expect(createConnection).toHaveBeenCalledTimes(2);
    expect(spawn).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["-c"]),
      expect.anything(),
    );
  });

  it("does cold start when kokoro server is not running", async () => {
    vi.mocked(getActiveSystemVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveKokoroVoice).mockResolvedValue("af_heart");
    vi.mocked(getActiveTtsVoice).mockResolvedValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    const mockProc = new EventEmitter();
    (mockProc as unknown as Record<string, unknown>).pid = 5678;
    (mockProc as unknown as Record<string, unknown>).unref = vi.fn();
    (mockProc as unknown as Record<string, unknown>).stdin = {
      write: vi.fn(),
      end: vi.fn(),
    };
    (mockProc as unknown as Record<string, unknown>).stderr =
      new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc as never);

    const promise = speakText("hello");
    setTimeout(() => mockProc.emit("close", 0), 10);
    await promise;

    // Should spawn python with -c (cold start script), not start a server
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["-c"]),
      expect.anything(),
    );
    // Should NOT have tried to connect to the server to speak
    expect(createConnection).not.toHaveBeenCalled();
  });
});

describe("buildKokoroServerScript", () => {
  it("uses default idle timeout of 120", () => {
    const script = buildKokoroServerScript();
    expect(script).toContain("IDLE_TIMEOUT = 120");
  });

  it("uses custom idle timeout", () => {
    const script = buildKokoroServerScript(300);
    expect(script).toContain("IDLE_TIMEOUT = 300");
  });

  it("accepts zero to disable timeout", () => {
    const script = buildKokoroServerScript(0);
    expect(script).toContain("IDLE_TIMEOUT = 0");
  });
});

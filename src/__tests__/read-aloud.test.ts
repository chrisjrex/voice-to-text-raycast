import { describe, expect, it, vi, beforeEach } from "vitest";
import { homedir } from "os";

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
}));

import { resolveKokoroPython, buildKokoroServerScript, isKokoroServerRunning, speakText } from "../read-aloud";
import type { ReadAloudPreferences } from "../read-aloud";
import { existsSync } from "fs";
import { createConnection } from "net";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import { getActiveSystemVoice, getActiveKokoroVoice, getActiveTtsVoice, isTtsVoiceDownloaded } from "../models";
import { _setPrefs } from "@raycast/api";

_setPrefs({ pythonPath: "/opt/homebrew/bin/python3", kokoroPythonPath: "", ttsEngine: "piper" });

describe("resolveKokoroPython", () => {
  it("expands tilde prefix", () => {
    const prefs = { kokoroPythonPath: "~/venv/bin/python3" } as ReadAloudPreferences;
    expect(resolveKokoroPython(prefs)).toBe(`${homedir()}/venv/bin/python3`);
  });

  it("uses default when empty", () => {
    const prefs = { kokoroPythonPath: "" } as ReadAloudPreferences;
    expect(resolveKokoroPython(prefs)).toBe(`${homedir()}/.local/lib-kokoro/venv/bin/python3`);
  });

  it("passes through absolute path unchanged", () => {
    const prefs = { kokoroPythonPath: "/usr/bin/python3" } as ReadAloudPreferences;
    expect(resolveKokoroPython(prefs)).toBe("/usr/bin/python3");
  });
});

describe("buildKokoroServerScript", () => {
  const script = buildKokoroServerScript();

  it("auto-shuts down after 120 seconds idle", () => {
    // The script should define a 120-second idle timeout
    expect(script).toContain("120");
    // Verify by parsing: extract the IDLE_TIMEOUT value
    const match = script.match(/IDLE_TIMEOUT\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(120);
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

    // System voice uses macOS `say`, kokoro uses a Unix socket server.
    // If system voice won, `say` was spawned — not a socket connection.
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
    (mockProc as unknown as Record<string, unknown>).stdin = { write: vi.fn(), end: vi.fn() };
    (mockProc as unknown as Record<string, unknown>).stderr = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(mockProc as never);

    const promise = speakText("hello");
    setTimeout(() => mockProc.emit("close", 0), 10);
    await promise;

    // Piper was used (not system say, not kokoro server)
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

  it("auto-starts kokoro server when not running", async () => {
    vi.useFakeTimers();

    vi.mocked(getActiveSystemVoice).mockResolvedValue(undefined);
    vi.mocked(getActiveKokoroVoice).mockResolvedValue("af_heart");
    vi.mocked(getActiveTtsVoice).mockResolvedValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false); // socket doesn't exist → server not running

    // startKokoroServer spawns python then polls until ready or 8s timeout.
    // Capture the promise immediately to avoid unhandled rejection.
    const promise = speakText("hello").catch((e: Error) => e);
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(500);
    }

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    // The key behavior: it attempted to start the server
    expect(spawn).toHaveBeenCalled();

    vi.useRealTimers();
  });
});

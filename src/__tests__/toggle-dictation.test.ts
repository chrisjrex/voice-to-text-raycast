import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    statSync: vi.fn(() => ({ size: 0 })),
    unlinkSync: vi.fn(),
  };
});
vi.mock("../transcribe", () => ({
  parseModel: vi.fn(),
  transcribe: vi.fn(),
}));
vi.mock("../post-processors", () => ({
  hasEnabledProcessors: vi.fn(async () => false),
  runPostProcessing: vi.fn((text: string) => Promise.resolve(text)),
}));
vi.mock("../history", () => ({
  addHistoryEntry: vi.fn(),
}));
vi.mock("../models", () => ({
  isModelDownloaded: vi.fn(() => true),
  getActiveModel: vi.fn(async () => "whisper:mlx-community/whisper-tiny"),
}));

import { spawn, execFile } from "child_process";
import { existsSync, statSync } from "fs";
import * as raycastApi from "@raycast/api";
import { LocalStorage, _setPrefs } from "@raycast/api";
import { parseModel, transcribe } from "../transcribe";
import { hasEnabledProcessors, runPostProcessing } from "../post-processors";
import { addHistoryEntry } from "../history";
import { isModelDownloaded, getActiveModel } from "../models";

const showHUDSpy = vi.spyOn(raycastApi, "showHUD");
const updateMetadataSpy = vi.spyOn(raycastApi, "updateCommandMetadata");
const clipboardCopySpy = vi.spyOn(raycastApi.Clipboard, "copy");

_setPrefs({
  soxPath: "/opt/homebrew/bin/sox",
  pythonPath: "/opt/homebrew/bin/python3",
  saveHistory: false,
  copyToClipboard: true,
  pasteToActiveApp: false,
  silenceTimeout: "0",
});

vi.mocked(parseModel).mockReturnValue({ provider: "whisper", modelId: "mlx-community/whisper-tiny" });

function mockExecFileSuccess() {
  vi.mocked(execFile).mockImplementation((_cmd, _args, cb: unknown) => {
    (cb as (err: null, result: { stdout: string }) => void)(null, { stdout: "sox v14.4.2" });
    return {} as ReturnType<typeof execFile>;
  });
}

function mockSpawnRecorder(pid = 9999) {
  const proc = { pid, unref: vi.fn(), on: vi.fn() };
  vi.mocked(spawn).mockReturnValue(proc as never);
  return proc;
}

describe("toggle-dictation Command", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await LocalStorage.clear();

    _setPrefs({
      soxPath: "/opt/homebrew/bin/sox",
      pythonPath: "/opt/homebrew/bin/python3",
      saveHistory: false,
      copyToClipboard: true,
      pasteToActiveApp: false,
      silenceTimeout: "0",
    });

    vi.mocked(getActiveModel).mockResolvedValue("whisper:mlx-community/whisper-tiny");
    vi.mocked(parseModel).mockReturnValue({ provider: "whisper", modelId: "mlx-community/whisper-tiny" });
    vi.mocked(isModelDownloaded).mockReturnValue(true);
    mockExecFileSuccess();
  });

  async function runCommand() {
    const mod = await import("../toggle-dictation");
    return mod.default();
  }

  it("starts recording when no PID is stored", async () => {
    mockSpawnRecorder(9999);

    await runCommand();

    expect(spawn).toHaveBeenCalledWith(
      "/opt/homebrew/bin/sox",
      expect.arrayContaining(["-d", "-t", "wav"]),
      expect.objectContaining({ detached: true }),
    );
    expect(updateMetadataSpy).toHaveBeenCalledWith({ subtitle: "Recording..." });
    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("Recording"));
  });

  it("stops and transcribes when PID is stored and process is alive", async () => {
    await LocalStorage.setItem("recording_pid", "1234");
    await LocalStorage.setItem("audio_path", "/tmp/test-support/recording-123.wav");

    vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (signal === 0) return true;
      return true;
    });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ size: 5000 } as ReturnType<typeof statSync>);
    vi.mocked(transcribe).mockResolvedValue("hello world");

    await runCommand();

    expect(transcribe).toHaveBeenCalled();
    expect(updateMetadataSpy).toHaveBeenCalledWith({ subtitle: "Transcribing..." });
    expect(updateMetadataSpy).not.toHaveBeenCalledWith({ subtitle: "Processing..." });
    expect(updateMetadataSpy).toHaveBeenCalledWith({ subtitle: "" });
    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("hello world"));
  });

  it("shows error HUD when no model is selected", async () => {
    vi.mocked(getActiveModel).mockResolvedValue(undefined);

    await runCommand();

    expect(updateMetadataSpy).toHaveBeenCalledWith({ subtitle: "" });
    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("No model selected"));
  });

  it("shows error HUD when model is not downloaded", async () => {
    vi.mocked(isModelDownloaded).mockReturnValue(false);

    await runCommand();

    expect(updateMetadataSpy).toHaveBeenCalledWith({ subtitle: "" });
    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("not downloaded"));
  });

  it("shows error HUD when sox dependency check fails", async () => {
    await LocalStorage.removeItem("deps_checked");
    vi.mocked(execFile).mockImplementation((_cmd, _args, cb: unknown) => {
      (cb as (err: Error) => void)(new Error("not found"));
      return {} as ReturnType<typeof execFile>;
    });

    await runCommand();

    expect(updateMetadataSpy).toHaveBeenCalledWith({ subtitle: "" });
    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("sox not found"));
  });

  it("post-processes transcription result before clipboard", async () => {
    await LocalStorage.setItem("recording_pid", "1234");
    await LocalStorage.setItem("audio_path", "/tmp/test-support/recording-123.wav");

    vi.spyOn(process, "kill").mockImplementation(() => true);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ size: 5000 } as ReturnType<typeof statSync>);
    vi.mocked(transcribe).mockResolvedValue("raw text");
    vi.mocked(hasEnabledProcessors).mockResolvedValue(true);
    vi.mocked(runPostProcessing).mockResolvedValue("processed text");

    await runCommand();

    expect(runPostProcessing).toHaveBeenCalledWith("raw text");
    expect(updateMetadataSpy).toHaveBeenCalledWith({ subtitle: "Processing..." });
    expect(clipboardCopySpy).toHaveBeenCalledWith("processed text");
  });

  it("adds history entry when saveHistory pref is enabled", async () => {
    _setPrefs({
      soxPath: "/opt/homebrew/bin/sox",
      pythonPath: "/opt/homebrew/bin/python3",
      saveHistory: true,
      copyToClipboard: true,
      pasteToActiveApp: false,
      silenceTimeout: "0",
    });

    await LocalStorage.setItem("recording_pid", "1234");
    await LocalStorage.setItem("audio_path", "/tmp/test-support/recording-123.wav");

    vi.spyOn(process, "kill").mockImplementation(() => true);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ size: 5000 } as ReturnType<typeof statSync>);
    vi.mocked(transcribe).mockResolvedValue("saved text");

    await runCommand();

    expect(addHistoryEntry).toHaveBeenCalledWith("saved text");
  });

  it("handles dead recorder PID with existing audio file by auto-transcribing", async () => {
    await LocalStorage.setItem("recording_pid", "1234");
    await LocalStorage.setItem("audio_path", "/tmp/test-support/recording-123.wav");

    vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
      if (signal === 0) throw new Error("ESRCH");
      return true;
    });
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ size: 5000 } as ReturnType<typeof statSync>);
    vi.mocked(transcribe).mockResolvedValue("recovered text");

    await runCommand();

    expect(transcribe).toHaveBeenCalled();
  });

  it("handles dead recorder PID with missing audio file by showing error", async () => {
    await LocalStorage.setItem("recording_pid", "1234");
    await LocalStorage.setItem("audio_path", "/tmp/test-support/recording-123.wav");

    vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
      if (signal === 0) throw new Error("ESRCH");
      return true;
    });
    vi.mocked(existsSync).mockReturnValue(false);

    await runCommand();

    expect(updateMetadataSpy).toHaveBeenCalledWith({ subtitle: "" });
    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("lost"));
  });
});

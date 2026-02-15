import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return { ...actual, execFile: vi.fn() };
});

import { LocalStorage } from "@raycast/api";
import { execFile } from "child_process";
import {
  getCachedEngineState,
  refreshEngineState,
  CACHE_KOKORO,
  CACHE_PIPER,
} from "../tts-menu-bar";

describe("getCachedEngineState", () => {
  beforeEach(async () => {
    await LocalStorage.clear();
  });

  it("returns null when no cached value exists", async () => {
    expect(await getCachedEngineState(CACHE_KOKORO)).toBeNull();
  });

  it("returns true when cached as installed", async () => {
    await LocalStorage.setItem(CACHE_KOKORO, true);
    expect(await getCachedEngineState(CACHE_KOKORO)).toBe(true);
  });

  it("returns false when cached as not installed", async () => {
    await LocalStorage.setItem(CACHE_PIPER, false);
    expect(await getCachedEngineState(CACHE_PIPER)).toBe(false);
  });
});

describe("refreshEngineState", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await LocalStorage.clear();
  });

  it("checks real state and caches true when installed", async () => {
    vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, cb) => {
      if (typeof cb === "function") (cb as (err: Error | null) => void)(null);
      return {} as ReturnType<typeof execFile>;
    });

    const result = await refreshEngineState(
      CACHE_KOKORO,
      "/usr/bin/python3",
      "kokoro",
    );

    expect(result).toBe(true);
    expect(await LocalStorage.getItem<boolean>(CACHE_KOKORO)).toBe(true);
  });

  it("checks real state and caches false when not installed", async () => {
    vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, cb) => {
      if (typeof cb === "function")
        (cb as (err: Error | null) => void)(new Error("No module"));
      return {} as ReturnType<typeof execFile>;
    });

    const result = await refreshEngineState(
      CACHE_PIPER,
      "/usr/bin/python3",
      "piper",
    );

    expect(result).toBe(false);
    expect(await LocalStorage.getItem<boolean>(CACHE_PIPER)).toBe(false);
  });

  it("overwrites stale cache with real state", async () => {
    await LocalStorage.setItem(CACHE_KOKORO, true);

    vi.mocked(execFile).mockImplementation((_cmd, _args, _opts, cb) => {
      if (typeof cb === "function")
        (cb as (err: Error | null) => void)(new Error("No module"));
      return {} as ReturnType<typeof execFile>;
    });

    const result = await refreshEngineState(
      CACHE_KOKORO,
      "/usr/bin/python3",
      "kokoro",
    );

    expect(result).toBe(false);
    expect(await LocalStorage.getItem<boolean>(CACHE_KOKORO)).toBe(false);
  });
});

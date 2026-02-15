import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../read-aloud", () => ({
  isKokoroServerRunning: vi.fn(),
  startKokoroServer: vi.fn(),
  stopKokoroServer: vi.fn(),
  resolveKokoroPython: vi.fn(() => "/usr/bin/python3"),
}));

import { isKokoroServerRunning, startKokoroServer, stopKokoroServer, resolveKokoroPython } from "../read-aloud";
import * as raycastApi from "@raycast/api";
import { _setPrefs } from "@raycast/api";

const showHUDSpy = vi.spyOn(raycastApi, "showHUD");

_setPrefs({ kokoroPythonPath: "" });

describe("toggle-kokoro-server Command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveKokoroPython).mockReturnValue("/usr/bin/python3");
    _setPrefs({ kokoroPythonPath: "" });
  });

  async function runCommand() {
    const mod = await import("../toggle-kokoro-server");
    return mod.default();
  }

  it("stops server when already running", async () => {
    vi.mocked(isKokoroServerRunning).mockResolvedValue(true);

    await runCommand();

    expect(stopKokoroServer).toHaveBeenCalled();
    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("stopped"));
  });

  it("starts server when not running", async () => {
    vi.mocked(isKokoroServerRunning).mockResolvedValue(false);
    vi.mocked(startKokoroServer).mockResolvedValue(undefined);

    await runCommand();

    expect(startKokoroServer).toHaveBeenCalledWith("/usr/bin/python3");
    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("started"));
  });

  it("shows error HUD when start fails", async () => {
    vi.mocked(isKokoroServerRunning).mockResolvedValue(false);
    vi.mocked(startKokoroServer).mockRejectedValue(new Error("Python not found"));

    await runCommand();

    expect(showHUDSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to start"));
  });
});

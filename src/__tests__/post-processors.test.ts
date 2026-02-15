import { describe, expect, it, vi, beforeEach } from "vitest";

import { loadProcessors, runPostProcessing } from "../post-processors";
import { LocalStorage, AI } from "@raycast/api";

beforeEach(async () => {
  vi.restoreAllMocks();
  await LocalStorage.clear();
});

describe("loadProcessors", () => {
  it("returns builtins on first use", async () => {
    const processors = await loadProcessors();
    expect(processors.length).toBeGreaterThan(0);
    expect(processors.every((p) => p.builtin)).toBe(true);
  });

  it("merges new builtins without overwriting user customizations", async () => {
    const partial = [
      {
        id: "builtin-fix-grammar",
        name: "Fix Grammar",
        prompt: "fix it",
        enabled: true,
        builtin: true,
      },
    ];
    await LocalStorage.setItem("post_processors", JSON.stringify(partial));

    const processors = await loadProcessors();
    expect(processors.length).toBeGreaterThan(1);
    // User's enabled=true choice is preserved, not reset to builtin default
    expect(
      processors.find((p) => p.id === "builtin-fix-grammar")?.enabled,
    ).toBe(true);
  });

  it("preserves user-created custom processors", async () => {
    const custom = [
      {
        id: "builtin-fix-grammar",
        name: "Fix Grammar",
        prompt: "fix",
        enabled: false,
        builtin: true,
      },
      {
        id: "custom-1",
        name: "My Custom",
        prompt: "do stuff",
        enabled: true,
        builtin: false,
      },
    ];
    await LocalStorage.setItem("post_processors", JSON.stringify(custom));

    const processors = await loadProcessors();
    const found = processors.find((p) => p.id === "custom-1");
    expect(found).toBeTruthy();
    expect(found!.enabled).toBe(true);
  });
});

describe("runPostProcessing", () => {
  it("returns text unchanged when nothing is enabled", async () => {
    const result = await runPostProcessing("hello world");
    expect(result.text).toBe("hello world");
    expect(result.appliedProcessors).toEqual([]);
  });

  it("sends enabled processor instructions to AI", async () => {
    const processors = [
      {
        id: "p1",
        name: "Fix Grammar",
        prompt: "Correct grammar",
        enabled: true,
        builtin: true,
      },
    ];
    await LocalStorage.setItem("post_processors", JSON.stringify(processors));

    const askSpy = vi.spyOn(AI, "ask");
    await runPostProcessing("test input");

    expect(askSpy).toHaveBeenCalledTimes(1);
    const prompt = askSpy.mock.calls[0][0];
    expect(prompt).toContain("Correct grammar");
    expect(prompt).toContain("test input");
  });

  it("includes all enabled processors in a single prompt", async () => {
    const processors = [
      {
        id: "p1",
        name: "Grammar",
        prompt: "Correct grammar",
        enabled: true,
        builtin: true,
      },
      {
        id: "p2",
        name: "Filler",
        prompt: "Remove filler words",
        enabled: true,
        builtin: true,
      },
      {
        id: "p3",
        name: "Disabled",
        prompt: "Should not appear",
        enabled: false,
        builtin: true,
      },
    ];
    await LocalStorage.setItem("post_processors", JSON.stringify(processors));

    const askSpy = vi.spyOn(AI, "ask");
    await runPostProcessing("test");

    const prompt = askSpy.mock.calls[0][0];
    expect(prompt).toContain("Correct grammar");
    expect(prompt).toContain("Remove filler words");
    expect(prompt).not.toContain("Should not appear");
  });

  it("includes dictionary terms for preservation", async () => {
    const processors = [
      { id: "p1", name: "Fix", prompt: "Fix it", enabled: true, builtin: true },
    ];
    await LocalStorage.setItem("post_processors", JSON.stringify(processors));
    await LocalStorage.setItem(
      "dictionary",
      JSON.stringify([
        { id: "1", term: "GraphQL" },
        { id: "2", term: "OAuth" },
      ]),
    );

    const askSpy = vi.spyOn(AI, "ask");
    await runPostProcessing("test");

    const prompt = askSpy.mock.calls[0][0];
    expect(prompt).toContain("GraphQL");
    expect(prompt).toContain("OAuth");
    expect(prompt).toContain("preserved exactly as written");
  });
});

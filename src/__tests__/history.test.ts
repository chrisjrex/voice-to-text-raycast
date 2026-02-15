import { describe, expect, it, vi, beforeEach } from "vitest";

// Use an in-memory filesystem to test round-trip behavior
let files: Record<string, string> = {};

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn((path: string) => path in files),
    readFileSync: vi.fn((path: string) => {
      if (!(path in files)) throw new Error("ENOENT");
      return files[path];
    }),
    writeFileSync: vi.fn((path: string, data: string) => { files[path] = data; }),
    mkdirSync: vi.fn(),
  };
});

import { loadHistory, saveHistory, addHistoryEntry } from "../history";

beforeEach(() => {
  files = {};
});

describe("loadHistory", () => {
  it("returns empty on first use", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("survives corrupted data gracefully", () => {
    // Simulate file with garbage content
    files[Object.keys(files)[0] || "/tmp/test-support/history.json"] = "not json{{{";
    // Force the path to exist
    const path = "/tmp/test-support/history.json";
    files[path] = "not json{{{";
    expect(loadHistory()).toEqual([]);
  });
});

describe("history round-trip", () => {
  it("entries persist through save and load", () => {
    const entries = [
      { id: "1", text: "first", timestamp: 1000 },
      { id: "2", text: "second", timestamp: 2000 },
    ];
    saveHistory(entries);
    expect(loadHistory()).toEqual(entries);
  });

  it("new entries appear before old ones", () => {
    addHistoryEntry("first");
    addHistoryEntry("second");

    const history = loadHistory();
    expect(history).toHaveLength(2);
    expect(history[0].text).toBe("second");
    expect(history[1].text).toBe("first");
  });

  it("each entry has an id and timestamp", () => {
    addHistoryEntry("one");

    const history = loadHistory();
    expect(history[0].id).toBeTruthy();
    expect(history[0].timestamp).toBeGreaterThan(0);
  });
});

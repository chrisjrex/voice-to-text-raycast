import { describe, expect, it, beforeEach } from "vitest";

import { loadDictionary, saveDictionary } from "../dictionary";
import { LocalStorage } from "@raycast/api";

beforeEach(async () => {
  await LocalStorage.clear();
});

describe("loadDictionary", () => {
  it("returns empty array when nothing stored", async () => {
    expect(await loadDictionary()).toEqual([]);
  });

  it("parses stored entries", async () => {
    const entries = [
      { id: "1", term: "API" },
      { id: "2", term: "OAuth" },
    ];
    await LocalStorage.setItem("dictionary", JSON.stringify(entries));
    expect(await loadDictionary()).toEqual(entries);
  });
});

describe("saveDictionary", () => {
  it("serializes entries to LocalStorage", async () => {
    const entries = [{ id: "1", term: "GraphQL" }];
    await saveDictionary(entries);
    const stored = await LocalStorage.getItem<string>("dictionary");
    expect(JSON.parse(stored!)).toEqual(entries);
  });
});

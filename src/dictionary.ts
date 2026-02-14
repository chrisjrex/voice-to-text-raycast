import { LocalStorage } from "@raycast/api";

export interface DictionaryEntry {
  id: string;
  term: string;
}

const STORAGE_KEY = "dictionary";

export async function loadDictionary(): Promise<DictionaryEntry[]> {
  const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
}

export async function saveDictionary(entries: DictionaryEntry[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

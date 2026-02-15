const store = new Map<string, string>();

export const LocalStorage = {
  getItem: async <T = string>(key: string): Promise<T | undefined> => store.get(key) as T | undefined,
  setItem: async (key: string, value: string): Promise<void> => { store.set(key, value); },
  removeItem: async (key: string): Promise<void> => { store.delete(key); },
  clear: async (): Promise<void> => { store.clear(); },
  allItems: async (): Promise<Record<string, string>> => Object.fromEntries(store),
  _store: store,
};

export const environment = {
  supportPath: "/tmp/test-support",
  extensionName: "voice-to-text",
  commandName: "test",
  assetsPath: "/tmp/test-assets",
};

export const AI = {
  ask: async (prompt: string): Promise<string> => prompt,
};

export async function showHUD(_msg: string): Promise<void> {}
export async function updateCommandMetadata(_meta: Record<string, unknown>): Promise<void> {}
let _prefs: Record<string, unknown> = {};
export function getPreferenceValues<T>(): T {
  return _prefs as T;
}
export function _setPrefs(prefs: Record<string, unknown>): void {
  _prefs = prefs;
}
export async function getSelectedText(): Promise<string> {
  return "";
}

export const Clipboard = {
  readText: async (): Promise<string | undefined> => undefined,
  copy: async (_text: string): Promise<void> => {},
  paste: async (_text: string): Promise<void> => {},
};

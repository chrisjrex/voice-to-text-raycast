import "@raycast/api";

declare module "@raycast/api" {
  export function _setPrefs(prefs: Record<string, unknown>): void;
}

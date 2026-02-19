/**
 * Raycast-specific state storage implementation
 * Uses Raycast's LocalStorage API
 */

import { LocalStorage } from "@raycast/api";
import type { StateStorage } from "@voicekit/core";

export const raycastStateStorage: StateStorage = {
  async getString(key: string): Promise<string | undefined> {
    return await LocalStorage.getItem<string>(key);
  },

  async setString(key: string, value: string): Promise<void> {
    await LocalStorage.setItem(key, value);
  },

  async getBoolean(key: string): Promise<boolean | undefined> {
    return await LocalStorage.getItem<boolean>(key);
  },

  async setBoolean(key: string, value: boolean): Promise<void> {
    await LocalStorage.setItem(key, value);
  },

  async remove(key: string): Promise<void> {
    await LocalStorage.removeItem(key);
  },
};

import { defineConfig } from "vitest/config";
import { join } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@raycast/api": join(__dirname, "src/__mocks__/@raycast/api.ts"),
    },
  },
});

import { getPreferenceValues, showHUD, updateCommandMetadata } from "@raycast/api";
import { isKokoroServerRunning, startKokoroServer, stopKokoroServer, resolveKokoroPython, ReadAloudPreferences } from "./read-aloud";

export default async function Command() {
  const prefs = getPreferenceValues<ReadAloudPreferences>();
  const running = await isKokoroServerRunning();

  if (running) {
    stopKokoroServer();
    await updateCommandMetadata({ subtitle: "Server stopped" });
    await showHUD("Kokoro server stopped");
  } else {
    const pythonPath = resolveKokoroPython(prefs);
    try {
      await showHUD("Starting Kokoro server...");
      await startKokoroServer(pythonPath);
      await updateCommandMetadata({ subtitle: "Server running" });
      await showHUD("Kokoro server started");
    } catch (err: unknown) {
      await updateCommandMetadata({ subtitle: "Server stopped" });
      const msg = err instanceof Error ? err.message : String(err);
      await showHUD(`Failed to start: ${msg.slice(0, 80)}`);
    }
  }
}

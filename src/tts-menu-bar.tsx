import { Alert, Color, Icon, LocalStorage, MenuBarExtra, confirmAlert, getPreferenceValues, showHUD } from "@raycast/api";
import { useEffect, useState } from "react";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { isKokoroServerRunning, startKokoroServer, stopKokoroServer, PLAYBACK_PID } from "./read-aloud";
import { isPythonPackageInstalled, installPiperEngine, uninstallPiperEngine, installKokoroEngine, uninstallKokoroEngine, clearActiveKokoroVoice, clearActiveTtsVoice, getActiveSystemVoice, setActiveSystemVoice, SYSTEM_VOICES } from "./models";

interface Preferences {
  pythonPath: string;
  kokoroPythonPath: string;
  kokoroIdleTimeout: string;
}

function resolveKokoroPython(prefs: Preferences): string {
  const raw = prefs.kokoroPythonPath || "~/.local/lib-kokoro/venv/bin/python3";
  const resolved = raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
  if (!prefs.kokoroPythonPath && !existsSync(resolved)) return prefs.pythonPath;
  return resolved;
}

export const CACHE_KOKORO = "menubar_kokoro_installed";
export const CACHE_PIPER = "menubar_piper_installed";

export async function getCachedEngineState(key: string): Promise<boolean | null> {
  const cached = await LocalStorage.getItem<boolean>(key);
  return cached !== undefined ? cached : null;
}

export async function refreshEngineState(
  key: string,
  pythonPath: string,
  moduleName: string,
): Promise<boolean> {
  const installed = await isPythonPackageInstalled(pythonPath, moduleName);
  await LocalStorage.setItem(key, installed);
  return installed;
}

export default function Command() {
  const prefs = getPreferenceValues<Preferences>();
  const { pythonPath } = prefs;
  const kokoroPython = resolveKokoroPython(prefs);

  const [serverRunning, setServerRunning] = useState(false);
  const [serverTransition, setServerTransition] = useState<"starting" | "stopping" | null>(null);
  const [kokoroInstalled, setKokoroInstalled] = useState<boolean | null>(null);
  const [piperInstalled, setPiperInstalled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    getCachedEngineState(CACHE_KOKORO).then((cached) => {
      if (cached !== null) setKokoroInstalled(cached);
    });
    getCachedEngineState(CACHE_PIPER).then((cached) => {
      if (cached !== null) setPiperInstalled(cached);
    });

    isKokoroServerRunning().then(setServerRunning);
    refreshEngineState(CACHE_KOKORO, kokoroPython, "kokoro").then(setKokoroInstalled);
    refreshEngineState(CACHE_PIPER, pythonPath, "piper").then(setPiperInstalled);

    function isProcessAlive(pid: number): boolean {
      try { process.kill(pid, 0); return true; } catch { return false; }
    }

    async function checkActive() {
      const playbackActive = (() => {
        try {
          const pid = Number(readFileSync(PLAYBACK_PID, "utf-8").trim());
          return isProcessAlive(pid);
        } catch { return false; }
      })();
      const recordingPid = await LocalStorage.getItem<string>("recording_pid");
      const recordingActive = recordingPid ? isProcessAlive(Number(recordingPid)) : false;
      setActive(playbackActive || recordingActive);
    }
    checkActive();
  }, []);

  const iconSource = active ? Icon.SpeechBubbleActive : Icon.SpeechBubble;
  const icon = serverRunning
    ? { source: iconSource, tintColor: Color.Green }
    : { source: iconSource };

  async function handleToggleServer() {
    setBusy(true);
    try {
      if (serverRunning) {
        setServerTransition("stopping");
        stopKokoroServer();
        setServerRunning(false);
        await showHUD("Kokoro server stopped");
      } else {
        setServerTransition("starting");
        const idleTimeout = Math.max(0, parseInt(prefs.kokoroIdleTimeout, 10) || 120);
        await startKokoroServer(kokoroPython, idleTimeout);
        setServerRunning(true);
        await showHUD("Kokoro server started");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await showHUD(`Failed: ${msg.slice(0, 80)}`);
    } finally {
      setServerTransition(null);
      setBusy(false);
    }
  }

  async function handleInstallKokoro() {
    const confirmed = await confirmAlert({
      title: "Install Kokoro Engine",
      message: "This will install the Kokoro Python packages (~50MB) and voice engine (~312MB).",
      primaryAction: { title: "Install" },
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await installKokoroEngine(pythonPath, kokoroPython);
      setKokoroInstalled(true);
      await LocalStorage.setItem(CACHE_KOKORO, true);
      await showHUD("Kokoro engine installed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await showHUD(`Install failed: ${msg.slice(0, 80)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUninstallKokoro() {
    const confirmed = await confirmAlert({
      title: "Uninstall Kokoro Engine?",
      message: "This will remove the Kokoro packages, voice engine, and all downloaded voices (~362MB).",
      primaryAction: { title: "Uninstall", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      if (serverRunning) {
        stopKokoroServer();
        setServerRunning(false);
      }
      await uninstallKokoroEngine(kokoroPython);
      await clearActiveKokoroVoice();
      if (!await getActiveSystemVoice()) {
        await setActiveSystemVoice(SYSTEM_VOICES[0].id);
      }
      setKokoroInstalled(false);
      await LocalStorage.setItem(CACHE_KOKORO, false);
      await showHUD("Kokoro engine uninstalled");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await showHUD(`Uninstall failed: ${msg.slice(0, 80)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleInstallPiper() {
    const confirmed = await confirmAlert({
      title: "Install Piper Engine",
      message: "This will install the Piper voice engine (~24MB).",
      primaryAction: { title: "Install" },
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await installPiperEngine(pythonPath);
      setPiperInstalled(true);
      await LocalStorage.setItem(CACHE_PIPER, true);
      await showHUD("Piper engine installed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await showHUD(`Install failed: ${msg.slice(0, 80)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUninstallPiper() {
    const confirmed = await confirmAlert({
      title: "Uninstall Piper Engine?",
      message: "This will remove the Piper voice engine and all downloaded voices.",
      primaryAction: { title: "Uninstall", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await uninstallPiperEngine(pythonPath);
      await clearActiveTtsVoice();
      if (!await getActiveSystemVoice()) {
        await setActiveSystemVoice(SYSTEM_VOICES[0].id);
      }
      setPiperInstalled(false);
      await LocalStorage.setItem(CACHE_PIPER, false);
      await showHUD("Piper engine uninstalled");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await showHUD(`Uninstall failed: ${msg.slice(0, 80)}`);
    } finally {
      setBusy(false);
    }
  }

  const loading = kokoroInstalled === null || piperInstalled === null || busy;

  return (
    <MenuBarExtra icon={icon} isLoading={loading}>
      {kokoroInstalled !== false && (
        <MenuBarExtra.Section title="Kokoro Server">
          <MenuBarExtra.Item title={serverTransition === "starting" ? "Starting…" : serverTransition === "stopping" ? "Stopping…" : serverRunning ? "Running" : "Stopped"} />
          <MenuBarExtra.Item
            title={serverRunning ? "Stop Server" : "Start Server"}
            onAction={handleToggleServer}
          />
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section title="TTS Engines">
        <MenuBarExtra.Item
          title={kokoroInstalled ? "Uninstall Kokoro" : "Install Kokoro"}
          onAction={kokoroInstalled ? handleUninstallKokoro : handleInstallKokoro}
        />
        <MenuBarExtra.Item
          title={piperInstalled ? "Uninstall Piper" : "Install Piper"}
          onAction={piperInstalled ? handleUninstallPiper : handleInstallPiper}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

import { spawn } from "child_process";
import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export interface LaunchAgentConfig {
  label: string;
  programArguments: string[];
  standardOutPath?: string;
  standardErrorPath?: string;
  runAtLoad?: boolean;
  keepAlive?: boolean;
  environmentVariables?: Record<string, string>;
}

const LAUNCH_AGENTS_DIR = join(homedir(), "Library", "LaunchAgents");

function getPlistPath(label: string): string {
  return join(LAUNCH_AGENTS_DIR, `${label}.plist`);
}

function generatePlistContent(config: LaunchAgentConfig): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    "<plist version=\"1.0\">",
    "<dict>",
    `  <key>Label</key><string>${config.label}</string>`,
    "  <key>ProgramArguments</key>",
    "  <array>",
  ];

  for (const arg of config.programArguments) {
    lines.push(`    <string>${escapeXml(arg)}</string>`);
  }

  lines.push("  </array>");

  if (config.standardOutPath) {
    lines.push(`  <key>StandardOutPath</key><string>${escapeXml(config.standardOutPath)}</string>`);
  }

  if (config.standardErrorPath) {
    lines.push(`  <key>StandardErrorPath</key><string>${escapeXml(config.standardErrorPath)}</string>`);
  }

  if (config.runAtLoad !== undefined) {
    lines.push(`  <key>RunAtLoad</key><${config.runAtLoad}/>`);
  }

  if (config.keepAlive !== undefined) {
    lines.push(`  <key>KeepAlive</key><${config.keepAlive}/>`);
  }

  if (config.environmentVariables) {
    lines.push("  <key>EnvironmentVariables</key>");
    lines.push("  <dict>");
    for (const [key, value] of Object.entries(config.environmentVariables)) {
      lines.push(`    <key>${key}</key><string>${escapeXml(value)}</string>`);
    }
    lines.push("  </dict>");
  }

  lines.push("</dict>");
  lines.push("</plist>");

  return lines.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function installLaunchAgent(config: LaunchAgentConfig): Promise<void> {
  const plistPath = getPlistPath(config.label);

  if (!existsSync(LAUNCH_AGENTS_DIR)) {
    mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  }

  const plistContent = generatePlistContent(config);
  writeFileSync(plistPath, plistContent, "utf-8");
}

export async function uninstallLaunchAgent(label: string): Promise<void> {
  const plistPath = getPlistPath(label);

  if (existsSync(plistPath)) {
    try {
      await runCommand("launchctl", ["unload", plistPath]);
    } catch {
    }
    unlinkSync(plistPath);
  }
}

export async function startLaunchAgent(label: string): Promise<boolean> {
  const plistPath = getPlistPath(label);

  if (!existsSync(plistPath)) {
    throw new Error(`LaunchAgent plist not found: ${label}`);
  }

  try {
    await runCommand("launchctl", ["load", plistPath]);
  } catch {
  }
  
  try {
    await runCommand("launchctl", ["start", label]);
  } catch {
  }
  
  return true;
}

export async function stopLaunchAgent(label: string): Promise<boolean> {
  const plistPath = getPlistPath(label);

  if (!existsSync(plistPath)) {
    return false;
  }

  try {
    await runCommand("launchctl", ["unload", plistPath]);
    return true;
  } catch {
  }

  try {
    await runCommand("launchctl", ["kill", "TERM", label]);
    return true;
  } catch {
    return false;
  }
}

function parseLaunchctlListOutput(output: string, label: string): { pid: number | null; exitStatus: number | null } | null {
  if (output.startsWith("{")) {
    const pidMatch = output.match(/"PID"\s*=\s*(\d+)/);
    const exitStatusMatch = output.match(/"LastExitStatus"\s*=\s*(\d+)/);
    return {
      pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
      exitStatus: exitStatusMatch ? parseInt(exitStatusMatch[1], 10) : null
    };
  }
  const lines = output.split("\n");
  for (const line of lines) {
    if (line.includes(label)) {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const pidStr = parts[0].trim();
        const exitStatusStr = parts[1].trim();
        return {
          pid: pidStr === "-" || pidStr === "" ? null : parseInt(pidStr, 10),
          exitStatus: exitStatusStr === "-" || exitStatusStr === "" ? null : parseInt(exitStatusStr, 10)
        };
      }
    }
  }
  return null;
}

export async function isLaunchAgentRunning(label: string): Promise<boolean> {
  try {
    const output = await runCommand("launchctl", ["list", label], true);
    if (output.includes("Could not find")) {
      return false;
    }
    const data = parseLaunchctlListOutput(output, label);
    return data !== null && data.pid !== null;
  } catch {
    return false;
  }
}

export async function getLaunchAgentStatus(label: string): Promise<{
  running: boolean;
  pid: number | null;
  exitStatus: number | null;
}> {
  try {
    const output = await runCommand("launchctl", ["list", label], true);
    const data = parseLaunchctlListOutput(output, label);
    if (data) {
      return {
        running: data.pid !== null,
        pid: data.pid,
        exitStatus: data.exitStatus
      };
    }
  } catch {
  }
  return { running: false, pid: null, exitStatus: null };
}

export function isLaunchAgentInstalled(label: string): boolean {
  return existsSync(getPlistPath(label));
}

function runCommand(cmd: string, args: string[], capture = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: capture ? "pipe" : "inherit",
    });

    let output = "";
    if (capture) {
      if (proc.stdout) {
        proc.stdout.on("data", (data) => { output += data.toString(); });
      }
      if (proc.stderr) {
        proc.stderr.on("data", (data) => { output += data.toString(); });
      }
    }

    proc.on("close", (code) => {
      if (code === 0 || capture) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on("error", reject);
  });
}

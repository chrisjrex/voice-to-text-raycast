import { environment } from "@raycast/api";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export interface HistoryEntry {
  id: string;
  text: string;
  timestamp: number;
  model?: string;
  postProcessors?: string[];
  transcriptionMs?: number;
  postProcessingMs?: number;
}

const HISTORY_PATH = join(environment.supportPath, "history.json");

export function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  if (!existsSync(environment.supportPath)) {
    mkdirSync(environment.supportPath, { recursive: true });
  }
  writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2));
}

export function addHistoryEntry(
  text: string,
  opts?: {
    model?: string;
    postProcessors?: string[];
    transcriptionMs?: number;
    postProcessingMs?: number;
  },
): void {
  const entries = loadHistory();
  entries.unshift({
    id: Date.now().toString(),
    text,
    timestamp: Date.now(),
    ...(opts?.model ? { model: opts.model } : {}),
    ...(opts?.postProcessors && opts.postProcessors.length > 0
      ? { postProcessors: opts.postProcessors }
      : {}),
    ...(opts?.transcriptionMs != null
      ? { transcriptionMs: opts.transcriptionMs }
      : {}),
    ...(opts?.postProcessingMs != null
      ? { postProcessingMs: opts.postProcessingMs }
      : {}),
  });
  saveHistory(entries);
}

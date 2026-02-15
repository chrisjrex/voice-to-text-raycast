import { AI, LocalStorage } from "@raycast/api";
import { loadDictionary } from "./dictionary";

export interface PostProcessor {
  id: string;
  name: string;
  prompt: string;
  enabled: boolean;
  builtin: boolean;
  customName?: string;
  customPrompt?: string;
}

export function getEffectiveName(p: PostProcessor): string {
  return p.customName ?? p.name;
}

export function getEffectivePrompt(p: PostProcessor): string {
  return p.customPrompt ?? p.prompt;
}

export function isCustomized(p: PostProcessor): boolean {
  return p.builtin && (p.customName != null || p.customPrompt != null);
}

const STORAGE_KEY = "post_processors";

const BUILTIN_PROCESSORS: PostProcessor[] = [
  {
    id: "builtin-fix-grammar",
    name: "Fix Grammar & Spelling",
    prompt: "Correct grammar, spelling, and punctuation errors",
    enabled: false,
    builtin: true,
  },
  {
    id: "builtin-remove-filler",
    name: "Remove Filler Words",
    prompt: "Remove filler words like 'um', 'uh', 'like', 'you know', 'basically', 'so', 'I mean'",
    enabled: false,
    builtin: true,
  },
  {
    id: "builtin-smart-punctuation",
    name: "Smart Punctuation",
    prompt: "Add proper sentence structure, capitalization, and punctuation",
    enabled: false,
    builtin: true,
  },
  {
    id: "builtin-professional-tone",
    name: "Professional Tone",
    prompt: "Rewrite in a polished, professional tone suitable for business communication",
    enabled: false,
    builtin: true,
  },
  {
    id: "builtin-pirate",
    name: "Pirate",
    prompt: "Transform into pirate speak, using playful and colorful language typical of a pirate's lingo. Maintain the essence of the original text while giving it a swashbuckling twist!",
    enabled: false,
    builtin: true,
  },
];

export async function loadProcessors(): Promise<PostProcessor[]> {
  const stored = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (stored) {
    const processors: PostProcessor[] = JSON.parse(stored);
    // Merge in any new builtins that may have been added
    const existingIds = new Set(processors.map((p) => p.id));
    for (const builtin of BUILTIN_PROCESSORS) {
      if (!existingIds.has(builtin.id)) {
        processors.push(builtin);
      }
    }
    return processors;
  }
  await saveProcessors(BUILTIN_PROCESSORS);
  return [...BUILTIN_PROCESSORS];
}

export async function saveProcessors(processors: PostProcessor[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(processors));
}

export async function hasEnabledProcessors(): Promise<boolean> {
  const processors = await loadProcessors();
  return processors.some((p) => p.enabled);
}

export interface PostProcessingResult {
  text: string;
  appliedProcessors: string[];
}

export async function runPostProcessing(text: string): Promise<PostProcessingResult> {
  const processors = await loadProcessors();
  const enabled = processors.filter((p) => p.enabled);
  if (enabled.length === 0) return { text, appliedProcessors: [] };

  const instructions = enabled.map((p, i) => `${i + 1}. ${getEffectivePrompt(p)}`).join("\n");

  const dictionary = await loadDictionary();
  const dictionaryClause =
    dictionary.length > 0
      ? `\n\nIMPORTANT: The following terms must be preserved exactly as written, do not modify, expand, or correct them:\n${dictionary.map((e) => e.term).join(", ")}`
      : "";

  const prompt = `Process the following transcribed speech. Apply ALL of these transformations:
${instructions}${dictionaryClause}

Return ONLY the processed text, nothing else.

Text: """${text}"""`;

  const result = await AI.ask(prompt, { creativity: "low" });
  return { text: result, appliedProcessors: enabled.map((p) => getEffectiveName(p)) };
}

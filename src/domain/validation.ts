// ─────────────────────────────────────────────────────────────────────────────
// Validation gate S4 (FR-12, FR-14, FR-10). Pure, local, free.
// Rejects: length-budget overruns, banned patterns/phrases, gist collisions.
// "Same idea, different words" is caught by gist token similarity.
// ─────────────────────────────────────────────────────────────────────────────

import type { DirectionBudget, ModelOutput, VoiceFile } from "./types";

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

const STOPWORDS = new Set([
  "a","an","and","the","of","to","in","on","for","with","your","you","is","are","that","it","its",
  "can","makes","make","better","more","good","proper","when","how","why","this","their","they",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/** Jaccard similarity over content-word tokens. */
export function gistSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export const GIST_COLLISION_THRESHOLD = 0.5;

export interface BudgetViolation {
  field: string;
  words: number;
  limit: number;
}

export function checkBudgets(content: ModelOutput, budget: DirectionBudget): BudgetViolation[] {
  const v: BudgetViolation[] = [];
  const test = (field: string, text: string | undefined, limit: number | undefined) => {
    if (!text || !limit) return;
    const words = wordCount(text);
    if (words > limit) v.push({ field, words, limit });
  };
  test("headline", content.headline, budget.headline);
  test("body", content.body, budget.body);
  test("tip", content.tip, budget.tip);
  test("closing", content.closing, budget.closing);
  return v;
}

export function checkBanned(content: ModelOutput, voice: VoiceFile): string[] {
  const all = [content.headline, content.body, content.tip, content.closing, content.gist]
    .filter(Boolean)
    .join(" \n ");
  const lower = all.toLowerCase();
  const hits: string[] = [];
  for (const phrase of voice.bannedPhrases) {
    if (lower.includes(phrase.toLowerCase())) hits.push(`banned phrase: “${phrase}”`);
  }
  for (const pattern of voice.bannedPatterns) {
    try {
      const re = new RegExp(pattern, "i");
      const m = all.match(re);
      if (m) hits.push(`banned pattern: “${m[0]}”`);
    } catch {
      /* ignore malformed user regex rather than breaking generation */
    }
  }
  return hits;
}

export function checkGistCollision(gist: string, recent: string[]): string | null {
  for (const prev of recent) {
    if (!prev) continue;
    if (gistSimilarity(gist, prev) >= GIST_COLLISION_THRESHOLD) return prev;
  }
  return null;
}

export interface ValidationInput {
  content: ModelOutput;
  budget: DirectionBudget;
  voice: VoiceFile;
  recentGists: string[];
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export function validateGeneration(input: ValidationInput): ValidationResult {
  const reasons: string[] = [];

  if (wordCount(input.content.headline) === 0) reasons.push("headline is empty");
  if (!input.content.gist || wordCount(input.content.gist) < 3)
    reasons.push("gist is missing or too short");

  for (const b of checkBudgets(input.content, input.budget))
    reasons.push(`${b.field} is ${b.words} words (limit ${b.limit})`);

  reasons.push(...checkBanned(input.content, input.voice));

  const collision = checkGistCollision(input.content.gist, input.recentGists);
  if (collision) reasons.push(`gist repeats an existing idea: “${collision}”`);

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

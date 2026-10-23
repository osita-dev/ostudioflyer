// ─────────────────────────────────────────────────────────────────────────────
// Selection engine (FR-02, FR-11, FR-15, FR-16) — pure functions over records.
// §7.4 weighting:
//   tier 1 never used          → 100
//   tier 2 used, > 30 days ago →  60
//   tier 3 used 8–30 days ago  →  15
//   tier 4 used < 8 days ago   →   0 (excluded)
//   skipped within 30 days     →   0 (excluded)
// No store of its own: records are the single source of truth (§8.5).
// ─────────────────────────────────────────────────────────────────────────────

import { flattenLibrary, getActiveLibrary, getDirection, type FlatSubject } from "./library";
import type { Category, ContentRecord, Direction } from "./types";

const DAY = 86_400_000;
export const WINDOWS = {
  recentUse: 8 * DAY,
  skip: 30 * DAY,
  dormant: 30 * DAY,
  quota: 7,
  exhaustWindow: 90 * DAY,
  exhaustPct: 0.8,
  gists: 30,
} as const;

export type Tier = "never" | "dormant" | "recently" | "recent" | "skipped";

const TIER_WEIGHT: Record<Tier, number> = {
  never: 100,
  dormant: 60,
  recently: 15,
  recent: 0,
  skipped: 0,
};

export interface SubjectUsage {
  count: number;
  lastUsed: number | null;
  lastStatus: ContentRecord["status"] | null;
}

export function usageFor(records: ContentRecord[], subjectId: string): SubjectUsage {
  let count = 0;
  let lastUsed: number | null = null;
  let lastStatus: ContentRecord["status"] | null = null;
  for (const r of records) {
    if (r.source.subjectId !== subjectId) continue;
    count += 1;
    if (lastUsed === null || r.updatedAt > lastUsed) {
      lastUsed = r.updatedAt;
      lastStatus = r.status;
    }
  }
  return { count, lastUsed, lastStatus };
}

export function subjectTier(records: ContentRecord[], subjectId: string, now = Date.now()): Tier {
  const u = usageFor(records, subjectId);
  if (u.lastUsed === null) return "never";
  if (u.lastStatus === "skipped" && now - u.lastUsed < WINDOWS.skip) return "skipped";
  const age = now - u.lastUsed;
  if (age < WINDOWS.recentUse) return "recent";
  if (age < WINDOWS.dormant) return "recently";
  return "dormant";
}

export function tierWeight(tier: Tier): number {
  return TIER_WEIGHT[tier];
}

/** Promotional quota: max 1 promotional item in the last 7 generations (FR-15). */
export function promoQuotaOk(records: ContentRecord[]): boolean {
  const recent = [...records]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, WINDOWS.quota);
  const promoCount = recent.filter((r) =>
    getDirection(r.source.categoryId, r.source.directionId)?.promotional
  ).length;
  return promoCount < 1;
}

/** Direction choices for the selection screen, quota-filtered. */
export function directionChoices(category: Category, records: ContentRecord[]): Direction[] {
  const quotaOk = promoQuotaOk(records);
  return category.directions.filter((d) => (d.promotional ? quotaOk : true));
}

export interface SubjectChoice extends FlatSubject {
  tier: Tier;
  weight: number;
  /** True when the user deviated from the recommendation (stored on the record). */
  overridden: boolean;
}

export function subjectChoices(
  flat: FlatSubject[],
  records: ContentRecord[]
): SubjectChoice[] {
  return flat.map((f) => {
    const tier = subjectTier(records, f.subject.id);
    return { ...f, tier, weight: tierWeight(tier), overridden: false };
  });
}

/** Eligible pool: active triples, promo-filtered, zero-weight tiers excluded. */
export function eligiblePool(records: ContentRecord[]): SubjectChoice[] {
  const quotaOk = promoQuotaOk(records);
  const flat = flattenLibrary(true).filter((f) => (f.direction.promotional ? quotaOk : true));
  return subjectChoices(flat, records).filter((c) => c.weight > 0);
}

/** Relax subject blocking only (for retry when the strict pool is empty). */
function relaxedPool(records: ContentRecord[]): SubjectChoice[] {
  const quotaOk = promoQuotaOk(records);
  const flat = flattenLibrary(true).filter((f) => (f.direction.promotional ? quotaOk : true));
  return subjectChoices(flat, records).filter((c) => c.tier !== "skipped");
}

function weightedDraw(choices: SubjectChoice[]): SubjectChoice | null {
  const total = choices.reduce((s, c) => s + c.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const c of choices) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return choices[choices.length - 1] ?? null;
}

/**
 * S2: recommend a category ▸ direction ▸ subject.
 * blacklist = subject ids to avoid (pipeline repair retries).
 */
export function recommend(
  records: ContentRecord[],
  blacklist: string[] = []
): SubjectChoice | null {
  const base = eligiblePool(records).filter((c) => !blacklist.includes(c.subject.id));
  const pick = weightedDraw(base) ?? weightedDraw(
    relaxedPool(records).filter((c) => !blacklist.includes(c.subject.id))
  );
  return pick;
}

/** Recommendation scoped to one category (when the user overrides the category). */
export function recommendInCategory(
  categoryId: string,
  records: ContentRecord[],
  blacklist: string[] = []
): SubjectChoice | null {
  const quotaOk = promoQuotaOk(records);
  const flat = flattenLibrary(true).filter(
    (f) => f.category.id === categoryId && (f.direction.promotional ? quotaOk : true)
  );
  const choices = subjectChoices(flat, records).filter((c) => !blacklist.includes(c.subject.id));
  return weightedDraw(choices);
}

/** Last N gists, newest first — dedup input (FR-10). Includes skipped: the idea was still tried. */
export function recentGists(records: ContentRecord[], n = WINDOWS.gists): string[] {
  return [...records]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, n)
    .map((r) => r.gist)
    .filter(Boolean);
}

export interface Exhaustion {
  categoryId: string;
  categoryLabel: string;
  pct: number;
}

/** FR-16: categories with > 80% of active subjects used within 90 days. */
export function exhaustedCategories(records: ContentRecord[], now = Date.now()): Exhaustion[] {
  const out: Exhaustion[] = [];
  for (const c of getActiveLibrary()) {
    const subjects = c.directions.flatMap((d) => d.subjects.filter((s) => s.active));
    if (subjects.length === 0) continue;
    const usedRecently = subjects.filter((s) => {
      const u = usageFor(records, s.id);
      return u.lastUsed !== null && now - u.lastUsed < WINDOWS.exhaustWindow;
    }).length;
    const pct = usedRecently / subjects.length;
    if (pct >= WINDOWS.exhaustPct) {
      out.push({ categoryId: c.id, categoryLabel: c.label, pct: Math.round(pct * 100) });
    }
  }
  return out;
}

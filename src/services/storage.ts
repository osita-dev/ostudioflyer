// ─────────────────────────────────────────────────────────────────────────────
// STORE (§8.5) — the ONLY writer to disk. Records are append-only; status
// changes go through the §7.1 state machine (TRANSITIONS). Usage data is
// never stored — always derived from records by selectors.
// React binds to it via useSyncExternalStore (subscribe/getSnapshot).
// ─────────────────────────────────────────────────────────────────────────────

import { TRANSITIONS } from "@/domain/types";
import type { AppSettings, ContentRecord, Db, RecordStatus } from "@/domain/types";

const KEY = "ostudio.v1";
const BACKUP_KEY = "ostudio.v1.corrupt";

const DEFAULT_DB: Db = {
  v: 1,
  records: [],
  currentId: null,
  settings: { seenNotices: [], lastCategory: null },
};

function sanitizeRecord(r: unknown): r is ContentRecord {
  if (!r || typeof r !== "object") return false;
  const rec = r as Partial<ContentRecord>;
  return (
    typeof rec.id === "string" &&
    typeof rec.createdAt === "number" &&
    typeof rec.gist === "string" &&
    !!rec.source &&
    !!rec.content &&
    typeof rec.status === "string"
  );
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_DB };
    const parsed = JSON.parse(raw) as Partial<Db>;
    const records = Array.isArray(parsed.records) ? parsed.records.filter(sanitizeRecord) : [];
    return {
      v: 1,
      records,
      currentId: typeof parsed.currentId === "string" ? parsed.currentId : null,
      settings: {
        seenNotices: Array.isArray(parsed.settings?.seenNotices) ? parsed.settings.seenNotices : [],
        lastCategory: parsed.settings?.lastCategory ?? null,
      },
    };
  } catch {
    // Corruption: preserve the raw payload for recovery, start clean (Invariant 5).
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      /* ignore secondary failure */
    }
    return { ...DEFAULT_DB, settings: { ...DEFAULT_DB.settings } };
  }
}

let cache: Db = typeof localStorage !== "undefined" ? load() : { ...DEFAULT_DB };
const listeners = new Set<() => void>();

function commit(next: Db): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — app keeps working in memory */
  }
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): Db {
  return cache;
}

// ── transitions (state machine enforced) ─────────────────────────────────────

function appendRecord(record: ContentRecord): void {
  commit({ ...cache, records: [...cache.records, record], currentId: record.id });
}

/** Edit (FR-40): only drafts may be patched. */
function patchDraft(id: string, patch: Partial<ContentRecord>): void {
  const records = cache.records.map((r) =>
    r.id === id && r.status === "draft" ? { ...r, ...patch, updatedAt: Date.now() } : r
  );
  commit({ ...cache, records });
}

function transition(id: string, to: RecordStatus): boolean {
  let changed = false;
  const records = cache.records.map((r) => {
    if (r.id !== id || r.status === to) return r;
    if (!TRANSITIONS[r.status].includes(to)) return r;
    changed = true;
    return {
      ...r,
      status: to,
      updatedAt: Date.now(),
      ...(to === "published" ? { publishedAt: Date.now() } : {}),
    };
  });
  if (changed) commit({ ...cache, records });
  return changed;
}

function setCurrent(id: string | null): void {
  commit({ ...cache, currentId: id });
}

function updateSettings(patch: Partial<AppSettings>): void {
  commit({ ...cache, settings: { ...cache.settings, ...patch } });
}

// ── backup (FR-53) ───────────────────────────────────────────────────────────

function exportJson(): string {
  return JSON.stringify({ v: 1, records: cache.records, exportedAt: Date.now() }, null, 2);
}

/** Merge import by id — newest updatedAt wins; nothing is ever removed. */
function importRecords(json: string): { added: number; updated: number } {
  const parsed = JSON.parse(json) as { records?: unknown[] };
  const incoming = Array.isArray(parsed.records)
    ? parsed.records.filter(sanitizeRecord)
    : Array.isArray(parsed)
      ? (parsed as unknown[]).filter(sanitizeRecord)
      : [];
  const byId = new Map(cache.records.map((r) => [r.id, r]));
  let added = 0;
  let updated = 0;
  for (const rec of incoming) {
    const existing = byId.get(rec.id);
    if (!existing) {
      byId.set(rec.id, rec);
      added += 1;
    } else if (rec.updatedAt > existing.updatedAt) {
      byId.set(rec.id, rec);
      updated += 1;
    }
  }
  commit({ ...cache, records: [...byId.values()] });
  return { added, updated };
}

export const storage = {
  subscribe,
  getSnapshot,
  appendRecord,
  patchDraft,
  transition,
  setCurrent,
  updateSettings,
  exportJson,
  importRecords,
};

// ─────────────────────────────────────────────────────────────────────────────
// useStudio — React binding to STORE via useSyncExternalStore.
// The only place pages read or mutate records.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";
import { storage } from "@/services/storage";
import type { ContentRecord, RecordStatus } from "@/domain/types";

export function useStudio() {
  const db = useSyncExternalStore(storage.subscribe, storage.getSnapshot, storage.getSnapshot);

  const current = db.currentId
    ? (db.records.find((r) => r.id === db.currentId) ?? null)
    : null;

  return {
    records: db.records,
    current,
    settings: db.settings,
    /** S7 commit */
    saveDraft: (record: ContentRecord) => storage.appendRecord(record),
    /** FR-40 — drafts only */
    patchDraft: (id: string, patch: Partial<ContentRecord>) => storage.patchDraft(id, patch),
    /** state machine enforced (§7.1) */
    transition: (id: string, to: RecordStatus) => storage.transition(id, to),
    setCurrent: (id: string | null) => storage.setCurrent(id),
    updateSettings: storage.updateSettings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image matching (FR-35). Deterministic, no AI: direct subject binding wins,
// otherwise rank by tag overlap. Below threshold → null → text-only variant.
// ─────────────────────────────────────────────────────────────────────────────

import type { ImageEntry, ImageLibrary, Subject } from "./types";

export function matchImage(
  lib: ImageLibrary,
  categoryId: string,
  subject: Subject,
  proposedTags: string[]
): ImageEntry | null {
  const wanted = new Set(
    [...subject.imageTags, ...proposedTags].map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
  const subjectKey = `${categoryId}/${subject.id}`;

  let best: { entry: ImageEntry; score: number } | null = null;
  for (const entry of lib.images) {
    let score = 0;
    if (entry.subjectIds?.includes(subjectKey)) score += 1000;
    for (const tag of entry.tags) {
      if (wanted.has(tag.trim().toLowerCase())) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best ? best.entry : null;
}

/** Images available for a subject (used by the "Swap" control, FR-36). */
export function imagesForSubject(
  lib: ImageLibrary,
  categoryId: string,
  subject: Subject
): ImageEntry[] {
  const subjectKey = `${categoryId}/${subject.id}`;
  return lib.images.filter(
    (e) =>
      e.subjectIds?.includes(subjectKey) ||
      e.tags.some((t) => subject.imageTags.includes(t.toLowerCase()))
  );
}

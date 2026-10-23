// ─────────────────────────────────────────────────────────────────────────────
// Knowledge library loader (FR-20, FR-22 / NFR-07).
// One JSON file per category in src/data/library — dropping in a new file adds
// a category with zero code changes (Vite import.meta.glob).
// ─────────────────────────────────────────────────────────────────────────────

import type { Category, Direction, ImageLibrary, Subject, VoiceFile } from "./types";
import rawVoice from "@/data/voice.json";
import rawImages from "@/data/images.json";

const modules = import.meta.glob("../data/library/*.json", { eager: true });

function loadCategories(): Category[] {
  const out: Category[] = [];
  for (const path of Object.keys(modules)) {
    const mod = modules[path] as { default: Category };
    const cat = mod.default;
    if (cat && typeof cat.id === "string" && Array.isArray(cat.directions)) {
      out.push(cat);
    }
  }
  // Stable order: filename alphabetical (category id).
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

const categories = loadCategories();

export function getLibrary(): Category[] {
  return categories;
}

export function getActiveLibrary(): Category[] {
  return categories.filter((c) => c.active);
}

export function getCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getDirection(categoryId: string, directionId: string): Direction | undefined {
  return getCategory(categoryId)?.directions.find((d) => d.id === directionId);
}

export function getSubject(
  categoryId: string,
  directionId: string,
  subjectId: string
): Subject | undefined {
  return getDirection(categoryId, directionId)?.subjects.find((s) => s.id === subjectId);
}

export function getVoice(): VoiceFile {
  return rawVoice as VoiceFile;
}

export function getImages(): ImageLibrary {
  return rawImages as ImageLibrary;
}

export interface FlatSubject {
  category: Category;
  direction: Direction;
  subject: Subject;
}

/** Every active category ▸ direction ▸ subject triple. */
export function flattenLibrary(activeOnly = true): FlatSubject[] {
  const out: FlatSubject[] = [];
  for (const c of activeOnly ? getActiveLibrary() : categories) {
    for (const d of c.directions) {
      for (const s of d.subjects) {
        if (s.active) out.push({ category: c, direction: d, subject: s });
      }
    }
  }
  return out;
}

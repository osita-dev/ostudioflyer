// ─────────────────────────────────────────────────────────────────────────────
// O Studio Daily — domain types (single source of truth for every data shape)
// Pure types only. No React, no DOM, no imports.
// ─────────────────────────────────────────────────────────────────────────────

export type SlotProfile = "lesson" | "announcement";
export type Variant = "lesson" | "text-only" | "announcement";
export type RecordStatus = "draft" | "skipped" | "downloaded" | "published";

export interface DirectionBudget {
  headline: number;
  body?: number;
  tip?: number;
  closing?: number;
}

export interface Subject {
  id: string;
  label: string;
  guidance: string;
  imageTags: string[];
  active: boolean;
  references?: string[];
}

export interface Direction {
  id: string;
  label: string;
  promotional?: boolean;
  slotProfile: SlotProfile;
  budget: DirectionBudget;
  guidance: string;
  subjects: Subject[];
}

export interface Category {
  id: string;
  label: string;
  active: boolean;
  directions: Direction[];
}

export interface VoiceExemplar {
  headline: string;
  body?: string;
  tip?: string;
}

export interface VoiceFile {
  audience: string;
  register: string;
  principles: string[];
  bannedPhrases: string[];
  bannedPatterns: string[];
  exemplars: VoiceExemplar[];
}

export interface ImageEntry {
  id: string;
  file: string;
  tags: string[];
  subjectIds?: string[];
  credit: string;
  license: string;
}

export interface ImageLibrary {
  images: ImageEntry[];
}

/** The five visible slots. The gold terminal period is added by the layout, never stored. */
export interface GenerationContent {
  label: string;
  headline: string;
  body?: string;
  tip?: string;
  closing?: string;
}

/** Exactly what the model must return (validated server + client side). */
export interface ModelOutput {
  headline: string;
  body?: string;
  tip?: string;
  closing?: string;
  gist: string;
  imageTags: string[];
}

export interface ContentRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: RecordStatus;
  publishedAt?: number;
  variant: Variant;
  source: {
    categoryId: string;
    directionId: string;
    subjectId: string;
    overridden: boolean;
  };
  content: GenerationContent;
  gist: string;
  imageId: string | null;
  /** AI illustration (FLUX) — downscaled JPEG data URL, mutually exclusive with imageId. */
  aiImage?: AiImage;
  imageTags: string[];
  meta: {
    model: string;
    repairPasses: number;
    promptVersion: string;
  };
}

/** An AI-generated side illustration stored ON the record (restore = no network). */
export interface AiImage {
  /** JPEG data URL (downscaled to flyer needs — keeps localStorage affordable). */
  src: string;
  model: string;
}

/** POST /api/image request body — prompt assembled server-side from this. */
export interface ImageGenPayload {
  category: { label: string };
  direction: { label: string; guidance: string };
  subject: { label: string; guidance: string; imageTags: string[] };
  imageTags: string[];
}

/** POST /api/generate request body (§8.6). The prompt is assembled server-side. */
export interface GeneratePayload {
  category: { id: string; label: string };
  direction: {
    id: string;
    label: string;
    slotProfile: SlotProfile;
    budget: DirectionBudget;
    guidance: string;
  };
  subject: { id: string; label: string; guidance: string; imageTags: string[] };
  voice: VoiceFile;
  recentGists: string[];
  blacklist: string[];
  feedback?: string;
}

export interface GenerateResponse {
  ok: boolean;
  content: ModelOutput;
  meta: { model: string; promptVersion: string };
  error?: string;
}

export type PipelineStage =
  | "context"
  | "recommend"
  | "calling"
  | "validating"
  | "matching"
  | "layout"
  | "committing"
  | "done";

export interface AppSettings {
  seenNotices: string[];
  lastCategory: string | null;
  /** Where the side illustration comes from. AI falls back to curated on failure. */
  imageMode: "ai" | "curated";
}

export interface Db {
  v: 1;
  records: ContentRecord[];
  currentId: string | null;
  settings: AppSettings;
}

/** Allowed record status transitions — the state machine of §7.1, made executable. */
export const TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  draft: ["skipped", "downloaded"],
  skipped: [],
  downloaded: ["published"],
  published: [],
};

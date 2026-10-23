// ─────────────────────────────────────────────────────────────────────────────
// Generation pipeline (§7.3). Orchestrates S1→S7 with stage events.
// S1 context · S2 (pick supplied by the selection screen) · S3 model call ·
// S4 validation gate (+ one repair pass, then silent re-pick) · S5 image match ·
// S6 variant resolution · S7 record build (the caller commits it to STORE).
// Invariants: only S3 costs money; failures never touch STORE (Invariant 5).
// ─────────────────────────────────────────────────────────────────────────────

import { getImages, getVoice } from "./library";
import { matchImage } from "./matching";
import { recommend, recentGists, type SubjectChoice } from "./selectors";
import { validateGeneration } from "./validation";
import type {
  ContentRecord,
  GeneratePayload,
  ModelOutput,
  PipelineStage,
  Variant,
} from "./types";

export type GenerateFn = (
  payload: GeneratePayload
) => Promise<{ content: ModelOutput; meta: { model: string; promptVersion: string } }>;

export class GenerationError extends Error {
  kind: "network" | "rejected" | "empty";
  constructor(message: string, kind: "network" | "rejected" | "empty") {
    super(message);
    this.name = "GenerationError";
    this.kind = kind;
  }
}

export interface RunOptions {
  records: ContentRecord[];
  pick: SubjectChoice;
  generate: GenerateFn;
  onStage: (stage: PipelineStage, detail?: string) => void;
}

/** initial attempt + up to 2 silent re-picks after double-rejection */
const MAX_ATTEMPTS = 3;

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makePayload(
  pick: SubjectChoice,
  recent: string[],
  blacklist: string[],
  feedback?: string
): GeneratePayload {
  return {
    category: { id: pick.category.id, label: pick.category.label },
    direction: {
      id: pick.direction.id,
      label: pick.direction.label,
      slotProfile: pick.direction.slotProfile,
      budget: pick.direction.budget,
      guidance: pick.direction.guidance,
    },
    subject: {
      id: pick.subject.id,
      label: pick.subject.label,
      guidance: pick.subject.guidance,
      imageTags: pick.subject.imageTags,
    },
    voice: getVoice(),
    recentGists: recent,
    blacklist,
    feedback,
  };
}

export async function runGeneration(opts: RunOptions): Promise<ContentRecord> {
  const voice = getVoice();
  const images = getImages();

  opts.onStage("context", "Fetching latest 30 gists & voice rules");
  const gists = recentGists(opts.records);

  const blacklist: string[] = [];
  let pick = opts.pick;
  let repairPasses = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const next = recommend(opts.records, blacklist);
      if (!next) {
        throw new GenerationError(
          "No eligible subjects remain — the library needs new subjects.",
          "empty"
        );
      }
      pick = next;
    }

    opts.onStage(
      "recommend",
      `${pick.category.label} · ${pick.direction.label} · ${pick.subject.label}`
    );

    let payload = makePayload(pick, gists, blacklist);

    opts.onStage("calling", pick.subject.label);
    const first = await opts.generate(payload);
    let output = first.content;
    let meta = first.meta;

    opts.onStage("validating");
    let result = validateGeneration({
      content: output,
      budget: pick.direction.budget,
      voice,
      recentGists: gists,
    });

    if (!result.ok) {
      // One repair pass (S4) — the user never sees a rejected draft.
      repairPasses += 1;
      opts.onStage("validating", "First draft missed the rules — rewriting");
      payload = makePayload(
        pick,
        gists,
        blacklist,
        `Previous attempt was rejected. Fix these problems and write a different message: ${result.reasons.join("; ")}`
      );
      const repaired = await opts.generate(payload);
      output = repaired.content;
      meta = repaired.meta;
      result = validateGeneration({
        content: output,
        budget: pick.direction.budget,
        voice,
        recentGists: gists,
      });
      if (!result.ok) {
        // Twice-rejected: blacklist subject, silently re-pick (S2).
        blacklist.push(pick.subject.id);
        continue;
      }
    }

    // S5 — image match
    opts.onStage("matching", "Finding an illustration for this subject");
    const wantsImage = pick.direction.slotProfile === "lesson";
    const image = wantsImage
      ? matchImage(images, pick.category.id, pick.subject, output.imageTags)
      : null;

    // S6 — variant resolution (the renderer computes final geometry)
    opts.onStage("layout", image ? "lesson" : "text-only");
    const variant: Variant =
      pick.direction.slotProfile === "announcement"
        ? "announcement"
        : image
          ? "lesson"
          : "text-only";

    // S7 — record build (committed by the caller)
    opts.onStage("committing");
    const now = Date.now();
    const record: ContentRecord = {
      id: uid(),
      createdAt: now,
      updatedAt: now,
      status: "draft",
      variant,
      source: {
        categoryId: pick.category.id,
        directionId: pick.direction.id,
        subjectId: pick.subject.id,
        overridden: pick.overridden,
      },
      content: {
        label: pick.category.label,
        headline: output.headline,
        body: output.body,
        tip: output.tip,
        closing: output.closing,
      },
      gist: output.gist,
      imageId: image?.id ?? null,
      imageTags: output.imageTags,
      meta: {
        model: meta.model,
        repairPasses,
        promptVersion: meta.promptVersion,
      },
    };

    opts.onStage("done");
    return record;
  }

  throw new GenerationError(
    "Generation kept failing quality checks — try again or pick another subject.",
    "rejected"
  );
}

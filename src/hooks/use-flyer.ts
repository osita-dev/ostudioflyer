// ─────────────────────────────────────────────────────────────────────────────
// useFlyer — turns a ContentRecord into everything the renderer needs:
// shell assets, the subject photo (curated library OR AI data-URL), and the
// computed LayoutModel. Broken/missing photo → text-only fallback (board D7),
// never a broken box.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { computeLayout, type LayoutModel } from "@/domain/layout";
import { getImages } from "@/domain/library";
import type { ContentRecord, ImageEntry } from "@/domain/types";
import { loadShellAssets, loadSubjectImage, type ShellAssets } from "@/services/assets";

export interface FlyerRender {
  layout: LayoutModel | null;
  shell: ShellAssets | null;
  subjectImage: HTMLImageElement | null;
  imageBroken: boolean;
  /** Curated library entry — null for AI images. */
  imageEntry: ImageEntry | null;
  /** True when the record carries an AI illustration instead of a curated photo. */
  isAiImage: boolean;
}

/** Curated library entry, or null when there's no imageId (or it's an AI image). */
function entryFor(record: ContentRecord | null): ImageEntry | null {
  if (!record?.imageId || record.aiImage) return null;
  return getImages().images.find((i) => i.id === record.imageId) ?? null;
}

export function useFlyer(record: ContentRecord | null): FlyerRender {
  const [shell, setShell] = useState<ShellAssets | null>(null);
  const [subjectImage, setSubjectImage] = useState<HTMLImageElement | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  const imageEntry = entryFor(record);
  const isAiImage = !!record?.aiImage;
  // Key on the AI data-URL too, so re-rolling the image reloads it.
  const imageKey = isAiImage ? (record?.aiImage?.src ?? null) : (record?.imageId ?? null);

  useEffect(() => {
    let alive = true;
    loadShellAssets().then((s) => {
      if (alive) setShell(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setSubjectImage(null);
    setImageBroken(false);

    // AI image: the src IS the loadable data-URL.
    if (isAiImage && record?.aiImage?.src) {
      loadSubjectImage(record.aiImage.src).then((img) => {
        if (!alive) return;
        if (img) setSubjectImage(img);
        else setImageBroken(true);
      });
      return () => {
        alive = false;
      };
    }

    // Curated: need both the id and a matching library entry.
    if (!imageKey || !imageEntry) {
      if (imageKey && !imageEntry) setImageBroken(true);
      return;
    }
    loadSubjectImage(imageEntry.file).then((img) => {
      if (!alive) return;
      if (img) setSubjectImage(img);
      else setImageBroken(true);
    });
    return () => {
      alive = false;
    };
  }, [imageKey, imageEntry, isAiImage, record?.aiImage?.src]);

  const layout = useMemo(() => {
    if (!record) return null;
    const showImage = record.variant === "lesson" && !!subjectImage && (isAiImage || !!imageEntry);
    const variant = record.variant === "lesson" && !showImage ? "text-only" : record.variant;
    // Layout only needs to know an image occupies the box (for the narrow col);
    // the actual pixels come from subjectImage. Synthesize a placeholder entry
    // for AI images so the layout math is identical.
    const entryForLayout = isAiImage
      ? ({ id: "ai", file: "", tags: [], credit: "AI", license: "" } as ImageEntry)
      : imageEntry;
    return computeLayout(record.content, variant, showImage ? entryForLayout : null);
  }, [record, subjectImage, imageEntry, isAiImage]);

  return { layout, shell, subjectImage, imageBroken, imageEntry, isAiImage };
}

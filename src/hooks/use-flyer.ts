// ─────────────────────────────────────────────────────────────────────────────
// useFlyer — turns a ContentRecord into everything the renderer needs:
// shell assets, the curated subject photo, and the computed LayoutModel.
// Broken/missing photo → text-only fallback (board D7), never a broken box.
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
  imageEntry: ImageEntry | null;
}

function entryFor(record: ContentRecord | null): ImageEntry | null {
  if (!record?.imageId) return null;
  return getImages().images.find((i) => i.id === record.imageId) ?? null;
}

export function useFlyer(record: ContentRecord | null): FlyerRender {
  const [shell, setShell] = useState<ShellAssets | null>(null);
  const [subjectImage, setSubjectImage] = useState<HTMLImageElement | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  const imageEntry = entryFor(record);
  const imageKey = record?.imageId ?? null;

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
  }, [imageKey, imageEntry]);

  const layout = useMemo(() => {
    if (!record) return null;
    const showImage = record.variant === "lesson" && !!subjectImage && !!imageEntry;
    const variant = record.variant === "lesson" && !showImage ? "text-only" : record.variant;
    return computeLayout(record.content, variant, showImage ? imageEntry : null);
  }, [record, subjectImage, imageEntry]);

  return { layout, shell, subjectImage, imageBroken, imageEntry };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout engine (FR-31, FR-33). Pure geometry: content + variant + image
// → a LayoutModel in 1080×1920 flyer units. Both the DOM preview (FlyerView)
// and the canvas exporter paint THIS model — one truth, two painters
// (Invariant 6). Includes word-wrap, auto-fit and overflow fallbacks.
// ─────────────────────────────────────────────────────────────────────────────

import { FLYER_COLORS, FLYER_FONTS, SHELL } from "./shell";
import type { GenerationContent, ImageEntry, Variant } from "./types";

export type FontKey = "headline" | "body" | "script";

export interface LaidText {
  lines: string[];
  x: number;
  y: number;
  font: FontKey;
  size: number;
  lineHeight: number;
  weight: number;
  color: string;
  tracking: number;
  align: "left" | "center";
}

export interface LaidRule {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface LaidImage {
  x: number;
  y: number;
  w: number;
  h: number;
  entry: ImageEntry;
}

export interface LayoutModel {
  variant: Variant;
  texts: LaidText[];
  rules: LaidRule[];
  image: LaidImage | null;
  fallbacks: string[];
  overflow: boolean;
}

// ── measurement context ──────────────────────────────────────────────────────

let measureCtx: CanvasRenderingContext2D | null = null;
let trackingSupported: boolean | null = null;

function mctx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement("canvas");
    const got = c.getContext("2d");
    if (!got) throw new Error("Canvas 2D unavailable — cannot lay out the flyer.");
    measureCtx = got;
  }
  return measureCtx;
}

function hasLetterSpacing(): boolean {
  if (trackingSupported === null) {
    trackingSupported = "letterSpacing" in mctx();
  }
  return trackingSupported;
}

export function measureLine(
  text: string,
  font: FontKey,
  size: number,
  weight: number,
  tracking: number
): number {
  const c = mctx();
  c.font = `${weight} ${size}px ${FLYER_FONTS[font]}`;
  if (tracking > 0 && hasLetterSpacing()) {
    const ls = c as CanvasRenderingContext2D & { letterSpacing: string };
    ls.letterSpacing = `${tracking}px`;
    const w = c.measureText(text).width;
    ls.letterSpacing = "0px";
    return w;
  }
  return c.measureText(text).width + tracking * Math.max(0, text.length - 1);
}

function wrap(
  text: string,
  font: FontKey,
  size: number,
  weight: number,
  tracking: number,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  const fits = (t: string) => measureLine(t, font, size, weight, tracking) <= maxWidth;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      if (fits(word)) {
        line = word;
      } else {
        // Pathological long word: hard-break by characters.
        let chunk = "";
        for (const ch of word) {
          if (fits(chunk + ch)) chunk += ch;
          else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        line = chunk;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface FitSpec {
  font: FontKey;
  weight: number;
  tracking: number;
  max: number;
  min: number;
  lineHeightFactor: number;
  boxW: number;
  maxLines: number;
}

interface FitResult {
  lines: string[];
  size: number;
  lineHeight: number;
  height: number;
}

/** Auto-fit: largest size (in 2px steps) whose wrap fits the line budget. */
function fit(text: string, spec: FitSpec): FitResult {
  for (let size = Math.round(spec.max); size >= spec.min; size -= 2) {
    const lines = wrap(text, spec.font, size, spec.weight, spec.tracking, spec.boxW);
    if (lines.length > 0 && lines.length <= spec.maxLines) {
      const lineHeight = Math.round(size * spec.lineHeightFactor);
      return { lines, size, lineHeight, height: lines.length * lineHeight };
    }
  }
  const lines = wrap(text, spec.font, spec.min, spec.weight, spec.tracking, spec.boxW).slice(
    0,
    spec.maxLines
  );
  const lineHeight = Math.round(spec.min * spec.lineHeightFactor);
  return { lines, size: spec.min, lineHeight, height: lines.length * lineHeight };
}

// ── composition ──────────────────────────────────────────────────────────────

function withGoldPeriod(
  headline: FitResult,
  x: number,
  y: number,
  color: string,
  texts: LaidText[]
): void {
  if (headline.lines.length === 0) return;
  const idx = headline.lines.length - 1;
  const last = headline.lines[idx];
  const trimmed = last.replace(/[.!?]+$/, "");
  const hadPunct = trimmed !== last;
  headline.lines[idx] = trimmed;
  const base: LaidText = {
    lines: headline.lines,
    x,
    y,
    font: "headline",
    size: headline.size,
    lineHeight: headline.lineHeight,
    weight: 700,
    color,
    tracking: 0,
    align: "left",
  };
  texts.push(base);
  if (!hadPunct) {
    const w = measureLine(trimmed, "headline", headline.size, 700, 0);
    texts.push({
      lines: ["."],
      x: x + w,
      y: y + idx * headline.lineHeight,
      font: "headline",
      size: headline.size,
      lineHeight: headline.lineHeight,
      weight: 700,
      color: FLYER_COLORS.gold,
      tracking: 0,
      align: "left",
    });
  }
}

interface Build {
  texts: LaidText[];
  rules: LaidRule[];
  bottom: number;
}

function build(
  content: GenerationContent,
  variant: Variant,
  image: ImageEntry | null,
  q: number,
  dropped: string[]
): Build {
  const safe = SHELL.safe;
  const texts: LaidText[] = [];
  const rules: LaidRule[] = [];
  const narrow = variant === "lesson" && image !== null;
  const colW = narrow ? SHELL.narrowCol.w : safe.w;
  let y = safe.y;

  if (variant === "announcement") {
    // Small intro line (optional) + oversized headline, vertically centred.
    let total = 0;
    let intro: FitResult | null = null;
    if (content.body) {
      intro = fit(content.body, {
        font: "body",
        weight: 400,
        tracking: 0,
        max: Math.round(36 * q),
        min: 26,
        lineHeightFactor: 1.45,
        boxW: safe.w,
        maxLines: 2,
      });
      total += intro.height + 36;
    }
    const head = fit(content.headline, {
      font: "headline",
      weight: 700,
      tracking: 0,
      max: Math.round(150 * q),
      min: 64,
      lineHeightFactor: 1.1,
      boxW: safe.w,
      maxLines: 4,
    });
    total += head.height;

    y = safe.y + Math.max(0, Math.round((safe.h - total) / 2));
    if (intro) {
      texts.push({
        lines: intro.lines,
        x: safe.x,
        y,
        font: "body",
        size: intro.size,
        lineHeight: intro.lineHeight,
        weight: 400,
        color: FLYER_COLORS.muted,
        tracking: 0,
        align: "left",
      });
      y += intro.height + 36;
    }
    withGoldPeriod(head, safe.x, y, FLYER_COLORS.ink, texts);
    y += head.height;
    if (content.closing && !dropped.includes("closing")) {
      const closing = fit(content.closing.toUpperCase(), {
        font: "body",
        weight: 600,
        tracking: 3,
        max: Math.round(26 * q),
        min: 18,
        lineHeightFactor: 1.5,
        boxW: safe.w,
        maxLines: 2,
      });
      texts.push({
        lines: closing.lines,
        x: safe.x,
        y: y + 40,
        font: "body",
        size: closing.size,
        lineHeight: closing.lineHeight,
        weight: 600,
        color: FLYER_COLORS.ink,
        tracking: 3,
        align: "left",
      });
      y += 40 + closing.height;
    }
    return { texts, rules, bottom: y };
  }

  // ── lesson / text-only ─────────────────────────────────────────────────────
  // 1. Category label + trailing gold rule
  const labelSize = Math.round(30 * q);
  const labelW = measureLine(content.label, "body", labelSize, 600, 4);
  texts.push({
    lines: [content.label],
    x: safe.x,
    y,
    font: "body",
    size: labelSize,
    lineHeight: Math.round(labelSize * 1.4),
    weight: 600,
    color: FLYER_COLORS.gold,
    tracking: 4,
    align: "left",
  });
  const ruleX = safe.x + labelW + 24;
  rules.push({
    x: ruleX,
    y: y + Math.round(labelSize * 0.65),
    w: Math.max(0, safe.x + safe.w - ruleX),
    h: 3,
    color: FLYER_COLORS.gold,
  });
  y += Math.round(labelSize * 1.4) + 28;

  // 2. Headline (full safe width) + gold period
  const head = fit(content.headline, {
    font: "headline",
    weight: 700,
    tracking: 0,
    max: Math.round(74 * q),
    min: 40,
    lineHeightFactor: 1.16,
    boxW: safe.w,
    maxLines: 5,
  });
  withGoldPeriod(head, safe.x, y, FLYER_COLORS.ink, texts);
  y += head.height + 30;

  // 3. Body
  if (content.body && !dropped.includes("body")) {
    const body = fit(content.body, {
      font: "body",
      weight: 400,
      tracking: 0,
      max: Math.round(30 * q),
      min: 22,
      lineHeightFactor: 1.5,
      boxW: colW,
      maxLines: narrow ? 6 : 7,
    });
    texts.push({
      lines: body.lines,
      x: safe.x,
      y,
      font: "body",
      size: body.size,
      lineHeight: body.lineHeight,
      weight: 400,
      color: FLYER_COLORS.ink,
      tracking: 0,
      align: "left",
    });
    y += body.height + 34;
  }

  // 4. Quick Tip block (mandatory on lesson/text-only per D32)
  if (content.tip && !dropped.includes("tip")) {
    const scriptSize = Math.round(42 * q);
    texts.push({
      lines: ["Quick Tip"],
      x: safe.x,
      y,
      font: "script",
      size: scriptSize,
      lineHeight: Math.round(scriptSize * 1.3),
      weight: 400,
      color: FLYER_COLORS.gold,
      tracking: 0,
      align: "left",
    });
    y += Math.round(scriptSize * 1.3) + 8;
    const tip = fit(content.tip, {
      font: "body",
      weight: 400,
      tracking: 0,
      max: Math.round(27 * q),
      min: 20,
      lineHeightFactor: 1.5,
      boxW: colW,
      maxLines: 5,
    });
    texts.push({
      lines: tip.lines,
      x: safe.x,
      y,
      font: "body",
      size: tip.size,
      lineHeight: tip.lineHeight,
      weight: 400,
      color: FLYER_COLORS.muted,
      tracking: 0,
      align: "left",
    });
    y += tip.height + 30;
  }

  // 5. Closing tagline
  if (content.closing && !dropped.includes("closing")) {
    const closing = fit(content.closing.toUpperCase(), {
      font: "body",
      weight: 600,
      tracking: 3,
      max: Math.round(25 * q),
      min: 18,
      lineHeightFactor: 1.5,
      boxW: colW,
      maxLines: 2,
    });
    rules.push({
      x: safe.x,
      y: y + 6,
      w: Math.round(140 * q),
      h: 3,
      color: FLYER_COLORS.gold,
    });
    texts.push({
      lines: closing.lines,
      x: safe.x,
      y: y + 28,
      font: "body",
      size: closing.size,
      lineHeight: closing.lineHeight,
      weight: 600,
      color: FLYER_COLORS.ink,
      tracking: 3,
      align: "left",
    });
    y += 28 + closing.height;
  }

  return { texts, rules, bottom: y };
}

/**
 * Compute the final layout: auto-shrink (quality 1 → 0.78), then drop closing,
 * then tip, before ever allowing overflow of the safe content box.
 */
export function computeLayout(
  content: GenerationContent,
  variant: Variant,
  image: ImageEntry | null
): LayoutModel {
  const safe = SHELL.safe;
  const maxBottom = safe.y + safe.h;
  const dropped: string[] = [];
  let q = 1;
  let result = build(content, variant, image, q, dropped);

  while (result.bottom > maxBottom && q > 0.78) {
    q = Math.round((q - 0.06) * 100) / 100;
    result = build(content, variant, image, q, dropped);
  }
  while (result.bottom > maxBottom) {
    if (content.closing && !dropped.includes("closing")) dropped.push("closing");
    else if (content.tip && !dropped.includes("tip")) dropped.push("tip");
    else if (content.body && !dropped.includes("body")) dropped.push("body");
    else break;
    result = build(content, variant, image, q, dropped);
  }

  const fallbacks = dropped.map(
    (d) => `"${d}" was too long for the panel and was dropped from the layout`
  );

  return {
    variant,
    texts: result.texts,
    rules: result.rules,
    image:
      image && variant === "lesson"
        ? {
            x: SHELL.imageBox.x,
            y: SHELL.imageBox.y,
            w: SHELL.imageBox.w,
            h: SHELL.imageBox.h,
            entry: image,
          }
        : null,
    fallbacks,
    overflow: result.bottom > maxBottom,
  };
}

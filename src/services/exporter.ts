// ─────────────────────────────────────────────────────────────────────────────
// EXPORTER (FR-41, Invariant 6, Invariant 7). Paints the SAME LayoutModel the
// preview renders, at 2× on a canvas → 2160×3840 PNG. Runs the font guard
// BEFORE rasterising and only then flips the record to `downloaded`
// (Flow E ordering: guard → raster → save → status).
// ─────────────────────────────────────────────────────────────────────────────

import { CANVAS, FLYER_COLORS, FLYER_FONTS, SHELL } from "@/domain/shell";
import type { LayoutModel, LaidText } from "@/domain/layout";
import { measureLine } from "@/domain/layout";
import type { ShellAssets } from "./assets";
import { guardFontsForExport } from "./fonts";

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function paintShell(ctx: CanvasRenderingContext2D, assets: ShellAssets | null) {
  if (assets?.background) {
    ctx.drawImage(assets.background, 0, 0, CANVAS.w, CANVAS.h);
    return;
  }

  // ── CSS-equivalent reconstruction (used until background-9x16.png exists) ──
  ctx.fillStyle = FLYER_COLORS.black;
  ctx.fillRect(0, 0, CANVAS.w, CANVAS.h);

  // Gold diagonal line clusters, top-left + bottom-right
  ctx.strokeStyle = FLYER_COLORS.gold;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.globalAlpha = 0.25 + (i % 3) * 0.2;
    ctx.beginPath();
    ctx.moveTo(-260 + i * 42, 0);
    ctx.lineTo(260 + i * 42, 520);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CANVAS.w - (260 + i * 42), CANVAS.h);
    ctx.lineTo(CANVAS.w - (-260 + i * 42), CANVAS.h - 520);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // White paper panel + rolled left edge
  const p = SHELL.panel;
  ctx.fillStyle = FLYER_COLORS.paper;
  rr(ctx, p.x, p.y, p.w, p.h, p.radius);
  ctx.fill();
  const rollGrad = ctx.createLinearGradient(p.x, 0, p.x + SHELL.roll.w, 0);
  rollGrad.addColorStop(0, "#E7E2D6");
  rollGrad.addColorStop(0.55, "#FBFAF6");
  rollGrad.addColorStop(1, "#F2EEE4");
  ctx.fillStyle = rollGrad;
  rr(ctx, p.x, p.y, SHELL.roll.w, p.h, p.radius);
  ctx.fill();
  ctx.fillStyle = FLYER_COLORS.gold;
  ctx.beginPath();
  ctx.ellipse(p.x + SHELL.roll.w / 2, p.y + 16, SHELL.roll.w / 2, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#C79A2E";
  ctx.beginPath();
  ctx.ellipse(p.x + SHELL.roll.w / 2, p.y + 16, SHELL.roll.w / 2 - 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Logo (asset or text fallback)
  const l = SHELL.logo;
  if (assets?.logo) {
    ctx.drawImage(assets.logo, l.x, l.y, l.w, l.h);
  } else {
    ctx.textAlign = "center";
    ctx.fillStyle = FLYER_COLORS.gold;
    ctx.font = `300 96px ${FLYER_FONTS.headline}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("O", l.x + 70, l.y + 110);
    ctx.font = `500 64px ${FLYER_FONTS.script}`;
    ctx.fillText("studio", l.x + 180, l.y + 100);
    ctx.font = `600 24px ${FLYER_FONTS.body}`;
    ctx.fillText("I N N O V A T I O N S", l.x + 180, l.y + 145);
    ctx.textAlign = "left";
  }

  // Footer: rule + envelope + email
  const fy = SHELL.footer.y;
  ctx.strokeStyle = FLYER_COLORS.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(250, fy + 18);
  ctx.lineTo(495, fy + 18);
  ctx.moveTo(585, fy + 18);
  ctx.lineTo(830, fy + 18);
  ctx.stroke();
  ctx.strokeRect(510, fy + 2, 60, 36);
  ctx.beginPath();
  ctx.moveTo(510, fy + 2);
  ctx.lineTo(540, fy + 26);
  ctx.lineTo(570, fy + 2);
  ctx.stroke();
  ctx.fillStyle = FLYER_COLORS.gold;
  ctx.font = `400 34px ${FLYER_FONTS.body}`;
  ctx.textAlign = "center";
  ctx.fillText(SHELL.footer.email, CANVAS.w / 2, fy + 108);
  ctx.textAlign = "left";
}

function paintImage(
  ctx: CanvasRenderingContext2D,
  layout: LayoutModel,
  image: HTMLImageElement | null,
  assets: ShellAssets | null
) {
  if (!layout.image || !image) return;
  const b = layout.image;

  if (assets?.mask) {
    // Brush-edge mask: image ∩ mask, composited offscreen.
    const off = document.createElement("canvas");
    off.width = b.w;
    off.height = b.h;
    const octx = off.getContext("2d") as Ctx | null;
    if (!octx) return;
    octx.drawImage(image, 0, 0, b.w, b.h);
    octx.globalCompositeOperation = "destination-in";
    octx.drawImage(assets.mask, 0, 0, b.w, b.h);
    ctx.drawImage(off, b.x, b.y);
    return;
  }

  ctx.save();
  rr(ctx, b.x, b.y, b.w, b.h, SHELL.imageBox.radius);
  ctx.clip();
  ctx.drawImage(image, b.x, b.y, b.w, b.h);
  ctx.restore();
}

function paintTracked(
  ctx: Ctx,
  text: string,
  x: number,
  baseline: number,
  tracking: number
) {
  if (tracking <= 0 || ctx.letterSpacing !== undefined) {
    if (tracking > 0) ctx.letterSpacing = `${tracking}px`;
    ctx.fillText(text, x, baseline);
    if (tracking > 0) ctx.letterSpacing = "0px";
    return;
  }
  // Fallback for engines without letterSpacing: draw per character.
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, baseline);
    cx += ctx.measureText(ch).width + tracking;
  }
}

function paintTexts(ctx: CanvasRenderingContext2D, texts: LaidText[]) {
  const c = ctx as Ctx;
  c.textAlign = "left";
  for (const t of texts) {
    c.font = `${t.weight} ${t.size}px ${FLYER_FONTS[t.font]}`;
    c.fillStyle = t.color;
    c.textBaseline = "alphabetic";
    for (let i = 0; i < t.lines.length; i++) {
      // Half-leading + ascent ≈ browser's line-box centering (matches DOM preview).
      const baseline = t.y + i * t.lineHeight + (t.lineHeight - t.size) / 2 + t.size * 0.78;
      paintTracked(c, t.lines[i], t.x, baseline, t.tracking);
    }
  }
}

export function slugName(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "flyer"
  );
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Full export flow: guard fonts → paint at 2× → PNG download. */
export async function exportFlyerPng(
  layout: LayoutModel,
  image: HTMLImageElement | null,
  assets: ShellAssets | null,
  filenameHint: string
): Promise<void> {
  await guardFontsForExport(); // Invariant 7 — never export wrong typography silently

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS.w * scale;
  canvas.height = CANVAS.h * scale;
  const ctx = canvas.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("Canvas 2D unavailable — cannot export.");

  ctx.scale(scale, scale);
  paintShell(ctx, assets);
  paintImage(ctx, layout, image, assets);
  for (const rule of layout.rules) {
    ctx.fillStyle = rule.color;
    ctx.fillRect(rule.x, rule.y, rule.w, rule.h);
  }
  paintTexts(ctx, layout.texts);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG encoding failed — try again.");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ostudio-${slugName(filenameHint)}-${stamp()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Width of the label line — needed by the DOM painter for the gold rule. */
export function labelLineWidth(label: string, size: number): number {
  return measureLine(label, "body", size, 600, 4);
}

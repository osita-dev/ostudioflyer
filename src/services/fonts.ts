// ─────────────────────────────────────────────────────────────────────────────
// Brand font loader + guard (Invariant 7, NFR-04).
// Self-hosted woff2 files in /public/fonts. If a file exists it MUST load
// before export — we hard-fail rather than silently ship wrong typography.
// If files are absent the app runs in visible "fallback typography" mode.
// ─────────────────────────────────────────────────────────────────────────────

import { ASSET_PATHS } from "@/domain/shell";

export type FontState = "loaded" | "fallback" | "error";

export interface FontStatus {
  headline: FontState;
  body: FontState;
  script: FontState;
  anyBrandLoaded: boolean;
  anyBrandMissing: boolean;
}

const status: FontStatus = {
  headline: "fallback",
  body: "fallback",
  script: "fallback",
  anyBrandLoaded: false,
  anyBrandMissing: false,
};

async function fileReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureOne(
  key: "headline" | "body" | "script"
): Promise<FontState> {
  const { file, family } = ASSET_PATHS.fonts[key];
  if (!(await fileReachable(file))) return "fallback";
  try {
    await document.fonts.load(`700 100px ${family}`);
    await document.fonts.load(`400 100px ${family}`);
    return document.fonts.check(`700 100px ${family}`) ? "loaded" : "error";
  } catch {
    return "error";
  }
}

let inflight: Promise<FontStatus> | null = null;

export function ensureFonts(): Promise<FontStatus> {
  if (!inflight) {
    inflight = (async () => {
      status.headline = await ensureOne("headline");
      status.body = await ensureOne("body");
      status.script = await ensureOne("script");
      const states = [status.headline, status.body, status.script];
      status.anyBrandLoaded = states.some((s) => s === "loaded");
      status.anyBrandMissing = states.some((s) => s !== "loaded");
      return status;
    })();
  }
  return inflight;
}

export function getFontStatus(): FontStatus {
  return status;
}

/** Export guard: throws if a brand font was supplied but did not load. */
export async function guardFontsForExport(): Promise<void> {
  const s = await ensureFonts();
  if (s.headline === "error" || s.body === "error" || s.script === "error") {
    throw new Error(
      "A brand font file exists but failed to load. Fix /public/fonts before exporting."
    );
  }
}

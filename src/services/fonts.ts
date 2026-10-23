// ─────────────────────────────────────────────────────────────────────────────
// Brand font loader (Invariant 7). Typography comes from Google Fonts (the
// <link> in index.html): Poppins (headline), Inter (body), Great Vibes
// (script). Preview and canvas export paint the SAME family stacks
// (FLYER_FONTS in domain/shell), so even if the CDN is unreachable the PNG
// matches the preview exactly. ensureFonts() just warms the faces so layout
// measurement and rasterisation happen after load, not before.
// ─────────────────────────────────────────────────────────────────────────────

export type FontState = "loaded" | "fallback";

export interface FontStatus {
  headline: FontState;
  body: FontState;
  script: FontState;
  anyBrandLoaded: boolean;
  anyBrandMissing: boolean;
}

/** Every face the flyer paints (must mirror FLYER_FONTS in domain/shell). */
const FACES: Record<"headline" | "body" | "script", string[]> = {
  headline: ["300 100px 'Poppins'", "600 100px 'Poppins'", "700 100px 'Poppins'"],
  body: [
    "400 100px 'Inter'",
    "500 100px 'Inter'",
    "600 100px 'Inter'",
    "700 100px 'Inter'",
  ],
  script: ["400 100px 'Great Vibes'"],
};

const status: FontStatus = {
  headline: "fallback",
  body: "fallback",
  script: "fallback",
  anyBrandLoaded: false,
  anyBrandMissing: false,
};

const LOAD_TIMEOUT_MS = 10_000;

async function loadGroup(faces: string[]): Promise<FontState> {
  try {
    const all = Promise.all(faces.map((f) => document.fonts.load(f)));
    const timedOut = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), LOAD_TIMEOUT_MS)
    );
    const result = await Promise.race([all, timedOut]);
    if (result === "timeout") return "fallback"; // offline / CDN blocked
    return document.fonts.check(faces[0]) ? "loaded" : "fallback";
  } catch {
    return "fallback";
  }
}

let inflight: Promise<FontStatus> | null = null;

export function ensureFonts(): Promise<FontStatus> {
  if (!inflight) {
    inflight = (async () => {
      status.headline = await loadGroup(FACES.headline);
      status.body = await loadGroup(FACES.body);
      status.script = await loadGroup(FACES.script);
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

/**
 * Export guard: waits until faces are loaded (or known-fallback) so the canvas
 * rasterises the same typography the preview shows. With CDN fonts there is
 * nothing "present but broken" like a bad woff2 file, and preview === export
 * holds by construction — so no hard-fail.
 */
export async function guardFontsForExport(): Promise<void> {
  await ensureFonts();
}

// ─────────────────────────────────────────────────────────────────────────────
// The permanent flyer shell: canvas geometry, brand colours, fonts, asset paths.
// These numbers describe the 9:16 composition (Image 2's wide-panel layout).
// Adjust here if the exported background asset ever changes proportions.
// ─────────────────────────────────────────────────────────────────────────────

export const CANVAS = { w: 1080, h: 1920 } as const;

export const SHELL = {
  /** White paper panel */
  panel: { x: 110, y: 330, w: 860, h: 1220, radius: 48 },
  /** Rolled edge of the paper (drawn inside the panel's left) */
  roll: { w: 110 },
  /** Safe content box inside the panel (padding included) */
  safe: { x: 280, y: 450, w: 600, h: 980 },
  /** Bottom-right illustration box (lesson variant) */
  imageBox: { x: 600, y: 940, w: 340, h: 540, radius: 18 },
  /** Narrow text column beside the image */
  narrowCol: { w: 300 },
  /** Logo block, top-right on the black area */
  logo: { x: 700, y: 90, w: 300, h: 170 },
  /** Footer: rule + envelope + email */
  footer: { y: 1660, email: "info@ostudioinnovations.com" },
} as const;

export const FLYER_FONTS = {
  headline: "'OStudioHeadline', 'Poppins', 'Segoe UI', system-ui, sans-serif",
  body: "'OStudioBody', 'Inter', system-ui, sans-serif",
  script: "'OStudioScript', 'Segoe Script', 'Brush Script MT', cursive",
} as const;

export const FLYER_WEIGHTS = {
  headline: 700,
  label: 600,
  body: 400,
  closing: 600,
} as const;

export const FLYER_COLORS = {
  paper: "#F7F5F0",
  paperEdge: "#ECE8DF",
  ink: "#1C1A17",
  muted: "#5B564E",
  gold: "#C9A227",
  goldDeep: "#A98416",
  black: "#0C0B09",
} as const;

/** Asset contract — drop files at these exact paths to upgrade fidelity. */
export const ASSET_PATHS = {
  background: "/flyer/background-9x16.png",
  logo: "/flyer/logo.png",
  mask: "/flyer/brush-mask.png",
  fonts: {
    headline: { file: "/fonts/ostudio-headline.woff2", family: "OStudioHeadline" },
    body: { file: "/fonts/ostudio-body.woff2", family: "OStudioBody" },
    script: { file: "/fonts/ostudio-script.woff2", family: "OStudioScript" },
  },
} as const;

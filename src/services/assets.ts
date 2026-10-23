// ─────────────────────────────────────────────────────────────────────────────
// Asset loader — permanent shell assets (background, logo, brush mask) and
// curated subject photos. Missing files degrade gracefully:
//   background/logo absent → CSS reconstruction (see FlyerView)
//   subject photo absent   → text-only fallback notice (board D7)
// ─────────────────────────────────────────────────────────────────────────────

import { ASSET_PATHS } from "@/domain/shell";

export interface ShellAssets {
  background: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  mask: HTMLImageElement | null;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

let shellCache: ShellAssets | null = null;

export async function loadShellAssets(): Promise<ShellAssets> {
  if (shellCache) return shellCache;
  const [background, logo, mask] = await Promise.all([
    loadImage(ASSET_PATHS.background),
    loadImage(ASSET_PATHS.logo),
    loadImage(ASSET_PATHS.mask),
  ]);
  shellCache = { background, logo, mask };
  return shellCache;
}

export function getShellAssets(): ShellAssets | null {
  return shellCache;
}

/** Curated photo by URL; null on failure → caller switches to text-only. */
export function loadSubjectImage(url: string): Promise<HTMLImageElement | null> {
  return loadImage(url);
}

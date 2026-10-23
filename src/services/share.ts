// ─────────────────────────────────────────────────────────────────────────────
// SHARE — gets a finished flyer into a social platform's composer with the
// fewest possible taps.
//   Mobile (most phones): Web Share API hands the actual PNG to the native
//   share sheet — Instagram/TikTok/Facebook open WITH the image attached;
//   the user only presses post. No extra steps, nothing to paste.
//   Desktop: no platform exposes a URL that pre-uploads an image, so the
//   honest flow is: open the platform (+ caption prefilled where the platform
//   supports it, otherwise copied to clipboard) → paste caption, attach the
//   downloaded flyer → post.
// ─────────────────────────────────────────────────────────────────────────────

export interface SocialPlatform {
  id: string;
  label: string;
  /** Composer/upload URL. Opens the mobile app where the platform links it. */
  url: (caption: string) => string;
  /** True when the URL itself prefills the caption (nothing to paste). */
  prefills: boolean;
}

const enc = encodeURIComponent;

export const SOCIALS: SocialPlatform[] = [
  { id: "facebook", label: "Facebook", prefills: false, url: () => "https://www.facebook.com/" },
  { id: "instagram", label: "Instagram", prefills: false, url: () => "https://www.instagram.com/" },
  { id: "tiktok", label: "TikTok", prefills: false, url: () => "https://www.tiktok.com/upload" },
  { id: "x", label: "X", prefills: true, url: (c) => `https://twitter.com/intent/tweet?text=${enc(c)}` },
  { id: "linkedin", label: "LinkedIn", prefills: false, url: () => "https://www.linkedin.com/feed/" },
  { id: "youtube", label: "YouTube", prefills: false, url: () => "https://studio.youtube.com/" },
  { id: "whatsapp", label: "WhatsApp", prefills: true, url: (c) => `https://wa.me/?text=${enc(c)}` },
  { id: "telegram", label: "Telegram", prefills: true, url: (c) => `https://t.me/share/url?url=&text=${enc(c)}` },
];

/** True when this browser can share an image file to other apps (most phones). */
export function canShareFiles(): boolean {
  try {
    const probe = new File([], "probe.png", { type: "image/png" });
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [probe] })
    );
  } catch {
    return false;
  }
}

/** Opens the native share sheet with the PNG attached (user picks the app).
 *  Throws AbortError when the user dismisses the sheet — not a failure. */
export async function shareFlyer(file: File, caption: string): Promise<void> {
  await navigator.share({ files: [file], text: caption, title: "O Studio Daily" });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI IMAGE client — calls POST /api/image (Cloudflare FLUX via our proxy),
// then cover-crops the square 1024² result to the EXACT image-box ratio
// (340:540 = 17:27) and re-encodes as JPEG. Matching the box ratio is what
// keeps preview === export: the DOM painter uses object-fit cover and the
// canvas painter stretches — identical only when ratios agree by construction.
// The downscaled data URL is stored ON the record → restoring a draft makes
// no network call (Invariant I1).
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import type { AiImage, ImageGenPayload } from "@/domain/types";

const outputSchema = z.object({
  ok: z.boolean(),
  image: z.string().min(100),
  mime: z.string().default("image/jpeg"),
  meta: z.object({
    model: z.string().default("unknown"),
    promptVersion: z.string().default("v1"),
  }),
  error: z.string().optional(),
});

/** Same error shape as proxy.ts — messages must always be readable. */
export class ImageGenError extends Error {
  hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = "ImageGenError";
    this.hint = hint;
  }
}

/** Hard client cap — the "creating image" spinner never hangs forever. */
const CLIENT_TIMEOUT_MS = 75_000;

/** Export paints at 2× into a 340×540 box → store exactly 680×1080 (17:27). */
const OUT_W = 680;
const OUT_H = 1080;

async function callImageGen(
  payload: ImageGenPayload,
  signal?: AbortSignal
): Promise<z.infer<typeof outputSchema>> {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: combined,
    });
  } catch (err) {
    const name = (err as Error).name;
    if (name === "AbortError" && signal?.aborted) throw err; // user cancelled
    if (name === "TimeoutError" || (name === "AbortError" && !signal?.aborted)) {
      throw new ImageGenError(
        "The image request took too long — the model didn't answer in time.",
        "Your connection may be slow. The flyer will keep its current image — try again in a moment."
      );
    }
    throw new ImageGenError(
      "Couldn't reach the server for the image.",
      "Check your connection, then try again."
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // The GATEWAY answered, not our function (timeout, missing route, hiccup).
    if (res.status === 504)
      throw new ImageGenError(
        "The server timed out waiting for the image model.",
        "Image generation can be slow under load — try again in a moment."
      );
    if (res.status === 429)
      throw new ImageGenError("Too many requests right now.", "Slow down for a moment.");
    if (res.status === 404)
      throw new ImageGenError(
        "The image endpoint isn't available.",
        "Deploy the app with api/image.ts (Vercel) or run it locally with the dev bridge."
      );
    throw new ImageGenError(
      `Server error (${res.status}) while creating the image.`,
      "Usually temporary — try again in a moment."
    );
  }

  const body = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Image server error (${res.status})`;
    throw new ImageGenError(msg);
  }

  const parsed = outputSchema.safeParse(body);
  if (!parsed.success) {
    throw new ImageGenError(
      "The image service returned an unexpected shape.",
      "Try again — if it persists, check api/image.ts."
    );
  }
  return parsed.data;
}

/** Cover-crop any source into the exact flyer box ratio, re-encode JPEG. */
function fitToBox(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new ImageGenError("Canvas 2D unavailable — cannot process the image."));
        return;
      }
      // Cover crop, centred — same math the DOM painter's object-fit:cover does.
      const scale = Math.max(OUT_W / img.naturalWidth, OUT_H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () =>
      reject(new ImageGenError("The generated image couldn't be decoded — try again."));
    img.src = dataUrl;
  });
}

/** Full flow: proxy → decode → exact-ratio JPEG ready for the record. */
export async function generateAiImage(
  payload: ImageGenPayload,
  signal?: AbortSignal
): Promise<AiImage> {
  const out = await callImageGen(payload, signal);
  const raw = `data:${out.mime};base64,${out.image}`;
  const src = await fitToBox(raw);
  return { src, model: out.meta.model };
}

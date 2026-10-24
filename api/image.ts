// ─────────────────────────────────────────────────────────────────────────────
// O Studio Daily — image proxy (NFR-01 sibling of api/generate.ts). The
// Cloudflare token never reaches the browser. The visual prompt is assembled
// HERE from structured data — the client cannot inject arbitrary prompts.
//
// Provider: Cloudflare Workers AI — FLUX.1 [schnell].
//   CLOUDFLARE_ACCOUNT_ID  (required — .env.local for dev, Vercel env for prod)
//   CLOUDFLARE_API_TOKEN   (required — token with "Workers AI" read permission)
//   CF_IMAGE_MODEL         (optional — default @cf/black-forest-labs/flux-1-schnell)
// Free tier: 10,000 neurons/day ≈ ~173 images at the default 4 steps.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

const payloadSchema = z.object({
  category: z.object({ label: z.string().max(120) }),
  direction: z.object({ label: z.string().max(120), guidance: z.string().max(600) }),
  subject: z.object({
    label: z.string().max(160),
    guidance: z.string().max(600),
    imageTags: z.array(z.string().max(40)).max(10).default([]),
  }),
  /** Tag suggestions from the text model's output (may be empty). */
  imageTags: z.array(z.string().max(40)).max(10).default([]),
});

type Payload = z.infer<typeof payloadSchema>;

interface UpstreamImage {
  result?: { image?: string };
  image?: string;
  errors?: { message?: string }[];
}

const PROMPT_VERSION = "v1";

/**
 * Build the visual prompt from structured data only. Brand-style suffix keeps
 * every illustration consistent with the black/gold shell. No text in images —
 * all words live in the white panel, owned by the copy, never smeared by the
 * model (which renders text poorly).
 */
function buildImagePrompt(p: Payload): string {
  const tags = [...new Set([...p.subject.imageTags, ...p.imageTags])]
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

  const prompt = [
    `Editorial illustration for a premium creative studio flyer about ${p.subject.label}.`,
    p.subject.guidance ? `Subject mood: ${p.subject.guidance}` : "",
    `Theme: ${p.direction.label}.`,
    tags.length ? `Visual cues: ${tags.join(", ")}.` : "",
    "Style: elegant, minimal composition, cinematic lighting, deep dark background with warm golden rim light, high contrast, shallow depth of field, professional photography aesthetic.",
    "Portrait-friendly framing, subject slightly off-centre with negative space.",
    "No text, no words, no letters, no watermark, no logo, no people's faces close-up.",
  ]
    .filter(Boolean)
    .join(" ");
  return prompt.slice(0, 2040); // FLUX cap is 2048
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  const code = (err as { code?: string }).code ?? cause?.code ?? "";
  return (
    err.name === "TypeError" ||
    err.name === "TimeoutError" ||
    /ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|CONNECT_TIMEOUT/.test(code)
  );
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

/** Human-readable cause for an upstream HTTP status — never a bare number. */
function upstreamMessage(status: number, model: string, detail: string): string {
  if (status === 401 || status === 403)
    return "Cloudflare rejected the API token — check CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (Vercel env vars, or .env.local for dev).";
  if (status === 404)
    return `Image model not found — check CF_IMAGE_MODEL (currently "${model}").`;
  if (status === 429)
    return "Cloudflare rate limit or daily free quota hit — it resets at midnight UTC. Curated photos still work meanwhile.";
  if (status === 400)
    return `Cloudflare rejected the image request${detail ? `: ${detail}` : " (bad parameters)"}.`;
  if (status === 503)
    return "The image service is at capacity right now. Try again in a minute.";
  if (status >= 500)
    return `The image service had a server error (${status}). Try again shortly.`;
  return `Image service error (${status}).`;
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
  }
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    res.status(503).json({
      error:
        "AI images aren't configured — set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Vercel env vars, or .env.local). Curated photos work meanwhile.",
    });
    return;
  }

  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid image payload." });
    return;
  }

  const model = process.env.CF_IMAGE_MODEL ?? "@cf/black-forest-labs/flux-1-schnell";
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const prompt = buildImagePrompt(parsed.data);

  const callModel = async (): Promise<Response> =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      // Image generation is slower than text — 30s per attempt, then retry.
      body: JSON.stringify({ prompt, steps: 4 }),
      signal: AbortSignal.timeout(30_000),
    });

  // Transient DNS/network blips get retries, like api/generate.ts.
  const callWithRetry = async (): Promise<Response> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await callModel();
      } catch (err) {
        if (!isNetworkError(err) || attempt >= 3) throw err;
        console.error(`network error reaching Cloudflare (attempt ${attempt}/3):`, err);
        await sleep(attempt === 1 ? 1_000 : 3_000);
      }
    }
  };

  try {
    const upstream = await callWithRetry();
    const data: UpstreamImage | null = upstream.ok
      ? ((await upstream.json().catch(() => null)) as UpstreamImage)
      : null;

    if (!upstream.ok) {
      const detail = (data?.errors?.[0]?.message ?? "").slice(0, 200);
      const bodyText = detail ? "" : (await upstream.text().catch(() => "")).slice(0, 200);
      console.error("image upstream error", upstream.status, detail || bodyText);
      res.status(502).json({
        error: upstreamMessage(upstream.status, model, detail || bodyText),
      });
      return;
    }

    const b64 = data?.result?.image ?? data?.image ?? "";
    if (!b64) {
      res.status(502).json({
        error: "The image model returned no image — try Generate again.",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      image: b64,
      mime: "image/jpeg",
      meta: { model, promptVersion: PROMPT_VERSION },
    });
  } catch (err) {
    console.error("image generation failed", err);
    if (isTimeout(err)) {
      res.status(502).json({
        error:
          "The image model took too long — your connection may be slow, or the service is busy. Try again.",
      });
      return;
    }
    if (isNetworkError(err)) {
      res.status(502).json({
        error:
          "Couldn't reach the image service — network hiccup. Check your connection, then try again.",
      });
      return;
    }
    res.status(500).json({ error: "Image generation failed on the server." });
  }
}

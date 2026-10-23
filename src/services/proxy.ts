// ─────────────────────────────────────────────────────────────────────────────
// PROXY client — the ONLY network module in the app (NFR-01).
// The prompt is assembled server-side; we send a structured payload (§8.6).
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import type { GeneratePayload } from "@/domain/types";

const outputSchema = z.object({
  ok: z.boolean(),
  content: z.object({
    headline: z.string().min(1),
    body: z.string().optional(),
    tip: z.string().optional(),
    closing: z.string().optional(),
    gist: z.string().min(1),
    imageTags: z.array(z.string()).default([]),
  }),
  meta: z.object({
    model: z.string().default("unknown"),
    promptVersion: z.string().default("v1"),
  }),
  error: z.string().optional(),
});

export type GenerateOutput = z.infer<typeof outputSchema>;

export class ProxyError extends Error {
  hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = "ProxyError";
    this.hint = hint;
  }
}

export async function callGenerate(
  payload: GeneratePayload,
  signal?: AbortSignal
): Promise<GenerateOutput> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ProxyError(
      "Couldn't reach the server.",
      "Check your connection, then try again."
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ProxyError(
      "The generate endpoint isn't available.",
      "Run the app with the API function (vercel dev) or deploy it to Vercel."
    );
  }

  const body = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Server error (${res.status})`;
    throw new ProxyError(msg);
  }

  const parsed = outputSchema.safeParse(body);
  if (!parsed.success) {
    throw new ProxyError(
      "The model returned an unexpected shape.",
      "Try again — if it persists, check api/generate.ts."
    );
  }
  return parsed.data;
}

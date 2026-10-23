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

/** Hard client cap — the spinner never hangs forever. */
const CLIENT_TIMEOUT_MS = 90_000;

export async function callGenerate(
  payload: GeneratePayload,
  signal?: AbortSignal
): Promise<GenerateOutput> {
  // Cap the wait, but keep caller cancellation distinguishable from timeout.
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: combined,
    });
  } catch (err) {
    const name = (err as Error).name;
    if (name === "AbortError" && signal?.aborted) throw err; // user cancelled
    if (name === "TimeoutError" || (name === "AbortError" && !signal?.aborted)) {
      throw new ProxyError(
        "The request took too long — the model didn't answer in time.",
        "Your connection may be slow. Check it, then try again."
      );
    }
    throw new ProxyError(
      "Couldn't reach the server.",
      "Check your connection, then try again."
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // Non-JSON = the GATEWAY answered, not our function (function timeout,
    // missing route in dev, platform hiccup).
    if (res.status === 504)
      throw new ProxyError(
        "The server timed out waiting for the model.",
        "Generation can be slow under load — try again in a moment."
      );
    if (res.status === 503)
      throw new ProxyError(
        "The service is temporarily unavailable.",
        "Usually brief — try again shortly."
      );
    if (res.status === 429)
      throw new ProxyError(
        "Too many requests right now.",
        "Slow down for a moment, then try again."
      );
    if (res.status === 404)
      throw new ProxyError(
        "The generate endpoint isn't available.",
        "Run the app with the API function (vercel dev) or deploy it to Vercel."
      );
    throw new ProxyError(
      `Server error (${res.status}).`,
      "Usually temporary — try again in a moment."
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

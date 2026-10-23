// ─────────────────────────────────────────────────────────────────────────────
// O Studio Daily — serverless proxy (NFR-01). The API key never reaches the
// browser. The prompt is assembled HERE (§8.6), so its rules can't ship stale
// or be tampered with from the client.
//
// Provider: GROQ (OpenAI-compatible REST — no SDK required).
//   GROQ_API_KEY   (required — .env.local for dev, Vercel env vars for prod)
//   GROQ_MODEL     (optional — default openai/gpt-oss-20b)
//   GROQ_BASE_URL  (optional — default https://api.groq.com/openai/v1)
// Generic OpenAI-compatible fallback if GROQ_API_KEY is absent:
//   OPENAI_API_KEY · OPENAI_BASE_URL · OPENAI_MODEL
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

const payloadSchema = z.object({
  category: z.object({ id: z.string(), label: z.string() }),
  direction: z.object({
    id: z.string(),
    label: z.string(),
    slotProfile: z.enum(["lesson", "announcement"]),
    budget: z.object({
      headline: z.number().min(1).max(30),
      body: z.number().max(60).optional(),
      tip: z.number().max(40).optional(),
      closing: z.number().max(15).optional(),
    }),
    guidance: z.string(),
  }),
  subject: z.object({
    id: z.string(),
    label: z.string(),
    guidance: z.string(),
    imageTags: z.array(z.string()).default([]),
  }),
  voice: z.object({
    audience: z.string(),
    register: z.string(),
    principles: z.array(z.string()),
    bannedPhrases: z.array(z.string()),
    bannedPatterns: z.array(z.string()),
    exemplars: z.array(
      z.object({
        headline: z.string(),
        body: z.string().optional(),
        tip: z.string().optional(),
      })
    ),
  }),
  recentGists: z.array(z.string()).default([]),
  blacklist: z.array(z.string()).default([]),
  feedback: z.string().optional(),
});

const modelOutputSchema = z.object({
  headline: z.string().min(1).max(200),
  body: z.string().max(400).optional(),
  tip: z.string().max(300).optional(),
  closing: z.string().max(80).optional(),
  gist: z.string().min(3).max(180),
  imageTags: z.array(z.string()).max(10).default([]),
});

interface UpstreamCompletion {
  choices?: { finish_reason?: string; message?: { content?: string } }[];
}

const PROMPT_VERSION = "v1";

type Payload = z.infer<typeof payloadSchema>;

function buildSystemPrompt(p: Payload): string {
  const v = p.voice;
  const b = p.direction.budget;
  const slots =
    p.direction.slotProfile === "announcement"
      ? `{
  "headline": "max ${b.headline} words, ends with a full stop",
  "closing": "optional, max ${b.closing ?? 5} words, punchy caps-friendly phrase",
  "gist": "one line naming the core idea",
  "imageTags": []
}`
      : `{
  "headline": "max ${b.headline} words, ends with a full stop",
  "body": "max ${b.body ?? 22} words, expands the headline naturally",
  "tip": "max ${b.tip ?? 14} words, one concrete action",
  "closing": "optional, max ${b.closing ?? 5} words",
  "gist": "one line naming the core idea — NOT a paraphrase of the headline",
  "imageTags": ["3-5 lowercase subject tags for illustration matching"]
}`;

  const exemplars = v.exemplars
    .map(
      (e) =>
        `- Headline: "${e.headline}"${e.body ? `\n  Body: "${e.body}"` : ""}${e.tip ? `\n  Tip: "${e.tip}"` : ""}`
    )
    .join("\n");

  const avoid = p.recentGists.length
    ? `The core idea of these recent messages must NOT be repeated, even with different wording:\n${p.recentGists.map((g) => `- ${g}`).join("\n")}`
    : "No previous messages to avoid yet.";

  const feedback = p.feedback
    ? `\nA previous attempt was rejected. Fix these problems and write a DIFFERENT message:\n${p.feedback}`
    : "";

  return `You are the daily content engine for O Studio Innovations, a creative studio (photography, videography, film, content).

TASK
Write ONE flyer message.

CATEGORY: ${p.category.label}
DIRECTION: ${p.direction.label} — ${p.direction.guidance}
SUBJECT: ${p.subject.label} — ${p.subject.guidance}

VOICE
Audience: ${v.audience}
Register: ${v.register}
Principles:
${v.principles.map((x) => `- ${x}`).join("\n")}

Exemplars of the quality bar:
${exemplars}

HARD RULES
- Never invent statistics, dates, historical facts, studies, or quotes.
- No hype, no slogans, no "unlock/elevate/game-changer" language.
- Banned phrases: ${v.bannedPhrases.join("; ")}
- One idea only. Write for someone scrolling fast on a phone.
- headline ends with a full stop. Do not add the gold period yourself.
- The gist names the underlying IDEA in your own words (used for deduplication).
- If this direction is promotional, the lesson must still stand alone; one honest connection sentence at most.

${avoid}${feedback}

RETURN ONLY JSON, no markdown fences, exactly this shape:
${slots}`;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
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

  const groqKey = process.env.GROQ_API_KEY;
  const key = groqKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(503).json({
      error: "Server has no API key configured — set GROQ_API_KEY in .env.local (dev) or Vercel env vars (prod).",
    });
    return;
  }

  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid generation payload." });
    return;
  }
  const payload = parsed.data;

  const baseUrl = (
    groqKey
      ? (process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1")
      : (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1")
  ).replace(/\/$/, "");
  const model = groqKey
    ? (process.env.GROQ_MODEL ?? "openai/gpt-oss-20b")
    : (process.env.OPENAI_MODEL ?? "gpt-4o-mini");

  const messages = [
    {
      role: "system",
      content:
        "You write concise, useful, human-sounding flyer content for a creative studio. You never invent facts. You always return valid JSON matching the requested shape.",
    },
    { role: "user", content: buildSystemPrompt(payload) },
  ];

  // gpt-oss models spend "reasoning" tokens BEFORE any content, and those count
  // against max_tokens — the budget must cover thinking + the answer.
  // (Live-verified against Groq: 500 tokens → finish_reason "length", no content.)
  const gptOss = model.includes("gpt-oss");

  const callModel = async (maxTokens: number): Promise<Response> => {
    const body: Record<string, unknown> = {
      model,
      temperature: 0.85,
      max_tokens: maxTokens,
      messages,
    };
    if (gptOss) body.reasoning_effort = "low";
    return fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  };

  const contentOf = (d: UpstreamCompletion | null): string =>
    (d?.choices?.[0]?.message?.content ?? "").trim();

  try {
    let upstream = await callModel(4000);
    let data: UpstreamCompletion | null = null;
    if (upstream.ok) data = (await upstream.json()) as UpstreamCompletion;

    // Safety net: if the model burned its whole budget on reasoning and returned
    // nothing, retry once with a doubled budget before giving up.
    if (upstream.ok && !contentOf(data)) {
      console.error(
        "empty model output — retrying with 8000 tokens. finish_reason:",
        data?.choices?.[0]?.finish_reason
      );
      upstream = await callModel(8000);
      if (upstream.ok) data = (await upstream.json()) as UpstreamCompletion;
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("upstream error", upstream.status, detail.slice(0, 400));
      res.status(502).json({ error: `Model provider error (${upstream.status}).` });
      return;
    }

    const text = contentOf(data);
    if (!text) {
      res.status(502).json({
        error: "The model returned an empty response — try Generate again.",
      });
      return;
    }

    let raw: unknown;
    try {
      raw = extractJson(text);
    } catch {
      res.status(502).json({
        error: "The model replied in prose instead of JSON — try Generate again.",
      });
      return;
    }

    const output = modelOutputSchema.safeParse(raw);
    if (!output.success) {
      res.status(502).json({ error: "The model returned an unexpected shape." });
      return;
    }

    res.status(200).json({
      ok: true,
      content: output.data,
      meta: { model, promptVersion: PROMPT_VERSION },
    });
  } catch (err) {
    console.error("generate failed", err);
    res.status(500).json({ error: "Generation failed on the server." });
  }
}

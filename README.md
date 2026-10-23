# O Studio Daily — Content Studio

One-click branded flyer studio for O Studio Innovations. Generate a daily 9:16
message grounded in a curated knowledge library, review it, edit it, download a
high-resolution PNG. Generation is **always manual** — the app never calls the
AI on load, refresh, preview, edit or export.

## Quick start

```bash
bun install          # installs from the existing lockfile
bun run dev          # http://localhost:5173
```

The UI runs immediately. Content generation needs the serverless function:

- **Deployed:** set `OPENAI_API_KEY` in Vercel → Settings → Environment Variables, then `vercel --prod`.
- **Local:** copy `.env.example` to `.env.local`, fill the key, and run `bunx vercel dev` (uses the same `/api/generate` function locally).

Any OpenAI-compatible endpoint works via `OPENAI_BASE_URL` + `OPENAI_MODEL`
(OpenRouter, Groq, a local server…).

## Assets (all optional — the app degrades gracefully)

Drop these files in to reach full fidelity. Missing assets never break the app:
the shell falls back to a CSS reconstruction, photos fall back to text-only
layouts (visible amber status in Settings). **Typography needs no files** —
Poppins · Inter · Great Vibes load from Google Fonts automatically.

| File | Purpose |
|---|---|
| `public/flyer/background-9x16.png` | The permanent O Studio shell (black bg, gold linework, logo, scroll panel, footer) at 1080×1920 or larger — export from your design source |
| `public/flyer/logo.svg` | Your logo (top-right of the flyer). Vector — crisp at export size. Text in the SVG should be converted to outlines |
| `public/flyer/brush-mask.png` | Brush/torn edge mask for subject photos (matches your Image 2 treatment) |
| `public/images/*.jpg` | Curated subject photos (paths registered in `src/data/images.json`) |

Exported PNGs render at 2× (2160×3840). Preview and export paint the same
layout model with the same font stacks, so the downloaded PNG always matches
what you saw on screen.

## Editing content (no code changes needed)

- **Add a category:** drop `src/data/library/<id>.json` — auto-loaded on rebuild.
- **Add subjects / guidance:** edit the category JSON (`active: false` retires without deleting).
- **Change the voice:** `src/data/voice.json` (audience, register, banned phrases, banned regex patterns, exemplars).
- **Register photos:** `src/data/images.json` (`subjectIds` like `"photography/natural-lighting"`, plus tags).

## Architecture

```
src/pages        thin screens: Home · Generate · Edit · History · Library · Settings
src/components   studio UI + <Flyer/> (the renderer)
src/domain       pure logic, zero React: selectors · validation · layout · pipeline
src/services     storage (localStorage) · proxy (the only network call) · exporter · fonts · assets
src/data         the static knowledge library (JSON)
api/generate.ts  serverless proxy — API key stays server-side, prompt assembled here
```

One layout model (`domain/layout.ts`) feeds both the DOM preview and the canvas
exporter — what you see is what downloads. Record status follows a strict state
machine: `draft → skipped | downloaded → published`; downloaded messages never
resurface as suggestions; nothing is ever deleted.

**History lives in this browser.** Back it up from Settings → Export JSON.

## Keyboard shortcuts (Home)

`G` generate · `D` download · `C` copy caption

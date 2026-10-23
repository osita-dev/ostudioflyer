import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"
import type { IncomingMessage, ServerResponse } from "node:http"

/**
 * DEV-ONLY bridge for /api/generate.
 * Vite's dev server doesn't run Vercel serverless functions, so without this,
 * `bun run dev` + Generate → "endpoint isn't available". This middleware runs
 * the REAL handler from api/generate.ts (via ssrLoadModule) with the same
 * env vars (.env.local included) — production behaviour is unchanged, since
 * Vercel serves the actual function after deploy.
 */
function apiDevBridge() {
  return {
    name: "ostudio-api-dev-bridge",
    apply: "serve" as const,
    configureServer(server: import("vite").ViteDevServer) {
      console.log("  [ostudio] dev bridge armed → POST /api/generate runs api/generate.ts")

      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const pathOnly = (req.url ?? "").split("?")[0]
          if (req.method !== "POST" || pathOnly !== "/api/generate") {
            next() // not ours — pass through to Vite
            return
          }

          const send = (code: number, payload: unknown) => {
            if (res.writableEnded) return
            res.statusCode = code
            res.setHeader("Content-Type", "application/json; charset=utf-8")
            res.end(JSON.stringify(payload))
          }

          void (async () => {
            try {
              // Expose .env / .env.local to the handler's process.env
              const env = loadEnv(server.config.mode, process.cwd(), "")
              for (const [k, v] of Object.entries(env)) {
                if (!(k in process.env)) process.env[k] = v
              }

              // Read the request body (Vercel would parse this for us)
              const chunks: Buffer[] = []
              for await (const chunk of req) chunks.push(chunk as Buffer)
              const raw = Buffer.concat(chunks).toString("utf8")

              let body: unknown = {}
              if (raw) {
                try {
                  body = JSON.parse(raw)
                } catch {
                  send(400, { error: "Invalid JSON body" })
                  return
                }
              }

              console.log("  [ostudio] POST /api/generate → loading api/generate.ts …")
              const mod = await server.ssrLoadModule("/api/generate.ts")
              const handler = mod.default as (
                r: { method?: string; body?: unknown },
                x: { status: (c: number) => { json: (b: unknown) => void } },
              ) => Promise<void>

              await handler(
                { method: "POST", body },
                { status: (code) => ({ json: (b) => send(code, b) }) },
              )
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              console.error("  [ostudio] dev bridge error:", msg)
              send(500, { error: `Dev bridge failed: ${msg}` })
            }
          })()
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    apiDevBridge(),
    // PWA — service worker + web manifest. Dev stays untouched (no SW in
    // `bun run dev`, so the dev bridge/HMR never fights a cached shell);
    // production precaches the app shell and runtime-caches Google Fonts so
    // the app opens instantly and works offline.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "OstudioInnovation.svg",
        "icon.svg",
        "icon-maskable.svg",
        "flyer/logo.svg",
      ],
      manifest: {
        name: "O Studio Daily",
        short_name: "O Studio Daily",
        description:
          "One-click branded 9:16 flyer studio for O Studio Innovations.",
        theme_color: "#0D0D0D",
        background_color: "#0C0B09",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          {
            src: "icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the shell only (js/css/html) plus the pinned brand assets
        // above — curated photos and stray files in public/ stay out so the
        // install stays small.
        globPatterns: ["**/*.{js,css,html}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Google Fonts: stylesheet is small and changes rarely → revalidate;
          // the woff2 files are immutable → cache-first for a year.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Curated subject photos (generated-image URLs may be external) —
          // cache-first so re-opened flyers paint instantly, even offline.
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/images/") ||
              /\.(jpe?g|png|webp)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "flyer-images",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Fail loudly if something else already owns 5173 (e.g. an old dev
    // server) instead of silently hopping to 5174 with a stale process.
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// HOME — the studio screen (step 06). Preview + state-matrix actions.
// Invariants on this screen: restoring a draft makes NO network call (I1),
// Download exports the CURRENT record without generating (Flow E), and the
// primary action is always the next logical step (step 06 matrix).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  Facebook,
  ImageOff,
  Instagram,
  Info,
  Linkedin,
  MessageCircle,
  Music2,
  Pencil,
  Send,
  Share2,
  Sparkles,
  Twitter,
  Upload,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FlyerView } from "@/components/flyer/FlyerView";
import { StatusChip } from "@/components/studio/StatusChip";
import { useFlyer } from "@/hooks/use-flyer";
import { useStudio } from "@/hooks/use-studio";
import { composeCaption } from "@/domain/caption";
import { exhaustedCategories } from "@/domain/selectors";
import { getDirection } from "@/domain/library";
import { exportFlyerPng, renderFlyerPng, slugName } from "@/services/exporter";
import {
  SOCIALS,
  canShareFiles,
  copyText,
  shareFlyer,
  type SocialPlatform,
} from "@/services/share";
import { ensureFonts, type FontStatus } from "@/services/fonts";

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  x: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  whatsapp: MessageCircle,
  telegram: Send,
};

const Index = () => {
  const navigate = useNavigate();
  const { records, current, transition } = useStudio();
  const { layout, shell, subjectImage, imageBroken } = useFlyer(current);

  const [previewW, setPreviewW] = useState(300);
  const [exporting, setExporting] = useState(false);
  const [fonts, setFonts] = useState<FontStatus | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureFonts().then(setFonts);
  }, []);

  // Responsive preview: fits width, and height viewport (no scroll to review).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = window.innerHeight - 280;
      setPreviewW(Math.max(220, Math.min(380, Math.min(w, (h * 9) / 16))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const exhausted = useMemo(() => exhaustedCategories(records), [records]);
  const direction = current
    ? getDirection(current.source.categoryId, current.source.directionId)
    : undefined;

  const handleDownload = useCallback(async () => {
    if (!current || !layout) return;
    setExporting(true);
    try {
      await exportFlyerPng(layout, subjectImage, shell, current.source.subjectId);
      transition(current.id, "downloaded");
      toast.success("Flyer saved — this message is now a final pick.");
    } catch (err) {
      toast.error((err as Error).message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [current, layout, shell, subjectImage, transition]);

  const handleCopyCaption = useCallback(() => {
    if (!current) return;
    navigator.clipboard
      .writeText(composeCaption(current))
      .then(() => toast.success("Caption copied."))
      .catch(() => toast.error("Couldn't access the clipboard."));
  }, [current]);

  // ── Share to socials ─────────────────────────────────────────────────────
  const [fileShare, setFileShare] = useState(false);
  useEffect(() => {
    setFileShare(canShareFiles());
  }, []);

  /** Mobile: native share sheet with the PNG attached — pick app, press post. */
  const handleShare = useCallback(async () => {
    if (!current || !layout) return;
    setExporting(true);
    try {
      const blob = await renderFlyerPng(layout, subjectImage, shell);
      const file = new File([blob], `ostudio-${slugName(current.content.headline)}.png`, {
        type: "image/png",
      });
      await shareFlyer(file, composeCaption(current));
      transition(current.id, "downloaded");
    } catch (err) {
      const e = err as Error;
      if (e.name === "AbortError") return; // user dismissed the sheet — not an error
      toast.error(e.message || "Sharing failed.");
    } finally {
      setExporting(false);
    }
  }, [current, layout, shell, subjectImage, transition]);

  /** Desktop: open the platform (caption prefilled where possible, else copied). */
  const openPlatform = useCallback(
    (p: SocialPlatform) => {
      if (!current) return;
      const caption = composeCaption(current);
      void copyText(caption).then((copied) => {
        window.open(p.url(caption), "_blank", "noopener");
        toast(
          p.prefills
            ? `${p.label} opened — the caption is pre-filled in the post.`
            : copied
              ? `${p.label} opened — caption copied; paste it and attach the flyer image.`
              : `${p.label} opened — use "Copy caption", then paste it with the flyer image.`
        );
      });
    },
    [current]
  );

  // Keyboard shortcuts (step 06): G generate · D download · C caption
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable))
        return;
      if (e.key === "g" || e.key === "G") navigate("/generate");
      if ((e.key === "d" || e.key === "D") && current) void handleDownload();
      if (e.key === "c" || e.key === "C") handleCopyCaption();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, handleDownload, handleCopyCaption, current]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Preview ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center">
          <div ref={wrapRef} className="w-full flex justify-center">
            <div className="rounded-xl shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
              <FlyerView
                layout={layout}
                shell={shell}
                subjectImage={subjectImage}
                width={previewW}
                empty={!current}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            {current ? (
              <>
                <StatusChip status={current.status} />
                <span>·</span>
                <span className="capitalize">{current.variant.replace("-", " ")}</span>
              </>
            ) : (
              <span>9:16 · 2160×3840 export</span>
            )}
          </div>
        </div>

        {/* ── Control rail ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Notices */}
          {imageBroken && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-300">
              <ImageOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Image not available. Showing text-only version.</span>
            </div>
          )}
          {fonts?.anyBrandMissing && (
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-[13px] text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>
                Brand fonts didn't load (offline or Google Fonts blocked) — using
                fallback type. Preview and exports stay identical; reload when
                you're back online.
              </span>
            </div>
          )}
          {exhausted.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-gold/30 bg-gold/10 p-3 text-[13px] text-gold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {exhausted.map((e) => e.categoryLabel).join(", ")} — most subjects used in the
                last 90 days. Expand the library for fresh material.
              </span>
            </div>
          )}

          {/* Actions */}
          {!current ? (
            <Button
              size="lg"
              className="w-full bg-gold text-black hover:bg-gold/90"
              onClick={() => navigate("/generate")}
            >
              <Sparkles className="h-4 w-4" /> Generate
            </Button>
          ) : (
            <div className="space-y-2.5">
              {current.status === "draft" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" className="w-full bg-gold text-black hover:bg-gold/90">
                      <Sparkles className="h-4 w-4" /> Generate Another
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Generate another?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the current draft as skipped and generate a new one.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep</AlertDialogCancel>
                      <AlertDialogAction onClick={() => navigate("/generate")}>
                        Generate Another
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  size="lg"
                  className="w-full bg-gold text-black hover:bg-gold/90"
                  onClick={() => navigate("/generate")}
                >
                  <Sparkles className="h-4 w-4" /> Generate
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => void handleDownload()}
                  disabled={exporting}
                  className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? "Exporting…" : "Download"}
                </Button>
                <Button variant="outline" onClick={handleCopyCaption}>
                  Copy caption
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="ghost" onClick={() => navigate("/edit")}>
                  <Pencil className="h-4 w-4" /> Edit text
                </Button>
                {current.status === "downloaded" ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      transition(current.id, "published");
                      toast.success("Marked as published.");
                    }}
                  >
                    <Upload className="h-4 w-4" /> Mark as published
                  </Button>
                ) : current.status === "published" ? (
                  <Button variant="ghost" disabled>
                    ✓ Published
                  </Button>
                ) : (
                  <Button variant="ghost" disabled>
                    Mark as published
                  </Button>
                )}
              </div>

              {/* Share to socials */}
              <div className="space-y-2.5 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium">Share to socials</p>
                  {fileShare && (
                    <Button
                      size="sm"
                      className="bg-gold text-black hover:bg-gold/90"
                      disabled={exporting}
                      onClick={() => void handleShare()}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      {exporting ? "Preparing…" : "Share flyer"}
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {fileShare
                    ? "Opens your share sheet with the PNG attached — pick a platform, press post."
                    : "Opens each platform with the caption copied — paste it and attach the flyer image."}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {SOCIALS.map((p) => {
                    const Icon = PLATFORM_ICONS[p.id];
                    return (
                      <Button
                        key={p.id}
                        variant="outline"
                        onClick={() => openPlatform(p)}
                        title={
                          p.prefills
                            ? `${p.label} — caption pre-filled`
                            : `${p.label} — caption copied`
                        }
                        className="h-auto flex-col gap-1.5 py-2.5"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[10px] leading-none">{p.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Provenance — where this message came from */}
          {current && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Where this came from
              </p>
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="text-right">{direction ? current.content.label : current.source.categoryId}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Direction</dt>
                  <dd className="text-right">{direction?.label ?? current.source.directionId}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Subject</dt>
                  <dd className="text-right capitalize">{current.source.subjectId.replace(/-/g, " ")}</dd>
                </div>
              </dl>
              <p className="border-t border-border pt-2.5 text-[12px] italic leading-relaxed text-muted-foreground">
                “{current.gist}”
              </p>
            </div>
          )}

          {/* Record info */}
          {current && (
            <div className="rounded-xl border border-border bg-card p-4 text-[12px] text-muted-foreground">
              <p>
                Saved {new Date(current.updatedAt).toLocaleString()} ·{" "}
                {records.filter((r) => r.status !== "skipped").length} messages in history
              </p>
              {current.meta.repairPasses > 0 && (
                <p className="mt-1">Rewritten once automatically to meet the quality rules.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;

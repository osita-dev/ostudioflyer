// ─────────────────────────────────────────────────────────────────────────────
// EDIT — field-based editing (D4) with live auto-fit (FR-40, FR-33).
// Editing NEVER triggers generation (Invariant 1): changes go to STORE only.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FlyerView } from "@/components/flyer/FlyerView";
import { useFlyer } from "@/hooks/use-flyer";
import { useStudio } from "@/hooks/use-studio";
import { getDirection } from "@/domain/library";
import { wordCount } from "@/domain/validation";
import type { GenerationContent } from "@/domain/types";

type FieldKey = keyof GenerationContent;

const Edit = () => {
  const navigate = useNavigate();
  const { current, patchDraft } = useStudio();
  const { layout, shell, subjectImage, imageBroken } = useFlyer(current);
  const [previewW, setPreviewW] = useState(280);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setPreviewW(Math.max(220, Math.min(340, el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!current) return <Navigate to="/" replace />;

  const budget = getDirection(current.source.categoryId, current.source.directionId)?.budget;

  const fields: { key: FieldKey; label: string; limit?: number; multiline: boolean }[] = [
    { key: "label", label: "Category label", limit: undefined, multiline: false },
    { key: "headline", label: "Headline", limit: budget?.headline, multiline: true },
    { key: "body", label: "Body", limit: budget?.body, multiline: true },
    { key: "tip", label: "Quick tip", limit: budget?.tip, multiline: true },
    { key: "closing", label: "Closing line", limit: budget?.closing, multiline: false },
  ];

  const setField = (key: FieldKey, value: string) => {
    patchDraft(current.id, { content: { ...current.content, [key]: value } });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 md:px-8 md:py-8">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <Button size="sm" onClick={() => navigate("/")}>
          <Check className="h-4 w-4" /> Done
        </Button>
      </div>

      <h1 className="mb-1 text-lg font-semibold">Edit</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        Auto-fit runs on every change — the preview is the export.
      </p>

      {imageBroken && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-300">
          <ImageOff className="h-4 w-4 shrink-0" />
          Image not available. Showing text-only version.
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {fields.map((f) => {
            const value = current.content[f.key] ?? "";
            const words = wordCount(value);
            const over = f.limit !== undefined && words > f.limit;
            return (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium">{f.label}</label>
                  {f.limit !== undefined && (
                    <span
                      className={`text-[11px] tabular-nums ${over ? "text-amber-400" : "text-muted-foreground"}`}
                    >
                      {words} / {f.limit} words
                    </span>
                  )}
                </div>
                {f.multiline ? (
                  <Textarea
                    value={value}
                    rows={f.key === "headline" ? 2 : 3}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className="border-border bg-card"
                  />
                ) : (
                  <Input
                    value={value}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className="border-border bg-card"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center md:justify-start">
          <div ref={wrapRef} className="w-full max-w-[340px]">
            <div className="rounded-xl shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
              <FlyerView
                layout={layout}
                shell={shell}
                subjectImage={subjectImage}
                width={previewW}
              />
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Gold period is added automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Edit;

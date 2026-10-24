// ─────────────────────────────────────────────────────────────────────────────
// GENERATE — the selection screen (D2) + pipeline run (§7.3).
// Opens pre-filled with the S2 recommendation; dropdowns let the owner steer.
// Nothing here calls the API until "Continue" — generation is always manual.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StageProgress } from "@/components/studio/StageProgress";
import { useGeneration } from "@/hooks/use-generation";
import { toast } from "sonner";
import { useStudio } from "@/hooks/use-studio";
import { getActiveLibrary, getCategory } from "@/domain/library";
import {
  directionChoices,
  promoQuotaOk,
  recommend,
  recommendInCategory,
  subjectChoices,
  type SubjectChoice,
  type Tier,
} from "@/domain/selectors";

const TIER_HINT: Record<Tier, string> = {
  never: "never used",
  dormant: "unused for 30+ days",
  recently: "used within 30 days",
  recent: "used this week — deprioritised",
  skipped: "skipped recently — excluded",
};

const Generate = () => {
  const navigate = useNavigate();
  const { records, saveDraft, settings, updateSettings } = useStudio();
  const { start, isPending, error, record, stageInfo, reset } = useGeneration();
  const imageMode = settings.imageMode;

  const categories = getActiveLibrary();
  const [rec] = useState(() => recommend(records));
  const [sel, setSel] = useState(() => ({
    categoryId: rec?.category.id ?? categories[0]?.id ?? "",
    directionId: rec?.direction.id ?? "",
    subjectId: rec?.subject.id ?? "",
  }));

  const savedRef = useRef(false);
  useEffect(() => {
    if (record && !savedRef.current) {
      savedRef.current = true;
      saveDraft(record);
      navigate("/", { replace: true });
    }
  }, [record, saveDraft, navigate]);

  // Failures are never silent: the inline card explains, the toast announces.
  useEffect(() => {
    if (error) toast.error(error.message, { description: error.hint });
  }, [error]);

  const category = getCategory(sel.categoryId);
  const directions = useMemo(
    () => (category ? directionChoices(category, records) : []),
    [category, records]
  );
  const direction = directions.find((d) => d.id === sel.directionId) ?? directions[0];

  const choices: SubjectChoice[] = useMemo(() => {
    if (!category || !direction) return [];
    return subjectChoices(
      direction.subjects.map((s) => ({ category, direction, subject: s })),
      records
    );
  }, [category, direction, records]);
  const subject = choices.find((c) => c.subject.id === sel.subjectId) ?? choices[0];

  const overridden =
    !rec ||
    sel.categoryId !== rec.category.id ||
    sel.directionId !== rec.direction.id ||
    sel.subjectId !== rec.subject.id;

  /** The pick handed to the pipeline — carries whether the user steered it. */
  const pick = subject ? { ...subject, overridden } : null;

  const pickReady = !!(category && direction && subject);
  const quotaOk = promoQuotaOk(records);

  const onCategory = (id: string) => {
    const next = recommendInCategory(id, records);
    setSel({ categoryId: id, directionId: next?.direction.id ?? "", subjectId: next?.subject.id ?? "" });
  };

  if (categories.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-muted-foreground">
        The knowledge library is empty. Add a category JSON to{" "}
        <code>src/data/library</code> and reload.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-5 md:py-8">
      <button
        onClick={() => navigate("/")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="mb-1 text-lg font-semibold">Generate</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        The recommendation is pre-filled — continue, or steer it with the selectors below.
      </p>

      {error ? (
        <div className="space-y-4 rounded-xl border border-destructive/40 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">Couldn't generate.</p>
              <p className="text-[13px] text-muted-foreground">{error.message}</p>
              {error.hint && <p className="mt-1 text-[12px] text-muted-foreground/80">{error.hint}</p>}
            </div>
          </div>
          <div className="flex gap-2.5">
            <Button
              className="bg-gold text-black hover:bg-gold/90"
              onClick={() => {
                reset();
                if (pickReady && pick) start(pick, records, imageMode);
              }}
            >
              Try again
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </div>
      ) : isPending ? (
        <StageProgress stageInfo={stageInfo} />
      ) : (
        <div className="space-y-5">
          {/* 1. Category */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium">1. Category</label>
              {!quotaOk && (
                <Badge variant="outline" className="border-gold/40 text-gold">
                  Promo quota reached
                </Badge>
              )}
            </div>
            <Select value={sel.categoryId} onValueChange={onCategory}>
              <SelectTrigger className="border-gold/30">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Direction */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">2. Direction</label>
            <Select
              value={direction?.id ?? ""}
              onValueChange={(id) => {
                const d = directions.find((x) => x.id === id);
                const list =
                  category && d
                    ? subjectChoices(
                        d.subjects.map((s) => ({ category, direction: d, subject: s })),
                        records
                      )
                    : [];
                setSel({
                  categoryId: sel.categoryId,
                  directionId: id,
                  subjectId:
                    list.find((c) => c.weight > 0)?.subject.id ?? list[0]?.subject.id ?? "",
                });
              }}
            >
              <SelectTrigger className="border-gold/30">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                {directions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                    {d.promotional ? " · promotional" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Subject */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">3. Subject</label>
            <Select
              value={subject?.subject.id ?? ""}
              onValueChange={(id) =>
                setSel({ ...sel, subjectId: id })
              }
            >
              <SelectTrigger className="border-gold/30">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {choices.map((c) => (
                  <SelectItem key={c.subject.id} value={c.subject.id} disabled={c.weight === 0}>
                    {c.subject.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {TIER_HINT[c.tier]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Selection rule: never-used › lightly-used › heavily-used.
            </p>
          </div>

          {/* 4. Illustration source */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">4. Illustration</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={imageMode === "ai" ? "default" : "outline"}
                size="sm"
                className={imageMode === "ai" ? "bg-gold text-black hover:bg-gold/90" : "border-gold/30"}
                onClick={() => updateSettings({ imageMode: "ai" })}
              >
                <Sparkles className="h-3.5 w-3.5" /> AI image
              </Button>
              <Button
                variant={imageMode === "curated" ? "default" : "outline"}
                size="sm"
                className={imageMode === "curated" ? "bg-gold text-black hover:bg-gold/90" : "border-gold/30"}
                onClick={() => updateSettings({ imageMode: "curated" })}
              >
                Curated photos
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {imageMode === "ai"
                ? "A fresh illustration is created for the side panel. If it can't be created, a curated photo is used automatically."
                : "A photo is matched from the curated library by subject and tags."}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-gold" />
            {rec
              ? `Recommended: ${rec.category.label} · ${rec.direction.label} · ${rec.subject.label}`
              : "No recommendation available — pick manually."}
            {overridden && rec && <span className="text-gold">· overridden</span>}
          </div>

          <Button
            size="lg"
            className="w-full bg-gold text-black hover:bg-gold/90"
            disabled={!pickReady}
            onClick={() => pickReady && pick && start(pick, records, imageMode)}
          >
            <Sparkles className="h-4 w-4" /> Continue
          </Button>
        </div>
      )}
    </div>
  );
};

export default Generate;

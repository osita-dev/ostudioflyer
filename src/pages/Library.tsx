// ─────────────────────────────────────────────────────────────────────────────
// LIBRARY (D5 / FR-23) — read-only browser of the knowledge library, with live
// usage stats derived from records. Adding subjects = editing JSON, no code.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useStudio } from "@/hooks/use-studio";
import { getActiveLibrary } from "@/domain/library";
import { subjectTier, usageFor, type Tier } from "@/domain/selectors";

const TIER_BADGE: Record<Tier, { label: string; cls: string }> = {
  never: { label: "fresh", cls: "bg-emerald-500/15 text-emerald-400" },
  dormant: { label: "dormant", cls: "bg-sky-500/15 text-sky-300" },
  recently: { label: "used 8–30d", cls: "bg-white/10 text-muted-foreground" },
  recent: { label: "used this week", cls: "bg-amber-500/15 text-amber-400" },
  skipped: { label: "skipped", cls: "bg-white/10 text-muted-foreground" },
};

const Library = () => {
  const { records } = useStudio();
  const categories = getActiveLibrary();

  const totals = useMemo(() => {
    let directions = 0;
    let subjects = 0;
    for (const c of categories) {
      directions += c.directions.length;
      subjects += c.directions.reduce((s, d) => s + d.subjects.filter((x) => x.active).length, 0);
    }
    return { directions, subjects };
  }, [categories]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:px-8 md:py-8">
      <h1 className="mb-1 text-lg font-semibold">Library</h1>
      <p className="mb-4 text-[13px] text-muted-foreground">
        {categories.length} categories · {totals.directions} directions · {totals.subjects}{" "}
        subjects · edit the JSON files to expand
      </p>

      <Accordion type="multiple" className="space-y-2.5">
        {categories.map((c) => (
          <AccordionItem
            key={c.id}
            value={c.id}
            className="rounded-xl border border-border bg-card px-4"
          >
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="text-gold">{c.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {c.directions.length} directions
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              {c.directions.map((d) => (
                <div key={d.id}>
                  <p className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {d.label}
                    {d.promotional && (
                      <Badge variant="outline" className="border-gold/40 text-gold">
                        promotional · ≤1-in-7
                      </Badge>
                    )}
                    {d.slotProfile === "announcement" && (
                      <Badge variant="outline">announcement layout</Badge>
                    )}
                  </p>
                  <ul className="space-y-1.5">
                    {d.subjects
                      .filter((s) => s.active)
                      .map((s) => {
                        const tier = subjectTier(records, s.id);
                        const usage = usageFor(records, s.id);
                        const badge = TIER_BADGE[tier];
                        return (
                          <li
                            key={s.id}
                            className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] text-foreground">{s.label}</p>
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                                {s.guidance}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <Badge variant="outline" className={badge.cls}>
                                {badge.label}
                              </Badge>
                              {usage.count > 0 && (
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  used {usage.count}×
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default Library;

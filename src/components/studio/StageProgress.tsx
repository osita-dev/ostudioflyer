// ─────────────────────────────────────────────────────────────────────────────
// StageProgress — honest staged progress (NFR-03): the rows below ARE the
// real pipeline stages (§7.3), not decoration. Matches the board's
// "Selection Engine (Step 2)" / "Almost there…" screens.
// ─────────────────────────────────────────────────────────────────────────────

import { Check, Loader2 } from "lucide-react";
import type { StageInfo } from "@/hooks/use-generation";
import type { PipelineStage } from "@/domain/types";

const ORDER: PipelineStage[] = [
  "context",
  "recommend",
  "calling",
  "validating",
  "matching",
  "layout",
  "committing",
  "done",
];

const ROWS: { stage: PipelineStage; label: (detail?: string) => string }[] = [
  { stage: "context", label: () => "Fetching latest 30 gists & voice rules" },
  { stage: "recommend", label: (d) => d ?? "Choosing a subject" },
  { stage: "calling", label: () => "Writing the message" },
  { stage: "validating", label: (d) => d ?? "Checking budgets, bans & repetition" },
  { stage: "matching", label: () => "Matching an illustration" },
  { stage: "layout", label: (d) => `Laying out the flyer${d ? ` · ${d}` : ""}` },
  { stage: "committing", label: () => "Almost there… This takes a few seconds." },
];

export function StageProgress({ stageInfo }: { stageInfo: StageInfo | null }) {
  const idx = stageInfo ? ORDER.indexOf(stageInfo.stage) : 0;

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Generating…</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gold transition-all duration-500"
          style={{ width: `${Math.min(96, ((idx + 1) / ORDER.length) * 100)}%` }}
        />
      </div>
      <ul className="space-y-2 pt-1">
        {ROWS.map((row, i) => {
          const rowIdx = ORDER.indexOf(row.stage);
          const done = idx > rowIdx;
          const active = idx === rowIdx;
          const detail = active ? stageInfo?.detail : undefined;
          return (
            <li key={row.stage} className="flex items-start gap-2.5 text-[13px]">
              {done ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              ) : active ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-gold" />
              ) : (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/15" />
              )}
              <span className={done || active ? "text-foreground" : "text-muted-foreground/60"}>
                {row.label(detail)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

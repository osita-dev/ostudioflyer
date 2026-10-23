// Status chip — mirrors the record status so the state is never guesswork.

import type { RecordStatus } from "@/domain/types";

const STYLES: Record<RecordStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  skipped: { label: "Skipped", cls: "bg-white/5 text-muted-foreground border-white/10" },
  downloaded: { label: "Downloaded", cls: "bg-gold/15 text-gold border-gold/30" },
  published: { label: "Published", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

export function StatusChip({ status, className }: { status: RecordStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.cls} ${className ?? ""}`}
    >
      {s.label}
    </span>
  );
}

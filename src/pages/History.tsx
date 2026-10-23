// ─────────────────────────────────────────────────────────────────────────────
// HISTORY (FR-50, FR-51, FR-52). Rows lead with the gist — the fastest way to
// spot "have I said this before?". Thumbnails re-render from records (Flow G).
// Skipped records stay visible but greyed; nothing is ever deleted (I4).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlyerView } from "@/components/flyer/FlyerView";
import { StatusChip } from "@/components/studio/StatusChip";
import { useFlyer } from "@/hooks/use-flyer";
import { useStudio } from "@/hooks/use-studio";
import { composeCaption } from "@/domain/caption";
import { getDirection } from "@/domain/library";
import type { ContentRecord, RecordStatus } from "@/domain/types";

const TABS: { id: "all" | RecordStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "downloaded", label: "Downloaded" },
  { id: "published", label: "Published" },
  { id: "skipped", label: "Skipped" },
];

function HistoryRow({ record, onOpen }: { record: ContentRecord; onOpen: () => void }) {
  const { layout, shell, subjectImage } = useFlyer(record);
  const direction = getDirection(record.source.categoryId, record.source.directionId);
  const skippedRecently =
    record.status === "skipped" && Date.now() - record.updatedAt < 30 * 86_400_000;

  return (
    <button
      onClick={onOpen}
      className={`flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-gold/40 ${
        skippedRecently ? "opacity-60" : ""
      }`}
    >
      <div className="shrink-0 overflow-hidden rounded-md ring-1 ring-white/10">
        <FlyerView layout={layout} shell={shell} subjectImage={subjectImage} width={54} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gold">
            {record.content.label}
          </span>
          <StatusChip status={record.status} />
        </div>
        <p className="mt-1 truncate text-[13px] text-foreground">“{record.gist}”</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {direction?.label ?? record.source.directionId} ·{" "}
          {record.source.subjectId.replace(/-/g, " ")} ·{" "}
          {record.status === "skipped" && skippedRecently
            ? `skipped ${formatDistanceToNow(record.updatedAt, { addSuffix: true })}`
            : formatDistanceToNow(record.createdAt, { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

function RecordDialog({
  record,
  open,
  onOpenChange,
}: {
  record: ContentRecord | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { layout, shell, subjectImage } = useFlyer(record);
  const { transition } = useStudio();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{record?.content.headline ?? ""}</DialogTitle>
        </DialogHeader>
        {record && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="rounded-lg shadow-[0_14px_40px_-10px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
                <FlyerView layout={layout} shell={shell} subjectImage={subjectImage} width={220} />
              </div>
            </div>
            <p className="text-center text-xs italic text-muted-foreground">“{record.gist}”</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard
                    .writeText(composeCaption(record))
                    .then(() => toast.success("Caption copied."))
                    .catch(() => toast.error("Couldn't access the clipboard."));
                }}
              >
                Copy caption
              </Button>
              {record.status === "downloaded" && (
                <Button
                  size="sm"
                  className="bg-gold text-black hover:bg-gold/90"
                  onClick={() => {
                    transition(record.id, "published");
                    toast.success("Marked as published.");
                    onOpenChange(false);
                  }}
                >
                  <Upload className="h-3.5 w-3.5" /> Mark as Published
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const History = () => {
  const { records } = useStudio();
  const [tab, setTab] = useState<"all" | RecordStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      [...records]
        .filter((r) => tab === "all" || r.status === tab)
        .sort((a, b) => b.createdAt - a.createdAt),
    [records, tab]
  );
  const openRecord = records.find((r) => r.id === openId) ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:px-8 md:py-8">
      <h1 className="mb-1 text-lg font-semibold">History</h1>
      <p className="mb-4 text-[13px] text-muted-foreground">
        {records.length} messages · nothing is ever deleted
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {list.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing here yet — generate your first message.
        </p>
      ) : (
        <div className="space-y-2.5">
          {list.map((r) => (
            <HistoryRow key={r.id} record={r} onOpen={() => setOpenId(r.id)} />
          ))}
        </div>
      )}

      <RecordDialog record={openRecord} open={!!openRecord} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
};

export default History;

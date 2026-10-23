// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS (D5, kept minimal) — asset & font status, history backup (FR-53),
// voice rules view, app info. No account, no theme switcher, no clutter.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/hooks/use-studio";
import { getVoice } from "@/domain/library";
import { ASSET_PATHS } from "@/domain/shell";
import { loadShellAssets, type ShellAssets } from "@/services/assets";
import { ensureFonts, type FontStatus } from "@/services/fonts";
import { storage } from "@/services/storage";

function Row({ label, ok, hint }: { label: string; ok: boolean | null; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <p className="text-[13px] text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
          ok === null ? "bg-white/20" : ok ? "bg-emerald-400" : "bg-amber-400"
        }`}
      />
    </div>
  );
}

const Settings = () => {
  const { records } = useStudio();
  const [shell, setShell] = useState<ShellAssets | null>(null);
  const [fonts, setFonts] = useState<FontStatus | null>(null);
  const voice = getVoice();

  useEffect(() => {
    loadShellAssets().then(setShell);
    ensureFonts().then(setFonts);
  }, []);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { added, updated } = storage.importRecords(text);
      toast.success(`Import complete: ${added} added, ${updated} updated.`);
    } catch {
      toast.error("That file couldn't be read as history JSON.");
    }
  };

  const onExport = () => {
    const blob = new Blob([storage.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ostudio-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast.success("History exported.");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 md:px-8 md:py-8">
      <div>
        <h1 className="mb-1 text-lg font-semibold">Settings</h1>
        <p className="text-[13px] text-muted-foreground">
          {records.length} records in this browser
        </p>
      </div>

      {/* Assets & fonts */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-medium">Assets & fonts</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Amber = missing. The app runs without them (text-only + fallback type), but drop the
          files in to reach full fidelity. Paths in the README.
        </p>
        <div className="divide-y divide-border">
          <Row
            label="Flyer background (9:16)"
            ok={shell ? !!shell.background : null}
            hint={ASSET_PATHS.background}
          />
          <Row label="Logo" ok={shell ? !!shell.logo : null} hint={ASSET_PATHS.logo} />
          <Row
            label="Brush mask (optional)"
            ok={shell ? !!shell.mask : null}
            hint={ASSET_PATHS.mask}
          />
          <Row
            label="Headline font (Poppins)"
            ok={fonts ? fonts.headline === "loaded" : null}
            hint="Google Fonts"
          />
          <Row
            label="Body font (Inter)"
            ok={fonts ? fonts.body === "loaded" : null}
            hint="Google Fonts"
          />
          <Row
            label="Script font — Quick Tip (Great Vibes)"
            ok={fonts ? fonts.script === "loaded" : null}
            hint="Google Fonts"
          />
        </div>
      </section>

      {/* Backup */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-medium">History backup</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          History lives in this browser. Export regularly — the file is your permanent record.
        </p>
        <div className="flex gap-2.5">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" /> Export JSON
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => void onImport(e.target.files?.[0])}
            />
            <span className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
              <Upload className="h-4 w-4" /> Import
            </span>
          </label>
        </div>
      </section>

      {/* Voice rules */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-medium">Voice rules</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">
          From <code>src/data/voice.json</code> — applied to every generation.
        </p>
        <Accordion type="single" collapsible>
          <AccordionItem value="audience">
            <AccordionTrigger className="py-2 text-[13px]">Audience & register</AccordionTrigger>
            <AccordionContent className="text-[12px] leading-relaxed text-muted-foreground">
              <p className="mb-2">{voice.audience}</p>
              <p>{voice.register}</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="banned">
            <AccordionTrigger className="py-2 text-[13px]">
              Banned phrases ({voice.bannedPhrases.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="list-inside list-disc text-[12px] text-muted-foreground">
                {voice.bannedPhrases.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="principles">
            <AccordionTrigger className="py-2 text-[13px]">Principles</AccordionTrigger>
            <AccordionContent>
              <ul className="list-inside list-disc text-[12px] text-muted-foreground">
                {voice.principles.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <p className="pb-4 text-center text-[11px] text-muted-foreground/70">
        O Studio Daily · generation is always manual · downloads are final picks
      </p>
    </div>
  );
};

export default Settings;

"use client";

/**
 * Reports > Export: choose the details before the file downloads (CH-267,
 * Sir 25 Oct: "every user can check or uncheck what details they want to
 * share with their clients, with manual edit").
 *
 * Lists exactly the columns this login's export has (the server already
 * leaves out what its role may not see), each with a tick box and an
 * optional new heading. The choice is remembered in this browser for the
 * next export.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/use-translation";

const STORE_KEY = "avortyx.exportColumns.v1";

interface Remembered {
  hidden: string[];
  names: Record<string, string>;
}

function load(): Remembered {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<Remembered>) : {};
    return {
      hidden: Array.isArray(v.hidden) ? v.hidden.filter((h): h is string => typeof h === "string") : [],
      names: v.names && typeof v.names === "object" ? (v.names as Record<string, string>) : {},
    };
  } catch {
    return { hidden: [], names: {} };
  }
}

function save(v: Remembered) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    // Private window or storage off: the choice just isn't remembered.
  }
}

/** Keep the chosen columns of an export table, with their new headings. */
export function applyColumnChoice(
  table: string[][],
  keep: string[],
  names: Record<string, string>,
): string[][] {
  const [header = [], ...body] = table;
  const idx = header.map((h, i) => (keep.includes(h) ? i : -1)).filter((i) => i >= 0);
  return [
    idx.map((i) => (names[header[i]] || "").trim() || header[i]),
    ...body.map((row) => idx.map((i) => row[i] ?? "")),
  ];
}

interface Props {
  /** The export's own headings, in file order. Null = closed. */
  header: string[] | null;
  format: "csv" | "xlsx";
  onCancel: () => void;
  onConfirm: (keep: string[], names: Record<string, string>) => void;
}

export function ExportColumnsDialog({ header, format, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const [hidden, setHidden] = React.useState<string[]>([]);
  const [names, setNames] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!header) return;
    const r = load();
    setHidden(r.hidden);
    setNames(r.names);
  }, [header]);

  if (!header) return null;
  const keep = header.filter((h) => !hidden.includes(h));

  const confirm = () => {
    save({ hidden, names });
    onConfirm(keep, names);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("exportPick.title").replace("{format}", format === "csv" ? "CSV" : "Excel")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{t("exportPick.hint")}</p>
        </DialogHeader>

        <div className="flex gap-3 text-xs">
          <button type="button" className="text-accent hover:underline" onClick={() => setHidden([])}>
            {t("x6.scheduledReports.selectAll")}
          </button>
          <button type="button" className="text-muted-foreground hover:underline" onClick={() => setHidden(header.slice(1))}>
            {t("x6.scheduledReports.clear")}
          </button>
        </div>

        <div className="grid max-h-[55vh] grid-cols-1 gap-x-4 gap-y-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
          {header.map((h) => {
            const on = !hidden.includes(h);
            return (
              <div key={h} className="flex items-center gap-2">
                <Checkbox
                  checked={on}
                  onCheckedChange={() =>
                    setHidden((prev) => (on ? [...prev, h] : prev.filter((x) => x !== h)))
                  }
                  aria-label={h}
                />
                <span className="w-32 shrink-0 truncate text-xs font-medium">{h}</span>
                <Input
                  className="h-7 text-xs"
                  disabled={!on}
                  placeholder={h}
                  value={names[h] ?? ""}
                  onChange={(e) => setNames((prev) => ({ ...prev, [h]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t("exportPick.cancel")}
          </Button>
          <Button onClick={confirm} disabled={keep.length === 0}>
            {t("exportPick.download").replace("{count}", String(keep.length))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

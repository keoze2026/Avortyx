"use client";

import * as React from "react";
import { AlertTriangle, X } from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

export interface ExpiredTfnsToastProps {
  /** The expired numbers not yet Seen, as stored (+18888914875). */
  numbers: string[];
  /** Opens the Numbers page to add replacements; the numbers count as Seen. */
  onAddReplacements: () => void;
  /** Closes the pop-up only: the numbers stay in the bell until Seen there
   *  (Sir, 21 Oct: "that notification remain unless user sees"). */
  onClose: () => void;
}

/** Up to 6 places on the card: 5 numbers and "+N more", or all of 6. */
const PLACES = 6;

/** +18888914875, whatever spacing the number was stored with. */
function plusNumber(n: string): string {
  const digits = n.replace(/\D/g, "");
  return digits ? `+${digits}` : n;
}

/**
 * CH-639 - the "TFNs expired" pop-up in Sir's design (7 Nov): a dark card
 * with a gold border, the numbers in two columns, "Add replacements" and
 * "View all". Raised by lib/deleted-tfns-runtime.ts as a sonner custom toast.
 */
export function ExpiredTfnsToast({ numbers, onAddReplacements, onClose }: ExpiredTfnsToastProps) {
  const { t } = useTranslation();
  const [all, setAll] = React.useState(false);
  const count = numbers.length;
  const one = count === 1;
  const list = numbers.map(plusNumber);
  const fits = count <= PLACES;
  const shown = all || fits ? list : list.slice(0, PLACES - 1);
  const more = count - shown.length;

  // Two per row: [number] · [number]; "+N more" takes the place of a number.
  const cells: Array<{ text: string; more?: boolean }> = shown.map((text) => ({ text }));
  if (more > 0) cells.push({ text: t("deletedTfns.moreShort").replace("{count}", String(more)), more: true });
  const rows: Array<typeof cells> = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  return (
    <div
      role="alert"
      className={cn(
        "relative w-[356px] max-w-[calc(100vw-2rem)] rounded-xl border p-4 pr-10 shadow-lg",
        "border-amber-400/60 bg-amber-50 text-amber-950",
        "dark:border-amber-500/40 dark:bg-[#29240f] dark:text-amber-50",
      )}
    >
      <button
        type="button"
        aria-label={t("deletedTfns.close")}
        onClick={onClose}
        className="absolute right-3 top-3 rounded p-0.5 text-amber-900/60 transition-colors hover:text-amber-950 dark:text-amber-100/60 dark:hover:text-amber-50"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight text-amber-700 dark:text-amber-300">
            {one ? t("deletedTfnsOne.toastTitle") : t("deletedTfns.toastTitle").replace("{count}", String(count))}
          </p>
          <p className="mt-1 text-[13px] text-amber-900/70 dark:text-amber-100/70">
            {one ? t("deletedTfnsOne.toastBody") : t("deletedTfns.toastBody")}
          </p>
          <div className={cn("mt-3 space-y-1.5", all && "max-h-48 overflow-y-auto pr-1")}>
            {rows.map((row, r) => (
              <div key={r} className="flex items-center gap-2 font-mono text-[13px]">
                <span>{row[0].text}</span>
                {row[1] && (
                  <>
                    {!row[1].more && (
                      <span aria-hidden className="text-amber-600/60 dark:text-amber-200/50">
                        ·
                      </span>
                    )}
                    <span className={cn(row[1].more && "ml-3 font-sans text-amber-900/60 dark:text-amber-100/60")}>
                      {row[1].text}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <button
              type="button"
              onClick={onAddReplacements}
              className="rounded-lg bg-amber-400 px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-amber-300"
            >
              {one ? t("deletedTfnsOne.addReplacements") : t("deletedTfns.addReplacements")}
            </button>
            {(all || !fits) && (
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className="text-[13px] text-amber-900/80 transition-colors hover:text-amber-950 hover:underline dark:text-amber-100/80 dark:hover:text-amber-50"
              >
                {all ? t("deletedTfns.showLess") : t("deletedTfns.viewAll")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

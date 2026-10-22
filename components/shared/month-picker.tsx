"use client";

/**
 * A month picker in the portal's own colours (Sir, 23 Oct: "match color with
 * portal"). The browser's built-in month input opened a white system popup on
 * the dark portal; this one is a popover drawn with the theme tokens, so it
 * follows dark and light mode and the accent colour like every other control.
 *
 * Value and onChange use "YYYY-MM", the same as <input type="month">, so it
 * drops in where that input was.
 */
import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

function parse(value: string): { year: number; month: number } {
  const [y, m] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: Number.isFinite(y) && y > 0 ? y : now.getFullYear(),
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth(),
  };
}

function key(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function MonthPicker({
  id,
  value,
  onChange,
  max,
  min,
  className,
}: {
  id?: string;
  /** "YYYY-MM" */
  value: string;
  onChange: (value: string) => void;
  /** Latest selectable month, "YYYY-MM". */
  max?: string;
  /** Earliest selectable month, "YYYY-MM". */
  min?: string;
  className?: string;
}) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const selected = parse(value);
  const [year, setYear] = React.useState(selected.year);

  React.useEffect(() => {
    if (open) setYear(parse(value).year);
  }, [open, value]);

  const fmtMonth = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short" }),
    [locale],
  );
  const fmtLabel = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale],
  );

  const now = new Date();
  const thisMonth = key(now.getFullYear(), now.getMonth());
  const allowed = (k: string) => (!max || k <= max) && (!min || k >= min);
  const label = fmtLabel.format(new Date(selected.year, selected.month, 1));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("w-44 justify-between px-3 font-normal", className)}
          aria-label={label}
        >
          <span className="truncate capitalize">{label}</span>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setYear((y) => y - 1)}
            disabled={!!min && key(year - 1, 11) < min}
            aria-label={t("monthPicker.prevYear")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setYear((y) => y + 1)}
            disabled={!!max && key(year + 1, 0) > max}
            aria-label={t("monthPicker.nextYear")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 12 }, (_, m) => {
            const k = key(year, m);
            const isSelected = k === value;
            const isCurrent = k === thisMonth;
            const enabled = allowed(k);
            return (
              <button
                key={k}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                className={cn(
                  "h-9 rounded-md text-xs font-medium capitalize transition-colors",
                  "disabled:cursor-not-allowed disabled:opacity-35",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                  !isSelected && isCurrent && "ring-1 ring-primary/50",
                )}
              >
                {fmtMonth.format(new Date(year, m, 1))}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-end border-t border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary"
            disabled={!allowed(thisMonth)}
            onClick={() => {
              onChange(thisMonth);
              setOpen(false);
            }}
          >
            {t("monthPicker.thisMonth")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

/**
 * A date picker in the portal's own colours (CH-334, Sir 28 Oct: "fix
 * colors"). The browser's built-in date input opened a grey system calendar
 * on the dark portal; this one is a popover drawn with the theme tokens, like
 * MonthPicker, so it follows dark and light mode and the accent colour.
 *
 * Value and onChange use "YYYY-MM-DD", the same as <input type="date">, so it
 * drops in where that input was. Dates are plain calendar days (no time
 * zone): the caller decides which day "today" is (Eastern on Carrier Costs).
 */
import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DD" -> {year, month (0-11), day}; an invalid value is today. */
function parse(value: string | undefined): { year: number; month: number; day: number } {
  const [y, m, d] = (value ?? "").split("-").map(Number);
  if (y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { year: y, month: m - 1, day: d };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localToday(): string {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
}

/** The 42 days (6 weeks, Sunday first) shown for a month. */
function grid(year: number, month: number): { key: string; day: number; inMonth: boolean }[] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return {
      key: iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    };
  });
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  today,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable day, "YYYY-MM-DD". */
  min?: string;
  /** Latest selectable day, "YYYY-MM-DD". */
  max?: string;
  /** Which day the Today button picks and marks (default: this computer's day). */
  today?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const selected = parse(value);
  const [view, setView] = React.useState({ year: selected.year, month: selected.month });

  React.useEffect(() => {
    if (open) {
      const p = parse(value);
      setView({ year: p.year, month: p.month });
    }
  }, [open, value]);

  const fmtLabel = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const fmtMonth = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const fmtWeekday = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }),
    [locale],
  );

  const todayKey = today ?? localToday();
  const allowed = (k: string) => (!min || k >= min) && (!max || k <= max);
  const label = fmtLabel.format(new Date(Date.UTC(selected.year, selected.month, selected.day)));
  // 4-10 Jan 2026 is Sunday to Saturday.
  const weekdays = Array.from({ length: 7 }, (_, i) => fmtWeekday.format(new Date(Date.UTC(2026, 0, 4 + i))));

  const shift = (by: number) =>
    setView((v) => {
      const m = v.month + by;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  const firstOfView = iso(view.year, view.month, 1);
  const firstOfNext = iso(view.month === 11 ? view.year + 1 : view.year, (view.month + 1) % 12, 1);

  const pick = (k: string) => {
    onChange(k);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          className={cn("w-[9.5rem] justify-between px-3 font-normal tabular-nums", className)}
          aria-label={ariaLabel ? `${ariaLabel}: ${label}` : label}
        >
          <span className="truncate">{label}</span>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => shift(-1)}
            disabled={!!min && firstOfView <= min}
            aria-label={t("datePicker.prevMonth")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold capitalize">
            {fmtMonth.format(new Date(Date.UTC(view.year, view.month, 15)))}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => shift(1)}
            disabled={!!max && firstOfNext > max}
            aria-label={t("datePicker.nextMonth")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w, i) => (
            <div key={i} className="py-1 text-[11px] font-medium uppercase text-muted-foreground">
              {w}
            </div>
          ))}
          {grid(view.year, view.month).map((d) => {
            const isSelected = d.key === value;
            const isToday = d.key === todayKey;
            const enabled = allowed(d.key);
            return (
              <button
                key={d.key}
                type="button"
                disabled={!enabled}
                onClick={() => pick(d.key)}
                className={cn(
                  "h-8 rounded-md text-xs tabular-nums transition-colors",
                  "disabled:cursor-not-allowed disabled:opacity-35",
                  isSelected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                  !isSelected && (d.inMonth ? "text-foreground" : "text-muted-foreground/60"),
                  !isSelected && isToday && "ring-1 ring-primary/50",
                )}
              >
                {d.day}
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
            disabled={!allowed(todayKey)}
            onClick={() => pick(todayKey)}
          >
            {t("datePicker.today")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

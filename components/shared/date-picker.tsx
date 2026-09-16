"use client";

/**
 * Single-date picker — one exact day, no range.
 *
 *   ┌────────────────────────────────┐
 *   │ ‹  📅 2026-09-15 ▾  ›          │   ← step a day either way
 *   └────────────────────────────────┘
 *        ┌──────────────────────────┐
 *        │ Today · Yesterday        │   ← quick jumps
 *        ├──────────────────────────┤
 *        │ Calendar (single mode)   │   ← picking a day applies at once
 *        └──────────────────────────┘
 *
 * Picking a day applies immediately and closes — with a single value there
 * is nothing to buffer, so no Cancel / Apply row. The ‹ › arrows step a day
 * without opening the popover, which is how an operator actually walks back
 * through history. Future dates aren't selectable.
 */

import * as React from "react";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatYMD(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  /** What counts as "today" (the latest selectable day). Pass the report
   *  timezone's current day so the picker agrees with the page it's on;
   *  defaults to the browser's local day. */
  today?: Date;
  className?: string;
}

export function DatePicker({ value, onChange, today: todayProp, className }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const today = startOfDay(todayProp ?? new Date());
  const isToday = sameDay(value, today);

  const step = (days: number) => {
    const next = startOfDay(new Date(value.getTime() + days * DAY_MS));
    if (next.getTime() > today.getTime()) return;
    onChange(next);
  };

  const pick = (d: Date | undefined) => {
    if (!d) return;
    onChange(startOfDay(d));
    setOpen(false);
  };

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label={t("sharedUI.datePicker.previousDay")}
        onClick={() => step(-1)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 tabular-nums">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{formatYMD(value)}</span>
            {isToday && (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                {t("sharedUI.dateRange.today")}
              </span>
            )}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <div className="flex gap-1 border-b border-border p-2">
            <Button
              variant={isToday ? "secondary" : "ghost"}
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => pick(today)}
            >
              {t("sharedUI.dateRange.today")}
            </Button>
            <Button
              variant={sameDay(value, new Date(today.getTime() - DAY_MS)) ? "secondary" : "ghost"}
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => pick(new Date(today.getTime() - DAY_MS))}
            >
              {t("sharedUI.dateRange.yesterday")}
            </Button>
          </div>
          <Calendar
            mode="single"
            selected={value}
            onSelect={pick}
            defaultMonth={value}
            numberOfMonths={1}
            disabled={{ after: today }}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        aria-label={t("sharedUI.datePicker.nextDay")}
        disabled={isToday}
        onClick={() => step(1)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

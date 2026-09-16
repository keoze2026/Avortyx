"use client";

/**
 * Date-range picker with preset shortcuts.
 *
 * Layout matches the Reports-page reference:
 *   ┌─────────────────────────────┐
 *   │ Today                     ▾ │   ← preset selector
 *   ├─────────────────────────────┤
 *   │ Calendar (range mode)       │
 *   ├─────────────────────────────┤
 *   │ 2026-09-01 ~ 2026-09-17     │   ← pending selection
 *   │              Cancel · Apply │
 *   └─────────────────────────────┘
 *
 * Nothing leaves the picker until Apply. Choosing a preset (Today,
 * Yesterday, This week, Last 7 days, Last 30 days, This month, Last month,
 * This year) fills the calendar with that span; picking dates by hand
 * flips the dropdown to "Custom range". Apply then hands the committed
 * range to `onChange` — and every consumer of this component turns that
 * into a `date_from` / `date_to` backend query, so the operator's click
 * is what triggers the fetch, never an intermediate selection.
 *
 * Presets are computed from `today`, which callers pass as the current
 * calendar day *in the report timezone* so "Today" means the same day
 * the charts are drawn in; it defaults to the browser's day.
 */

import * as React from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { calendarDayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRangePresetId =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";

const PRESET_IDS: DateRangePresetId[] = [
  "today",
  "yesterday",
  "thisWeek",
  "last7",
  "last30",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "custom",
];

const PRESET_KEY: Record<DateRangePresetId, string> = {
  today: "sharedUI.dateRange.today",
  yesterday: "sharedUI.dateRange.yesterday",
  thisWeek: "sharedUI.dateRange.thisWeek",
  last7: "sharedUI.dateRange.last7",
  last30: "sharedUI.dateRange.last30",
  thisMonth: "sharedUI.dateRange.thisMonth",
  lastMonth: "sharedUI.dateRange.lastMonth",
  thisYear: "sharedUI.dateRange.thisYear",
  custom: "sharedUI.dateRange.custom",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calendar span for a preset, relative to `today` (a local calendar date). */
export function rangeForPreset(id: DateRangePresetId, today: Date): DateRange | undefined {
  const t = startOfDay(today);
  switch (id) {
    case "today":
      return { from: t, to: t };
    case "yesterday": {
      const y = new Date(t.getTime() - DAY_MS);
      return { from: y, to: y };
    }
    case "thisWeek": {
      // ISO week: Monday through today.
      const dow = (t.getDay() + 6) % 7;
      return { from: new Date(t.getTime() - dow * DAY_MS), to: t };
    }
    case "last7":
      return { from: new Date(t.getTime() - 6 * DAY_MS), to: t };
    case "last30":
      return { from: new Date(t.getTime() - 29 * DAY_MS), to: t };
    case "thisMonth":
      return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: t };
    case "lastMonth": {
      const first = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const last = new Date(t.getFullYear(), t.getMonth(), 0);
      return { from: first, to: last };
    }
    case "thisYear":
      return { from: new Date(t.getFullYear(), 0, 1), to: t };
    case "custom":
      return undefined;
  }
}

/** Recognize a range as a known preset so the dropdown reflects the user's pick. */
function detectPreset(range: DateRange | undefined, today: Date): DateRangePresetId {
  if (!range?.from) return "custom";
  const from = calendarDayKey(range.from);
  const to = calendarDayKey(range.to ?? range.from);
  for (const id of PRESET_IDS) {
    if (id === "custom") continue;
    const candidate = rangeForPreset(id, today);
    if (!candidate?.from || !candidate.to) continue;
    if (from === calendarDayKey(candidate.from) && to === calendarDayKey(candidate.to)) {
      return id;
    }
  }
  return "custom";
}

interface Props {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  /** Optional className for the trigger button. */
  className?: string;
  /** Optional placeholder shown when no range is selected. */
  placeholder?: string;
  /** The current calendar day the presets are relative to (defaults to the browser's). */
  today?: Date;
}

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder,
  today,
}: Props) {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t("sharedUI.dateRange.placeholder");
  const [open, setOpen] = React.useState(false);
  const anchor = React.useMemo(() => startOfDay(today ?? new Date()), [today]);

  // Buffered state — edits live here until the operator hits Apply.
  const [buffer, setBuffer] = React.useState<DateRange | undefined>(value);
  const [preset, setPreset] = React.useState<DateRangePresetId>(() => detectPreset(value, anchor));

  // Re-sync the buffer whenever the popover opens (or the parent value changes).
  React.useEffect(() => {
    if (open) {
      setBuffer(value);
      setPreset(detectPreset(value, anchor));
    }
  }, [open, value, anchor]);

  const formatRange = React.useCallback(
    (range: DateRange | undefined) => {
      if (!range?.from) return null;
      const from = calendarDayKey(range.from);
      const to = range.to ? calendarDayKey(range.to) : from;
      return `${from} ~ ${to}`;
    },
    [],
  );

  const label = formatRange(value) ?? effectivePlaceholder;
  const pending = formatRange(buffer);

  // Apply needs a start date; a missing end date means a single day.
  const canApply = !!buffer?.from;

  const onPresetChange = (id: DateRangePresetId) => {
    setPreset(id);
    // A preset fills the calendar; it is committed by Apply, like any other
    // selection, so the backend is queried exactly once per operator click.
    setBuffer(id === "custom" ? undefined : rangeForPreset(id, anchor));
  };

  const onCalendarSelect = (range: DateRange | undefined) => {
    setBuffer(range);
    // Manual edits flip the dropdown to "Custom" unless they happen to match a preset.
    setPreset(detectPreset(range, anchor));
  };

  const onApply = () => {
    if (!buffer?.from) return;
    onChange({ from: buffer.from, to: buffer.to ?? buffer.from });
    setOpen(false);
  };

  const onCancel = () => {
    setBuffer(value);
    setPreset(detectPreset(value, anchor));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        {/* Preset selector */}
        <div className="border-b border-border p-3">
          <Select value={preset} onValueChange={(v) => onPresetChange(v as DateRangePresetId)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {t(PRESET_KEY[id])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Calendar. Re-keyed when a preset is chosen so it jumps to that
            span's month; in custom mode the key is stable and the operator
            pages through months freely. */}
        <Calendar
          key={preset === "custom" ? "custom" : `${preset}-${calendarDayKey(anchor)}`}
          mode="range"
          selected={buffer}
          onSelect={onCalendarSelect}
          numberOfMonths={1}
          defaultMonth={buffer?.from ?? value?.from ?? anchor}
          disabled={{ after: anchor }}
        />

        {/* Action row */}
        <div className="flex items-center justify-between gap-3 border-t border-border p-3">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {pending ?? t("sharedUI.dateRange.placeholder")}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t("sharedUI.dateRange.cancel")}
            </Button>
            <Button size="sm" onClick={onApply} disabled={!canApply}>
              {t("sharedUI.dateRange.apply")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

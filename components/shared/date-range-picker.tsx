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
 *   │              Cancel · Apply │
 *   └─────────────────────────────┘
 *
 * Internal state buffers the in-progress selection so the parent's
 * `onChange` only fires when the operator hits Apply — no jitter while
 * they're still picking dates.
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
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

type PresetId =
  | "today"
  | "yesterday"
  | "last7"
  | "last14"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "custom";

const PRESET_IDS: PresetId[] = [
  "today",
  "yesterday",
  "last7",
  "last14",
  "last30",
  "thisMonth",
  "lastMonth",
  "custom",
];

const PRESET_KEY: Record<PresetId, string> = {
  today: "sharedUI.dateRange.today",
  yesterday: "sharedUI.dateRange.yesterday",
  last7: "sharedUI.dateRange.last7",
  last14: "sharedUI.dateRange.last14",
  last30: "sharedUI.dateRange.last30",
  thisMonth: "sharedUI.dateRange.thisMonth",
  lastMonth: "sharedUI.dateRange.lastMonth",
  custom: "sharedUI.dateRange.custom",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeForPreset(id: PresetId, now = new Date()): DateRange | undefined {
  const today = startOfDay(now);
  switch (id) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(today.getTime() - DAY_MS);
      return { from: y, to: y };
    }
    case "last7":
      return { from: new Date(today.getTime() - 6 * DAY_MS), to: today };
    case "last14":
      return { from: new Date(today.getTime() - 13 * DAY_MS), to: today };
    case "last30":
      return { from: new Date(today.getTime() - 29 * DAY_MS), to: today };
    case "thisMonth":
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: today,
      };
    case "lastMonth": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: first, to: last };
    }
    case "custom":
      return undefined;
  }
}

/** Recognize a range as a known preset so the dropdown reflects the user's pick. */
function detectPreset(range: DateRange | undefined): PresetId {
  if (!range?.from) return "custom";
  const sameDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  for (const id of PRESET_IDS) {
    if (id === "custom") continue;
    const candidate = rangeForPreset(id);
    if (!candidate?.from || !candidate.to) continue;
    if (
      range.from &&
      range.to &&
      sameDate(range.from, candidate.from) &&
      sameDate(range.to, candidate.to)
    ) {
      return id;
    }
  }
  return "custom";
}

function formatYMD(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  /** Optional className for the trigger button. */
  className?: string;
  /** Optional placeholder shown when no range is selected. */
  placeholder?: string;
}

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder,
}: Props) {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t("sharedUI.dateRange.placeholder");
  const [open, setOpen] = React.useState(false);

  // Buffered state — edits live here until the operator hits Apply.
  const [buffer, setBuffer] = React.useState<DateRange | undefined>(value);
  const [preset, setPreset] = React.useState<PresetId>(detectPreset(value));

  // Re-sync the buffer whenever the popover opens (or the parent value changes).
  React.useEffect(() => {
    if (open) {
      setBuffer(value);
      setPreset(detectPreset(value));
    }
  }, [open, value]);

  const label = React.useMemo(() => {
    if (!value?.from) return effectivePlaceholder;
    const from = formatYMD(value.from);
    const to = value.to ? formatYMD(value.to) : from;
    return from === to ? `${from} ~ ${to}` : `${from} ~ ${to}`;
  }, [value, effectivePlaceholder]);

  const onPresetChange = (id: PresetId) => {
    setPreset(id);
    if (id === "custom") {
      // Custom keeps the picker open so the user can pick dates manually.
      setBuffer(undefined);
    } else {
      // Named presets (Today, Yesterday, Last 7 days, …) apply immediately
      // and close — no need to hit Apply.
      const range = rangeForPreset(id);
      setBuffer(range);
      onChange(range);
      setOpen(false);
    }
  };

  const onCalendarSelect = (range: DateRange | undefined) => {
    setBuffer(range);
    // Manual edits flip the dropdown to "Custom" unless they happen to match a preset.
    setPreset(detectPreset(range));
  };

  const onApply = () => {
    onChange(buffer);
    setOpen(false);
  };

  const onCancel = () => {
    setBuffer(value);
    setPreset(detectPreset(value));
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
          <Select value={preset} onValueChange={(v) => onPresetChange(v as PresetId)}>
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

        {/* Calendar */}
        <Calendar
          mode="range"
          selected={buffer}
          onSelect={onCalendarSelect}
          numberOfMonths={1}
          defaultMonth={buffer?.from ?? value?.from}
        />

        {/* Action row */}
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("sharedUI.dateRange.cancel")}
          </Button>
          <Button size="sm" onClick={onApply}>
            {t("sharedUI.dateRange.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

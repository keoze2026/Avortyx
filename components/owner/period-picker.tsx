"use client";

/**
 * Today / Yesterday / This week / This month / From-To, in Eastern days, for
 * the cards on Owner > Carrier Costs (CH-334). The routing cost had these
 * (CH-186, Sir 23 Oct: that order); the company profit now has the same
 * (Sir 28 Oct: "make same in today's sheet too"). The dates are the portal's
 * own DatePicker, not the browser's grey calendar.
 */
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/shared/date-picker";
import { useTranslation } from "@/hooks/use-translation";

export type Preset = "today" | "yesterday" | "week" | "month" | "custom";
export type Range = { start: string; end: string };

/** Today's date in Eastern time, YYYY-MM-DD (the days the backend counts in). */
export function easternToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function rangeFor(preset: Exclude<Preset, "custom">): Range {
  const today = easternToday();
  if (preset === "today") return { start: today, end: today };
  if (preset === "yesterday") {
    const y = shiftDay(today, -1);
    return { start: y, end: y };
  }
  if (preset === "week") {
    // This week, Monday to today (EST).
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    return { start: shiftDay(today, -((weekday + 6) % 7)), end: today };
  }
  return { start: `${today.slice(0, 8)}01`, end: today };
}

export function PeriodPicker({
  preset,
  range,
  onChange,
}: {
  preset: Preset;
  range: Range;
  onChange: (preset: Preset, range: Range) => void;
}) {
  const { t } = useTranslation();
  const today = easternToday();
  return (
    <>
      {(["today", "yesterday", "week", "month"] as const).map((p) => (
        <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => onChange(p, rangeFor(p))}>
          {t(`routingCost.preset.${p}`)}
        </Button>
      ))}
      <DatePicker
        aria-label={t("routingCost.from")}
        value={range.start}
        max={today}
        today={today}
        onChange={(start) => onChange("custom", { start, end: range.end < start ? start : range.end })}
      />
      <DatePicker
        aria-label={t("routingCost.to")}
        value={range.end}
        min={range.start}
        max={today}
        today={today}
        onChange={(end) => onChange("custom", { ...range, end })}
      />
    </>
  );
}

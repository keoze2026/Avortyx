"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { matchesCallStatusFilter } from "@/lib/call-status";
import { formatNumber } from "@/lib/format";
import type { Call } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { usePartnerHiddenColumns } from "@/hooks/use-partner-report-columns";

interface TotalCallsDonutProps {
  calls: Call[];
}

type SliceKey = "converted" | "noAnswer";

interface Slice {
  key: SliceKey;
  label: string;
  count: number;
  color: string;
  swatch: string;
}

/** Binary classification:
 *    "converted" — completed OR still in-progress (connected)
 *    "noAnswer"  — everything else (missed/no-answer, rejected, failed)
 *
 * Reuses the same `matchesCallStatusFilter("connected")` the Call Summary
 * totals use — this used to be its own local check
 * (`status === "completed" && payout > 0`), which routed in-progress calls
 * and unpaid completed calls into the red slice, disagreeing with the
 * Connected total shown elsewhere on the same page for the same data.
 *
 * We deliberately collapse the old "notConverted" category into "noAnswer"
 * so the donut reads as a strict 2-slice success/failure split — operators
 * shouldn't have to disambiguate two different red labels. */
function classify(c: Call): SliceKey {
  return matchesCallStatusFilter(c, "connected") ? "converted" : "noAnswer";
}

export function TotalCallsDonut({ calls }: TotalCallsDonutProps) {
  const { t } = useTranslation();
  // A buyer / publisher login does not see the slices the admin unticked
  // under its Reporting visibility (Connected / Not Connected), nor the
  // total when Incoming is unticked. Admin / staff: nothing is hidden.
  const partnerHidden = usePartnerHiddenColumns().summary;
  const counts = { converted: 0, noAnswer: 0 };
  for (const c of calls) counts[classify(c)] += 1;

  // Indigo for the positive outcome; destructive red for the rest.
  const allSlices: Slice[] = [
    { key: "converted", label: t("toolsUI.reports.totalDonut.converted"), count: counts.converted, color: "var(--accent)", swatch: "var(--accent)" },
    { key: "noAnswer",  label: t("toolsUI.reports.totalDonut.noAnswer"),  count: counts.noAnswer,  color: "var(--destructive)", swatch: "var(--destructive)" },
  ];
  const slices = allSlices.filter((s) =>
    s.key === "converted" ? !partnerHidden.has("connected") : !partnerHidden.has("noConnect"),
  );
  // The ring only draws slices that have calls. A slice with none still took
  // its 2 degree gap and its separator line, so a ring that was all one
  // colour had a notch cut out of it. With nothing drawn at all (no calls) a
  // faint full ring stands in so the chart is never empty.
  const ringSlices = slices.filter((s) => s.count > 0);
  const single = ringSlices.length <= 1;
  const ringData = ringSlices.length > 0
    ? ringSlices
    : [{ key: "none", label: "", count: 1, color: "var(--muted)", swatch: "var(--muted)" }];
  // Every call, not just the visible slices: "Total calls" is Incoming.
  const total = counts.converted + counts.noAnswer;
  const showTotal = !partnerHidden.has("incoming");

  // Track which slice is currently focused. `null` is the default — the
  // center shows the running TOTAL. Clicking a sector switches the center to
  // that slice's label + count; clicking the same sector again (or anywhere
  // off the chart) toggles back to TOTAL.
  const [activeKey, setActiveKey] = useState<SliceKey | null>(null);
  const activeSlice = activeKey
    ? slices.find((s) => s.key === activeKey) ?? null
    : null;

  return (
    <Card
      className="flex h-full flex-col"
      // Click anywhere outside the chart sectors to reset the focused slice
      // back to TOTAL. Each sector stops propagation via its own onClick.
      onClick={() => setActiveKey(null)}
    >
      {/* justify-end anchors the ring+legend block to the card's bottom edge,
          matching the hourly chart's legend anchor so both rows sit on the
          same line across the two equal-height sibling cards. */}
      <CardContent className="flex flex-1 flex-col items-center justify-end gap-4">
        <div
          // Suppress the browser's default focus outline on the SVG sectors
          // Recharts renders — clicking a slice was painting a square focus
          // ring around the chart. We still want keyboard focus to work, so
          // we only kill the visible outline, not the focus state itself.
          className="relative h-44 w-44 [&_.recharts-wrapper:focus]:outline-none [&_.recharts-sector:focus]:outline-none [&_path:focus]:outline-none [&_svg:focus]:outline-none"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ringData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="76%"
                outerRadius="92%"
                paddingAngle={single ? 0 : 2}
                stroke={single ? "none" : "var(--card)"}
                strokeWidth={single ? 0 : 3}
                isAnimationActive
                animationDuration={500}
                activeShape={undefined}
                activeIndex={-1}
                onClick={(payload, idx, e) => {
                  // Stop the click from bubbling to the Card-level reset.
                  (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                  const next = ringSlices[idx];
                  if (!next) return;
                  // Toggle: clicking the already-active slice deselects it
                  // and the center reverts to TOTAL.
                  setActiveKey((prev) => (prev === next.key ? null : next.key));
                }}
              >
                {ringData.map((s) => (
                  <Cell
                    key={s.key}
                    fill={s.color}
                    // Only dim the unselected slices while a slice IS active;
                    // when nothing's selected, every slice renders at full
                    // saturation alongside the TOTAL label.
                    fillOpacity={
                      activeKey === null || s.key === activeKey ? 1 : 0.35
                    }
                    tabIndex={-1}
                    style={{ outline: "none", cursor: "pointer" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centre label (boss request): "TOTAL CALLS" sits on the exact centre
              of the ring, and the number sits just under it. Only the label
              takes part in the centring; the number is placed below it, so it
              cannot pull the label off the middle. The letter-spacing adds
              space after the last letter, so the same is added before the
              first (pl) to keep the word itself centred. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
            {activeSlice ? (
              <div className="relative flex flex-col items-center">
                <span
                  className="max-w-[7rem] truncate pl-[0.05em] text-[10px] font-extrabold uppercase leading-none tracking-wider"
                  style={{ color: activeSlice.swatch }}
                >
                  {activeSlice.label}
                </span>
                <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-lg font-bold tabular-nums leading-none">
                  {formatNumber(activeSlice.count)}
                </span>
              </div>
            ) : showTotal ? (
              <div className="relative flex flex-col items-center">
                {/* "TOTAL CALLS" in the middle, the number under it - same as the Dashboard. */}
                <span className="pl-[0.05em] text-[10px] font-extrabold uppercase leading-none tracking-wider text-muted-foreground">
                  {t("dashboard.donut.totalCalls")}
                </span>
                <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-lg font-bold tabular-nums leading-none">
                  {formatNumber(total)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <ul
          // Legend a size smaller than before (boss request), still bold.
          className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {slices.map((s) => {
            const isActive = s.key === activeKey;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() =>
                    setActiveKey((prev) => (prev === s.key ? null : s.key))
                  }
                  // Both labels always bold and bright (boss request); the
                  // selected one is underlined instead of dimming the other.
                  className="inline-flex items-center gap-2 rounded px-1 py-0.5 font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-pressed={isActive}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.swatch }}
                  />
                  <span
                    className={
                      isActive
                        ? "font-extrabold text-foreground underline underline-offset-4"
                        : "font-extrabold text-foreground"
                    }
                  >
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { Call } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";

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
 *    "converted" — call connected and qualified (paying conversion)
 *    "noAnswer"  — everything else (missed, rejected, failed, in-flight)
 *
 * We deliberately collapse the old "notConverted" category into "noAnswer"
 * so the donut reads as a strict 2-slice success/failure split — operators
 * shouldn't have to disambiguate two different red labels. */
function classify(c: Call): SliceKey {
  if (c.status === "completed" && c.payout > 0) return "converted";
  return "noAnswer";
}

export function TotalCallsDonut({ calls }: TotalCallsDonutProps) {
  const { t } = useTranslation();
  const counts = { converted: 0, noAnswer: 0 };
  for (const c of calls) counts[classify(c)] += 1;

  // Indigo for the positive outcome; destructive red for the rest.
  const slices: Slice[] = [
    { key: "converted", label: t("toolsUI.reports.totalDonut.converted"), count: counts.converted, color: "var(--accent)", swatch: "var(--accent)" },
    { key: "noAnswer",  label: t("toolsUI.reports.totalDonut.noAnswer"),  count: counts.noAnswer,  color: "var(--destructive)", swatch: "var(--destructive)" },
  ];
  const total = slices.reduce((s, x) => s + x.count, 0);

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
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4">
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
                data={slices}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="76%"
                outerRadius="92%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={3}
                isAnimationActive
                animationDuration={500}
                activeShape={undefined}
                activeIndex={-1}
                onClick={(payload, idx, e) => {
                  // Stop the click from bubbling to the Card-level reset.
                  (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                  const next = slices[idx];
                  if (!next) return;
                  // Toggle: clicking the already-active slice deselects it
                  // and the center reverts to TOTAL.
                  setActiveKey((prev) => (prev === next.key ? null : next.key));
                }}
              >
                {slices.map((s) => (
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
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {activeSlice ? (
              <>
                <span
                  className="max-w-[7rem] truncate text-[11px] uppercase tracking-wider"
                  style={{ color: activeSlice.swatch }}
                >
                  {activeSlice.label}
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {formatNumber(activeSlice.count)}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("toolsUI.reports.totalDonut.total")}
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {formatNumber(total)}
                </span>
              </>
            )}
          </div>
        </div>

        <ul
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
                  className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ opacity: activeKey === null || isActive ? 1 : 0.65 }}
                  aria-pressed={isActive}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.swatch }}
                  />
                  <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
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

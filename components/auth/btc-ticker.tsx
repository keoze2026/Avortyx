"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { formatUsd, formatUsdShort, useBtcPrice } from "@/hooks/use-btc-price";

// The live BTC ticker above the headline (Avortyx also has a trading view). Quiet in size and
// colour so the headline leads, but visibly live: the digits roll up or down as the price moves
// (with a soft green or red tint for a moment), a small arrow shows the last move, the live dot
// and the end of the 24h line pulse, and the day's high, low and volume sit on one small line.

// the chart line, from the last 24 hours (oldest first) with the live price last, and its end point
function chartPath(points: number[], w: number, h: number) {
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => [(i / (points.length - 1)) * w, h - 1 - ((v - min) / span) * (h - 2)]);
  return { d: xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "), end: xy[xy.length - 1] };
}

// one digit as a column of 0-9 that slides to the current digit, so a change rolls into place
function Digit({ d }: { d: number }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none" style={{ width: "0.62em" }}>
      <span
        className="absolute left-0 top-0 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(${-d}em)` }}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block h-[1em] text-center">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

// "$82,084" with rolling digits; separators and the dollar sign stay still. The digit columns are
// hidden from screen readers and copy-paste; the plain price is there for both instead.
function RollingPrice({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center">
      <span className="sr-only">{text}</span>
      <span className="inline-flex select-none items-center" aria-hidden="true">
        {[...text].map((ch, i) => (/\d/.test(ch) ? <Digit key={i} d={Number(ch)} /> : <span key={i} className="leading-none">{ch}</span>))}
      </span>
    </span>
  );
}

export function BtcTicker({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const btc = useBtcPrice();
  const up = (btc.change24h ?? 0) >= 0;
  const points = btc.history.length > 1 && btc.priceUsd != null ? [...btc.history, btc.priceUsd] : btc.history;
  const W = 120, H = 22;
  const chart = points.length > 1 ? chartPath(points, W, H) : null;
  const details = [
    btc.high24h != null && t("x6.btc.high").replace("{value}", formatUsdShort(btc.high24h)),
    btc.low24h != null && t("x6.btc.low").replace("{value}", formatUsdShort(btc.low24h)),
    btc.volume24h != null && t("x6.btc.volume").replace("{value}", Math.round(btc.volume24h).toLocaleString("en-US")),
  ].filter(Boolean);
  const moved = btc.ticks > 0 ? btc.direction : null;

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-col items-start gap-[6px] rounded-xl border border-white/[0.07] bg-white/[0.025] px-[14px] py-[10px] backdrop-blur-md",
        className,
      )}
      title={btc.live ? t("x6.btc.titleLive") : t("x6.btc.title")}
    >
      {/* 12px: the rolling digits move in whole 12px steps, so they stay sharp */}
      <div className="flex items-center gap-3 text-[12px] leading-[16px]">
        <span className="inline-flex items-center gap-1.5 font-medium tracking-[0.12em] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            {btc.live && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--success)] opacity-50" />}
            <span className={cn("relative h-1.5 w-1.5 rounded-full", btc.live ? "bg-[var(--success)]/80" : "bg-muted-foreground/50")} />
          </span>
          BTC
        </span>
        {/* the tint restarts on each tick by alternating two identical animations (the digits must
            stay mounted to roll, so the element isn't re-keyed) */}
        <span
          className={cn(
            "inline-flex items-center gap-1 tabular-nums text-[#d8d8e2]",
            moved === "up" && (btc.ticks % 2 ? "animate-[tick-soft-up_1.4s_ease-out]" : "animate-[tick-soft-up-b_1.4s_ease-out]"),
            moved === "down" && (btc.ticks % 2 ? "animate-[tick-soft-down_1.4s_ease-out]" : "animate-[tick-soft-down-b_1.4s_ease-out]"),
          )}
        >
          {btc.ready && btc.priceUsd != null ? <RollingPrice text={formatUsd(btc.priceUsd)} /> : "—"}
          {moved && (
            <span className={cn("text-[9px]", moved === "up" ? "text-[#7fc9ad]" : "text-[#d99a9a]")} aria-hidden="true">
              {moved === "up" ? "▲" : "▼"}
            </span>
          )}
        </span>
        {typeof btc.change24h === "number" && (
          <span className={cn("tabular-nums", up ? "text-[#7fc9ad]" : "text-[#d99a9a]")}>
            {up ? "+" : "−"}
            {Math.abs(btc.change24h).toFixed(2)}%
          </span>
        )}
        {chart && (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[1.1rem] w-[4.5rem] overflow-visible" aria-hidden="true">
            <path d={chart.d} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" className="text-[var(--color-keppel-300)]/55" />
            {/* the live end of the line, pulsing */}
            <circle cx={chart.end[0]} cy={chart.end[1]} r="2" className="fill-[var(--color-keppel-300)]" />
            {btc.live && (
              <circle cx={chart.end[0]} cy={chart.end[1]} r="2" className="origin-center fill-[var(--color-keppel-300)] [transform-box:fill-box] animate-[btc-pulse_1.8s_ease-out_infinite]" />
            )}
          </svg>
        )}
      </div>
      {/* compact (phones): the price line only */}
      {!compact && details.length > 0 && (
        <p className="text-[11px] leading-[16px] tabular-nums tracking-[0.01em] text-muted-foreground">{t("x6.btc.period24h")} · {details.join(" · ")}</p>
      )}
    </div>
  );
}

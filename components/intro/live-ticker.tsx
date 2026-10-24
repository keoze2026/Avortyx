"use client";

import { useEffect } from "react";
import { useSignInTranslation } from "@/hooks/use-sign-in-translation";
import { cn } from "@/lib/utils";
import { chipMask, insetShape, type ChipShape } from "@/components/auth/chip-shape";
import { signalBackdrop } from "@/components/backdrop/backdrop-signal";
import { RollingNumber } from "./rolling-number";
import { formatUsd, useBtcPrice } from "@/hooks/use-btc-price";
import { useSystemStatus } from "./use-system-status";

// The live strip above the headline, in one glass chip — "● Live | Status Operational | BTC $82,431
// +0.62% ⌇", always on one line. The price is real (Coinbase, via hooks/use-btc-price); the status is
// a real check of the API (use-system-status). The design prototype also showed a latency figure, but it was invented, so the real
// sign-in leaves it out. Quiet in
// size so the headline leads, but visibly live, its figures in the ice accent kept for live things:
// digits roll, the price tints brighter ice or steel blue for a moment as it moves, and the live dot
// and the end of its 24h line send out a ring each time it moves. compact (phones): no 24h line, and
// no status on the narrowest phones.
// Each move of the price is also told to the backdrop (backdrop-signal.ts); the wide strip sends it,
// so the two strips don't both do.

// the strip's shape: a small chip (chip-shape.ts), its rim and its fill 1px in
const STRIP: ChipShape = { cut: 10, round: 8, soft: 4 };
const STRIP_MASK = chipMask(STRIP), STRIP_FILL = chipMask(insetShape(STRIP, 1));

// the 24h line: oldest first, the live price last
function sparkPath(points: number[], w: number, h: number) {
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => [(i / (points.length - 1)) * w, h - 1 - ((v - min) / span) * (h - 2)]);
  return { d: xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "), end: xy[xy.length - 1] };
}

function Segment({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    // a little tighter on the narrowest phones, so the compact strip fits
    <span className={cn("inline-flex shrink-0 items-center gap-[8px] whitespace-nowrap px-[10px] min-[360px]:px-[13px]", className)}>
      <span className="text-[11px] font-medium uppercase leading-[16px] tracking-[0.1em] text-muted-foreground">{label}</span>
      {/* 12px: the rolling digits move in whole 12px steps, so they stay sharp */}
      <span className="inline-flex items-center gap-[6px] text-[12px] font-medium leading-[16px] tabular-nums text-ice-100">{children}</span>
    </span>
  );
}

export function LiveTicker({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useSignInTranslation();
  const btc = useBtcPrice();
  const status = useSystemStatus();
  const up = (btc.change24h ?? 0) >= 0;
  const moved = btc.ticks > 0 ? btc.direction : null;
  const points = btc.history.length > 1 && btc.priceUsd != null ? [...btc.history, btc.priceUsd] : btc.history;
  const W = 44, H = 16;

  useEffect(() => {
    if (!compact && btc.ticks > 0) signalBackdrop({ kind: "tick", up: btc.direction === "up" });
  }, [btc.ticks, btc.direction, compact]);
  // the platform's health for the AI's heartbeat, kept on the page too for a scene that loads later
  useEffect(() => {
    if (compact || status === "checking") return;
    document.documentElement.dataset.systemStatus = status;
    signalBackdrop({ kind: "status", degraded: status === "degraded" });
  }, [status, compact]);
  const spark = points.length > 1 ? sparkPath(points, W, H) : null;

  return (
    <div
      role="group"
      aria-label={t("loginScreen.live.label")}
      className={cn(
        "chip-mask relative inline-flex max-w-full items-center p-px",
        // a hairline rim that catches the light at the top-left
        "bg-[linear-gradient(120deg,rgba(147,197,253,0.35),rgba(255,255,255,0.06)_35%,rgba(255,255,255,0.04)_70%,rgba(96,165,250,0.25))]",
        className,
      )}
      style={STRIP_MASK}
    >
      <div style={STRIP_FILL} className="chip-mask flex h-[34px] items-center divide-x divide-white/[0.07] overflow-hidden bg-obsidian-850/90 backdrop-blur-xl forced-colors:border">
        <span className="inline-flex shrink-0 items-center gap-[7px] pl-[12px] pr-[12px] text-[11px] font-semibold uppercase leading-[16px] tracking-[0.14em] text-ice-300">
          <span className="relative flex h-[6px] w-[6px]">
            {/* a ring that goes out once each time the price moves, not on a loop */}
            <span key={btc.ticks} className="absolute inset-0 rounded-full bg-ice-300 animate-[live-pulse_1.4s_ease-out_both]" />
            <span className="relative h-[6px] w-[6px] rounded-full bg-ice-300" />
          </span>
          {t("loginScreen.live.title")}
        </span>

        {/* (left out of the compact strip on the narrowest phones, where it wouldn't fit) */}
        <Segment label={t("loginScreen.live.status")} className={compact ? "max-[389px]:hidden" : undefined}>
          {status === "checking" ? (
            "—"
          ) : (
            <span title={t(`loginScreen.live.${status}Hint`)} className={cn("inline-flex items-center", status === "degraded" && "text-[#3b82f6]")}>
              {t(`loginScreen.live.${status}`)}
            </span>
          )}
        </Segment>

        <Segment label="BTC" className="pr-[16px]">
          {/* the tint restarts on each tick by alternating two identical animations (the digits must
              stay mounted to roll, so the element isn't re-keyed) */}
          <span
            title={t(btc.live ? "loginScreen.live.btcLive" : "loginScreen.live.btc")}
            className={cn(
              "inline-flex items-center",
              moved === "up" && (btc.ticks % 2 ? "animate-[tick-soft-up_1.4s_ease-out]" : "animate-[tick-soft-up-b_1.4s_ease-out]"),
              moved === "down" && (btc.ticks % 2 ? "animate-[tick-soft-down_1.4s_ease-out]" : "animate-[tick-soft-down-b_1.4s_ease-out]"),
            )}
          >
            {btc.ready && btc.priceUsd != null ? <RollingNumber text={formatUsd(btc.priceUsd)} /> : "—"}
          </span>
          {typeof btc.change24h === "number" && (
            // (left out of the compact strip on the narrowest phones, where it wouldn't fit)
            <span className={cn("text-[11px]", up ? "text-rise" : "text-fall", compact && "max-[359px]:hidden")}>
              {up ? "+" : "−"}
              {Math.abs(btc.change24h).toFixed(2)}%
            </span>
          )}
          {spark && !compact && (
            <svg viewBox={`0 0 ${W} ${H}`} className="hidden h-[16px] w-[44px] overflow-visible xl:block" aria-hidden="true">
              <defs>
                <linearGradient id="ticker-spark" x1="0" x2="1">
                  <stop offset="0" stopColor="#60a5fa" stopOpacity="0.15" />
                  <stop offset="1" stopColor="#93c5fd" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path d={spark.d} fill="none" stroke="url(#ticker-spark)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={spark.end[0]} cy={spark.end[1]} r="1.8" className="fill-ice-300" />
              {btc.live && (
                <circle key={btc.ticks} cx={spark.end[0]} cy={spark.end[1]} r="1.8" className="origin-center fill-ice-300 [transform-box:fill-box] animate-[live-pulse_1.4s_ease-out_both]" />
              )}
            </svg>
          )}
        </Segment>

      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

interface Props {
  /** Token symbol, e.g. "BTC". Mapped to "BINANCE:BTCUSDT" for the chart. */
  symbol: string;
  /** Default interval in TradingView's symbol — "15", "60", "240", "D", "W". */
  interval?: string;
  /**
   * Height of the chart container. Defaults to "as much of the viewport as
   * fits below the token header" (never under 540px), so the chart reads
   * as the page rather than a strip inside it.
   */
  height?: number | string;
}

const DEFAULT_HEIGHT = "clamp(540px, calc(100svh - 15rem), 1100px)";

/**
 * TradingView advanced-chart iframe.
 *
 * The widget URL has no auth requirement and re-renders the moment the props
 * change. We re-key on `symbol`, `interval`, and `theme` so the iframe
 * remounts when the user navigates or toggles light/dark — TradingView
 * doesn't expose a postMessage API on the free widget to retheme in place.
 *
 * A corner button takes the chart full-screen (fixed overlay); Esc or the
 * same button brings it back. The iframe itself is kept mounted across the
 * toggle so the chart doesn't reload.
 */
export function TradingViewChart({ symbol, interval = "60", height = DEFAULT_HEIGHT }: Props) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const [full, setFull] = React.useState(false);

  React.useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    // Keep the page behind from scrolling under the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  // Most major coins trade on Binance against USDT; that's the most reliable
  // mapping for the public widget. The user can change the symbol from inside
  // the TradingView toolbar if they want to look at a different exchange.
  const tvSymbol = `BINANCE:${symbol.toUpperCase()}USDT`;

  const src =
    `https://s.tradingview.com/widgetembed/?` +
    new URLSearchParams({
      frameElementId: `tv-${symbol}`,
      symbol: tvSymbol,
      interval,
      hideideas: "1",
      hidetrading: "1",
      theme,
      style: "1", // candles
      timezone: "Etc/UTC",
      withdateranges: "1",
      hide_side_toolbar: "0",
      allow_symbol_change: "1",
      save_image: "1",
      // `details` / `hotlist` / `calendar` are left out on purpose: the
      // embed treats any value — even "0" — as "show", which is what put
      // the "US Exchanges, Volume" watchlist down the right-hand side.
      studies_overrides: "{}",
      overrides: "{}",
      enabled_features: "[]",
      disabled_features: "[]",
      locale: "en",
    }).toString();

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-card",
        full ? "fixed inset-0 z-50" : "rounded-xl border border-border",
      )}
      style={full ? undefined : { height }}
    >
      <iframe
        key={`${tvSymbol}-${interval}-${theme}`}
        src={src}
        title={`${symbol} chart`}
        width="100%"
        height="100%"
        frameBorder={0}
        allow="clipboard-write"
        loading="lazy"
        style={{ display: "block" }}
      />
      <button
        type="button"
        onClick={() => setFull((v) => !v)}
        aria-label={full ? "Exit full screen" : "Full screen"}
        title={full ? "Exit full screen (Esc)" : "Full screen"}
        className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
      >
        {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

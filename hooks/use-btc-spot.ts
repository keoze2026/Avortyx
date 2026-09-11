"use client";

import { useEffect, useState } from "react";

/**
 * Live BTC spot price — CoinGecko's keyless public endpoint.
 *
 * Polls every 60s (well under the free-tier rate limit). Returns nulls until
 * the first successful response so callers can render a fallback value.
 */

interface BtcSpot {
  priceUsd: number | null;
  change24h: number | null;
  ready: boolean;
}

const ENDPOINT =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true";

const POLL_MS = 60_000;

export function useBtcSpot(): BtcSpot {
  const [state, setState] = useState<BtcSpot>({
    priceUsd: null,
    change24h: null,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch(ENDPOINT, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          bitcoin?: { usd?: number; usd_24h_change?: number };
        };
        const price = json.bitcoin?.usd;
        const change = json.bitcoin?.usd_24h_change;
        if (cancelled || typeof price !== "number") return;
        setState({
          priceUsd: price,
          change24h: typeof change === "number" ? change : null,
          ready: true,
        });
      } catch {
        // Network blip / blocker — keep previous values, try again on the next tick.
      }
    };

    void fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return state;
}

/** Format a USD spot price into the compact "$XX.XK" / "$X.XXM" style used in the hero chip. */
export function formatBtcSpot(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

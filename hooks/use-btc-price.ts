"use client";

import { useEffect, useRef, useState } from "react";

// The live BTC price and its day, for the BTC ticker on the sign-in screen.
//  - Coinbase's public ticker (a WebSocket, no key) streams every trade; the ticker shows the latest
//    price at most once a second, with the 24h change worked out from the day's opening price, and
//    the 24h high, low and volume.
//  - Coinbase's public 15-minute candles give the last 24 hours for the chart, refreshed every
//    15 minutes; the live price is drawn as its newest point.
//  - CoinGecko's public price API (what app.avortyx.io uses) gives the first price straight away,
//    and is polled every minute whenever the live feed is down.
// The feed closes while the tab is hidden and reconnects by itself, waiting longer after each failure.

const GECKO = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true";
const FEED = "wss://ws-feed.exchange.coinbase.com";
const CANDLES = "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=900";
const SHOW_EVERY_MS = 1000;

export type BtcPrice = {
  priceUsd: number | null;
  change24h: number | null;
  ready: boolean;
  live: boolean; // the stream is connected
  direction: "up" | "down" | null; // the last move, for the flash
  ticks: number; // goes up with every shown change, to restart the flash
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null; // in BTC
  history: number[]; // the last 24 hours, every 15 minutes, oldest first
};

type Day = { high: number | null; low: number | null; volume: number | null };

export function useBtcPrice(): BtcPrice {
  const [state, setState] = useState<BtcPrice>({
    priceUsd: null, change24h: null, ready: false, live: false, direction: null, ticks: 0,
    high24h: null, low24h: null, volume24h: null, history: [],
  });
  const latest = useRef<{ price: number; change: number | null; day: Day } | null>(null);

  useEffect(() => {
    let stopped = false;
    let ws: WebSocket | null = null;
    let retry = 0, retryTimer = 0, pollTimer = 0, candleTimer = 0;

    // show a price: remember which way it moved
    function show(price: number, change: number | null, live: boolean, day?: Day) {
      setState((s) => {
        const moved = s.priceUsd != null && Math.round(price) !== Math.round(s.priceUsd);
        return {
          ...s,
          ...(day ? { high24h: day.high, low24h: day.low, volume24h: day.volume } : {}),
          priceUsd: price,
          change24h: change,
          ready: true,
          live,
          direction: moved ? (price > s.priceUsd! ? "up" : "down") : s.direction,
          ticks: moved ? s.ticks + 1 : s.ticks,
        };
      });
    }

    async function poll() {
      try {
        const res = await fetch(GECKO, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const price = data?.bitcoin?.usd, change = data?.bitcoin?.usd_24h_change;
        if (!stopped && typeof price === "number" && !(ws && ws.readyState === WebSocket.OPEN)) {
          show(price, typeof change === "number" ? change : null, false);
        }
      } catch {
        // offline or rate-limited: keep what is shown
      }
    }

    // the last 24 hours of 15-minute closes for the chart: [time, low, high, open, close, volume]
    async function candles() {
      try {
        const res = await fetch(CANDLES, { cache: "no-store" });
        if (!res.ok) return;
        const rows: number[][] = await res.json();
        const closes = rows.slice(0, 96).map((r) => r[4]).filter(Number.isFinite).reverse();
        if (!stopped && closes.length > 1) setState((s) => ({ ...s, history: closes }));
      } catch {
        // keep the chart as it is
      }
    }

    function connect() {
      if (stopped || document.hidden || !("WebSocket" in window)) return;
      ws = new WebSocket(FEED);
      ws.onopen = () => {
        retry = 0;
        ws?.send(JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] }));
        setState((s) => ({ ...s, live: true }));
      };
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type !== "ticker") return;
          const price = Number(m.price), open = Number(m.open_24h);
          if (!Number.isFinite(price)) return;
          const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
          latest.current = {
            price,
            change: open > 0 ? ((price - open) / open) * 100 : null,
            day: { high: num(m.high_24h), low: num(m.low_24h), volume: num(m.volume_24h) },
          };
        } catch {
          // ignore a malformed message
        }
      };
      ws.onclose = () => {
        ws = null;
        setState((s) => ({ ...s, live: false }));
        if (stopped || document.hidden) return;
        retry = Math.min(retry + 1, 5);
        retryTimer = window.setTimeout(connect, 1000 * 2 ** retry); // 2s, 4s ... 32s
      };
      ws.onerror = () => ws?.close();
    }

    // the stream can send several trades a second: show the newest one, once a second
    const flush = window.setInterval(() => {
      const l = latest.current;
      if (!l) return;
      latest.current = null;
      show(l.price, l.change, true, l.day);
    }, SHOW_EVERY_MS);

    function onVisibility() {
      window.clearTimeout(retryTimer);
      if (document.hidden) {
        ws?.close();
      } else if (!ws) {
        retry = 0;
        poll();
        connect();
      }
    }

    poll();
    candles();
    connect();
    candleTimer = window.setInterval(candles, 15 * 60_000);
    pollTimer = window.setInterval(() => {
      if (!(ws && ws.readyState === WebSocket.OPEN)) poll();
    }, 60_000);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(flush);
      window.clearInterval(pollTimer);
      window.clearInterval(candleTimer);
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      ws?.close();
    };
  }, []);

  return state;
}

// $82,431: the whole price, as a trading view shows it
export function formatUsd(v: number) {
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// $82.4K: short, for the 24h figures
export function formatUsdShort(v: number) {
  return v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${Math.round(v)}`;
}

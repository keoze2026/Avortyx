"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

const ROUTED = [
  { num: "+1 (888) 555-0147", vert: "Health", buyer: "Apex Insurance",   payout: "$22.50", ms: "0.28s" },
  { num: "+1 (800) 555-0923", vert: "Solar",  buyer: "SolarEdge Partners", payout: "$18.00", ms: "0.31s" },
  { num: "+1 (844) 555-0381", vert: "Legal",  buyer: "Metro Legal Group", payout: "$41.00", ms: "0.19s" },
  { num: "+1 (877) 555-0264", vert: "Home",   buyer: "Beacon Roofing",    payout: "$16.75", ms: "0.34s" },
];

const STATS = [
  { to: 2.4,   dp: 1, pre: "$", suf: "B",  l: "Routed annually" },
  { to: 12,    dp: 0, pre: "",  suf: "M+", l: "Calls connected" },
  { to: 310,   dp: 0, pre: "",  suf: "ms", l: "Median decision" },
  { to: 99.99, dp: 2, pre: "",  suf: "%",  l: "Uptime" },
];

/**
 * Counts up once on mount. The hero sits above the fold, so there's no
 * observer to wait on. Reduced-motion users get the final value immediately
 * rather than a value that animates past them.
 */
function CountUp({ to, dp, pre, suf }: { to: number; dp: number; pre: string; suf: string }) {
  const [n, setN] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? to
      : 0,
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    const DURATION = 1100;
    let raf = 0;
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / DURATION, 1);
      // easeOutExpo — quick to settle, no lingering tail.
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setN(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);

  return (
    <span>
      {pre}
      {n.toFixed(dp)}
      {suf}
    </span>
  );
}

export function Hero() {
  return (
    <section
      id="hero"
      style={{
        position: "relative",
        background: "var(--m-bg-dark)",
        color: "var(--m-fg-d)",
        overflow: "hidden",
      }}
    >
      <div aria-hidden className="m-wash" />
      <div aria-hidden className="m-dots" />

      {/* Top padding clears the 64px fixed header, which no longer takes flow space. */}
      <div
        className="m-container"
        style={{ position: "relative", padding: "124px 24px 0" }}
      >
        <div
          style={{ display: "grid", gap: 56, alignItems: "center" }}
          className="lg:grid-cols-2"
        >
          {/* Copy */}
          <div className="m-rise">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 11px 5px 8px",
                borderRadius: 999,
                border: "1px solid var(--m-accent-line-d)",
                background: "var(--m-accent-tint-d)",
                fontSize: 12.5,
                fontWeight: 450,
                color: "var(--m-accent-d)",
                letterSpacing: "-0.005em",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--m-accent-d)" }} />
              Real-time pay-per-call routing
            </span>

            <h1 className="m-h1" style={{ marginTop: 22, color: "var(--m-fg-d)", maxWidth: "13ch" }}>
              Every call, routed to its best buyer.
            </h1>

            <p className="m-lead" style={{ marginTop: 20, color: "var(--m-fg-d2)", maxWidth: "46ch" }}>
              Avortyx scores each inbound call as it arrives and connects it to the
              buyer most likely to convert — with compliance, monitoring and payouts
              handled end to end.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 30 }}>
              <Link href={ROUTES.signup} className="m-btn m-btn-on-dark">
                Start free
              </Link>
              <Link href="#demo" className="m-btn m-btn-ghost-dark">
                Book a demo
              </Link>
            </div>

            <p className="m-label" style={{ marginTop: 26, color: "var(--m-fg-d3)" }}>
              SOC 2 Type II · TCPA · HIPAA-tier
            </p>
          </div>

          {/* Product panel */}
          <div className="m-rise" style={{ animationDelay: "90ms" }}>
            <div
              style={{
                background: "var(--m-bg-dark-2)",
                border: "1px solid var(--m-line-d2)",
                borderRadius: "var(--m-r-lg)",
                boxShadow: "var(--m-shadow-d)",
                overflow: "hidden",
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "13px 16px",
                  borderBottom: "1px solid var(--m-line-d)",
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: 999, background: "var(--m-accent-d)" }}
                  className="m-pulse"
                />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--m-fg-d)" }}>Live routing</span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--m-mono)",
                    fontSize: 11,
                    color: "var(--m-fg-d3)",
                  }}
                >
                  4 active
                </span>
              </div>

              {/* Rows */}
              <div>
                {ROUTED.map((r, i) => (
                  <div
                    key={r.num}
                    className="m-rise"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "13px 16px",
                      borderBottom: i < ROUTED.length - 1 ? "1px solid var(--m-line-d)" : "none",
                      // Rows arrive in sequence, echoing calls landing one by one.
                      animationDelay: `${260 + i * 110}ms`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          color: "var(--m-fg-d)",
                          fontFamily: "var(--m-mono)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.num}
                        </span>
                        <span
                          style={{
                            flexShrink: 0,
                            fontFamily: "var(--m-sans)",
                            fontSize: 10.5,
                            padding: "1.5px 7px",
                            borderRadius: 999,
                            border: "1px solid var(--m-line-d2)",
                            color: "var(--m-fg-d2)",
                          }}
                        >
                          {r.vert}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--m-fg-d3)",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        → {r.buyer} · {r.ms}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--m-mono)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--m-accent-d)",
                        fontVariantNumeric: "tabular-nums",
                        flexShrink: 0,
                      }}
                    >
                      {r.payout}
                    </div>
                  </div>
                ))}
              </div>

              {/* Panel footer */}
              <div
                style={{
                  padding: "11px 16px",
                  background: "var(--m-bg-dark-3)",
                  borderTop: "1px solid var(--m-line-d)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--m-mono)",
                  fontSize: 11,
                  color: "var(--m-fg-d3)",
                }}
              >
                <span>3,847 routed today</span>
                <span style={{ color: "var(--m-accent-d)" }}>0 dropped</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stat rail */}
        <div
          style={{
            marginTop: 72,
            borderTop: "1px solid var(--m-line-d)",
            display: "grid",
          }}
          className="grid-cols-2 sm:grid-cols-4"
        >
          {STATS.map((s, i) => (
            <div
              key={s.l}
              style={{
                padding: "26px 20px 30px",
                borderRight: i < STATS.length - 1 ? "1px solid var(--m-line-d)" : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--m-display)",
                  fontSize: 27,
                  fontWeight: 600,
                  letterSpacing: "-0.028em",
                  color: "var(--m-fg-d)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                <CountUp to={s.to} dp={s.dp} pre={s.pre} suf={s.suf} />
              </div>
              <div style={{ fontSize: 13, color: "var(--m-fg-d3)", marginTop: 7 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

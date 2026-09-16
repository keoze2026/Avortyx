"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, PhoneCall } from "@phosphor-icons/react/dist/ssr"
import { BRAND, ROUTES } from "@/lib/constants"

/**
 * Final CTA — the ask sits beside proof. The left half carries the copy and
 * buttons; the right half is a live routing feed: calls landing with their
 * buyer, payout and time-to-connect, and three counters ticking with them.
 * Rows arrive on a timer while the panel is on screen and the tab is
 * visible; reduced-motion shows the feed at rest.
 */

interface FeedCall {
  state: string
  caller: string
  buyer: string
  payout: number
  connect: number
}

const POOL: FeedCall[] = [
  { state: "TX", caller: "+1 323 ••• 9499", buyer: "Apex Insurance", payout: 65, connect: 1.4 },
  { state: "FL", caller: "+1 214 ••• 7783", buyer: "HomeShield Pros", payout: 42, connect: 1.1 },
  { state: "OH", caller: "+1 646 ••• 2210", buyer: "DriveSure Auto", payout: 37.5, connect: 1.8 },
  { state: "CA", caller: "+1 415 ••• 0342", buyer: "Meridian Health", payout: 58, connect: 1.2 },
  { state: "NY", caller: "+1 917 ••• 5561", buyer: "Northwind Benefits", payout: 61, connect: 1.6 },
  { state: "GA", caller: "+1 404 ••• 8127", buyer: "Gulf Coast Roofing", payout: 39.5, connect: 0.9 },
  { state: "IL", caller: "+1 312 ••• 4470", buyer: "Keystone Plumbing", payout: 36, connect: 1.3 },
  { state: "NC", caller: "+1 704 ••• 6635", buyer: "Summit Care", payout: 49, connect: 1.5 },
  { state: "PA", caller: "+1 215 ••• 1908", buyer: "Allied Warranty", payout: 40, connect: 1.7 },
  { state: "LA", caller: "+1 504 ••• 3374", buyer: "BrightPath Solar", payout: 44, connect: 1.0 },
]

const FEED_ROWS = 5
const FEED_INTERVAL_MS = 1900
const SEED_ROUTED = 1284
const SEED_SETTLED = 18_420

interface FeedRow extends FeedCall {
  id: number
  time: string
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const clock = (d: Date) =>
  [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":")

export function FinalCTA() {
  const [isVisible, setIsVisible] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)
  const [reduced, setReduced] = useState(false)
  const [rows, setRows] = useState<FeedRow[]>([])
  const [routed, setRouted] = useState(SEED_ROUTED)
  const [settled, setSettled] = useState(SEED_SETTLED)
  const nextRef = useRef(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    if (ref.current) observer.observe(ref.current)
    const onVis = () => setTabVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", onVis)
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onMq = () => setReduced(mq.matches)
    onMq()
    mq.addEventListener("change", onMq)
    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVis)
      mq.removeEventListener("change", onMq)
    }
  }, [])

  // Seed the feed on the client (times are wall-clock, so never render them on the server).
  useEffect(() => {
    const now = Date.now()
    const seed = Array.from({ length: FEED_ROWS }, (_, i) => {
      const call = POOL[i]
      return { ...call, id: i, time: clock(new Date(now - (FEED_ROWS - i) * FEED_INTERVAL_MS)) }
    }).reverse()
    nextRef.current = FEED_ROWS
    setRows(seed)
  }, [])

  // Land a new call every couple of seconds while the panel is watched.
  useEffect(() => {
    if (!isVisible || !tabVisible || reduced) return
    const id = setInterval(() => {
      const call = POOL[nextRef.current % POOL.length]
      const row: FeedRow = { ...call, id: nextRef.current, time: clock(new Date()) }
      nextRef.current += 1
      setRows((prev) => [row, ...prev].slice(0, FEED_ROWS))
      setRouted((n) => n + 1)
      setSettled((n) => n + call.payout)
    }, FEED_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isVisible, tabVisible, reduced])

  const avgConnect = rows.length ? rows.reduce((s, r) => s + r.connect, 0) / rows.length : 0

  return (
    <section ref={ref} className="py-24 border-t border-[var(--color-baltic-sea-900)] overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
        <div
          className={`relative rounded-3xl border border-[var(--color-keppel-800)]/50 bg-gradient-to-br from-[var(--color-keppel-950)] via-[var(--color-baltic-sea-950)] to-[var(--color-baltic-sea-950)] overflow-hidden transition-all duration-1000 ease-out ${
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          style={{
            boxShadow: isVisible ? "0 0 120px -30px var(--color-keppel-600)" : "none",
            transitionProperty: "opacity, transform, box-shadow",
          }}
        >
          {/* Dot grid, fading toward the feed */}
          <div
            aria-hidden
            className={`absolute inset-0 transition-opacity duration-1000 delay-300 ${isVisible ? "opacity-10" : "opacity-0"}`}
            style={{
              backgroundImage: "radial-gradient(var(--color-keppel-400) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "linear-gradient(90deg, #000 30%, transparent 85%)",
              WebkitMaskImage: "linear-gradient(90deg, #000 30%, transparent 85%)",
            }}
          />
          {/* Signal rings radiating from behind the feed */}
          <svg
            aria-hidden
            className="pointer-events-none absolute -right-24 top-1/2 hidden h-[140%] -translate-y-1/2 lg:block"
            viewBox="0 0 600 600"
            fill="none"
          >
            {[120, 190, 260, 330].map((r, i) => (
              <circle
                key={r}
                cx="300"
                cy="300"
                r={r}
                stroke="var(--color-keppel-500)"
                strokeWidth="1"
                strokeDasharray={i % 2 ? "2 8" : undefined}
                style={{ opacity: isVisible ? 0.16 - i * 0.03 : 0, transition: `opacity 1s ${400 + i * 150}ms` }}
              />
            ))}
          </svg>

          <div className="relative grid gap-10 p-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:p-14">
            {/* ── Copy ─────────────────────────────────────────── */}
            <div className="text-center lg:text-left">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-keppel-900)]/50 border border-[var(--color-keppel-700)] mb-6 transition-all duration-700 ${
                  isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-90"
                }`}
                style={{ transitionDelay: "300ms" }}
              >
                <PhoneCall weight="duotone" className="h-4 w-4 text-[var(--color-keppel-400)]" />
                <span className="text-sm font-medium text-[var(--color-keppel-300)]">Only pay for calls that reach a buyer</span>
              </div>

              <h2
                className={`text-3xl md:text-5xl font-bold text-[var(--color-baltic-sea-100)] mb-4 text-balance transition-all duration-700 ${
                  isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-8 blur-sm"
                }`}
                style={{ transitionDelay: "400ms" }}
              >
                Ready to route your first call?
              </h2>

              <p
                className={`text-lg text-[var(--color-baltic-sea-400)] max-w-xl mx-auto lg:mx-0 mb-8 transition-all duration-700 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: "500ms" }}
              >
                Join the networks turning inbound calls into predictable revenue. Your first campaign can be live
                before this feed scrolls past.
              </p>

              <div
                className={`flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 transition-all duration-700 ${
                  isVisible ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: "600ms" }}
              >
                <Button
                  asChild
                  size="lg"
                  className="bg-[var(--color-keppel-400)] text-[var(--color-keppel-950)] hover:bg-[var(--color-keppel-300)] rounded-full h-12 px-8 font-semibold transition-all duration-500 hover:shadow-[0_0_30px_-5px_var(--color-keppel-400)]"
                >
                  <Link href={ROUTES.signup}>
                    Start routing
                    <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="text-[var(--color-baltic-sea-300)] hover:text-[var(--color-baltic-sea-100)] hover:bg-[var(--color-baltic-sea-800)] rounded-full h-12 px-8"
                >
                  <a href={`mailto:${BRAND.email}?subject=Avortyx%20demo`}>Book a demo</a>
                </Button>
              </div>

              <p
                className={`mt-6 text-sm text-[var(--color-baltic-sea-500)] transition-all duration-700 ${
                  isVisible ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: "800ms" }}
              >
                Live in under 60 seconds · Transparent per-call billing · Cancel anytime
              </p>
            </div>

            {/* ── Live routing feed ────────────────────────────── */}
            <div
              className={`rounded-2xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)]/80 backdrop-blur-sm overflow-hidden transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ boxShadow: "var(--bento-shadow)", transitionDelay: "500ms" }}
            >
              <div className="flex items-center justify-between border-b border-[var(--color-baltic-sea-800)] px-4 py-2.5">
                <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-baltic-sea-400)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-keppel-400)] opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-keppel-500)]" />
                  </span>
                  <span className="text-[var(--color-baltic-sea-300)]">live routing feed</span>
                  <span className="text-[var(--color-baltic-sea-700)]">·</span>
                  <span>us-east-1</span>
                </div>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-baltic-sea-500)]">Today</span>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-[1fr_1fr_1.25fr] border-b border-[var(--color-baltic-sea-800)]">
                <Counter label="Routed" value={String(routed)} />
                <Counter label="Connect" value={avgConnect ? `${avgConnect.toFixed(1)}s` : "—"} accent />
                <Counter label="Settled" value={`$${Math.round(settled).toLocaleString("en-US")}`} last />
              </div>

              {/* Rows */}
              <ul className="divide-y divide-[var(--color-baltic-sea-800)]/60">
                {rows.map((r, i) => (
                  <li
                    key={r.id}
                    className={`flex items-center gap-3 px-4 py-2.5 text-xs ${i === 0 ? "animate-in fade-in slide-in-from-top-2 duration-500" : ""}`}
                    style={{ opacity: 1 - i * 0.14 }}
                  >
                    <span className="hidden font-mono tabular-nums text-[var(--color-baltic-sea-500)] sm:inline">{r.time}</span>
                    <span className="rounded border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-baltic-sea-300)]">
                      {r.state}
                    </span>
                    <span className="hidden font-mono text-[var(--color-baltic-sea-400)] md:inline">{r.caller}</span>
                    <span className="text-[var(--color-keppel-600)]">→</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-baltic-sea-200)]">{r.buyer}</span>
                    <span className="font-mono tabular-nums text-[var(--color-keppel-400)]">{money(r.payout)}</span>
                    <span className="w-9 text-right font-mono tabular-nums text-[var(--color-baltic-sea-500)]">
                      {r.connect.toFixed(1)}s
                    </span>
                  </li>
                ))}
                {rows.length === 0 &&
                  Array.from({ length: FEED_ROWS }, (_, i) => <li key={i} className="h-[37px]" aria-hidden />)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Counter({ label, value, accent = false, last = false }: { label: string; value: string; accent?: boolean; last?: boolean }) {
  return (
    <div className={`min-w-0 px-3 py-2.5 sm:px-4 ${last ? "" : "border-r border-[var(--color-baltic-sea-800)]"}`}>
      <div className="truncate text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">{label}</div>
      <div
        className={`mt-0.5 truncate font-mono text-[13px] tabular-nums sm:text-sm ${
          accent ? "text-[var(--color-keppel-400)]" : "text-[var(--color-baltic-sea-100)]"
        }`}
      >
        {value}
      </div>
    </div>
  )
}

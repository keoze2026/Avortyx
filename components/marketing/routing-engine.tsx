"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Lightning, Phone, ShieldCheck } from "@phosphor-icons/react"

/**
 * Hero visual — a live "routing engine" decision graph.
 *
 * One inbound call enters, passes through the intent core (compliance
 * screens light up, the intent score counts in), fans out to the eligible
 * buyers where bids arrive in real time, and the winning edge lights up as
 * the call connects. Three scenarios cycle so the graph never sits still.
 *
 * Everything is driven by one clock: `phase` (which stage) and `phaseT`
 * (0→1 progress within it, from a single rAF loop). Every derived value —
 * the score, the bids, which screens have passed, which edges flow — is a
 * pure function of those two, so there is exactly one timer to reason
 * about and nothing can drift out of sync. Animation pauses while the
 * panel is off-screen or the tab is hidden, and `prefers-reduced-motion`
 * pins the graph on the finished state of the first scenario.
 *
 * Geometry lives in a `Layout` object (design-space coordinates): the edge
 * layer is an SVG with that viewBox stretched to the panel, and the HTML
 * nodes are placed at the same points as percentages, so both layers stay
 * registered at any width. Strokes are `non-scaling` so the stretch never
 * thickens them. Wide screens get the left-to-right graph; narrow screens
 * get a stacked variant with the buyers in a 2×2 grid.
 */

type Phase = "ringing" | "screening" | "scoring" | "bidding" | "connected"

const PHASES: Phase[] = ["ringing", "screening", "scoring", "bidding", "connected"]

const PHASE_MS: Record<Phase, number> = {
  ringing: 1000,
  screening: 1500,
  scoring: 1300,
  bidding: 1700,
  connected: 2800,
}

const PHASE_LABEL: Record<Phase, string> = {
  ringing: "Inbound",
  screening: "Screening",
  scoring: "Scoring intent",
  bidding: "Live bidding",
  connected: "Connected",
}

type Outcome = "won" | "outbid" | "cap" | "geo"

interface Buyer {
  name: string
  bid: number
  outcome: Outcome
  /** Share of the buyer's daily cap already used, 0–1. */
  capUsed: number
}

interface Scenario {
  caller: string
  state: string
  source: string
  publisher: string
  vertical: string
  intent: number
  connectSec: number
  /** Four buyers; the winner is listed first so it lands in the top slot. */
  buyers: Buyer[]
}

const SCENARIOS: Scenario[] = [
  {
    caller: "+1 323 ••• 9499",
    state: "TX",
    source: "Google Ads",
    publisher: "MediaFlow",
    vertical: "Health",
    intent: 92,
    connectSec: 1.4,
    buyers: [
      { name: "Apex Insurance", bid: 65, outcome: "won", capUsed: 0.42 },
      { name: "Northwind Benefits", bid: 61, outcome: "cap", capUsed: 1 },
      { name: "Meridian Health", bid: 58, outcome: "outbid", capUsed: 0.67 },
      { name: "Summit Care", bid: 49, outcome: "geo", capUsed: 0.23 },
    ],
  },
  {
    caller: "+1 214 ••• 7783",
    state: "FL",
    source: "Meta Ads",
    publisher: "CallPeak",
    vertical: "Home services",
    intent: 87,
    connectSec: 1.1,
    buyers: [
      { name: "HomeShield Pros", bid: 42, outcome: "won", capUsed: 0.31 },
      { name: "Gulf Coast Roofing", bid: 39.5, outcome: "outbid", capUsed: 0.58 },
      { name: "BrightPath Solar", bid: 44, outcome: "geo", capUsed: 0.12 },
      { name: "Keystone Plumbing", bid: 36, outcome: "cap", capUsed: 1 },
    ],
  },
  {
    caller: "+1 646 ••• 2210",
    state: "OH",
    source: "Organic search",
    publisher: "LeadBridge",
    vertical: "Auto",
    intent: 78,
    connectSec: 1.8,
    buyers: [
      { name: "DriveSure Auto", bid: 37.5, outcome: "won", capUsed: 0.55 },
      { name: "Lakeside Motors", bid: 35, outcome: "outbid", capUsed: 0.74 },
      { name: "Allied Warranty", bid: 40, outcome: "cap", capUsed: 1 },
      { name: "Metro Auto Finance", bid: 29, outcome: "outbid", capUsed: 0.4 },
    ],
  },
]

/** Publisher's share of the payout, for the telemetry strip. */
const PUBLISHER_SHARE = 0.64

/* ─── Geometry ─────────────────────────────────────────────────────── */

interface Pt {
  x: number
  y: number
}

interface Layout {
  w: number
  h: number
  /** Inbound node centre. */
  call: Pt
  /** Caller details block anchor. `center` hangs below the node; `left`
   *  sits beside it, vertically centred. */
  callInfo: Pt & { align: "center" | "left" }
  /** Intent core centre. */
  core: Pt
  /** Compliance badges anchor + flow direction. */
  screens: Pt & { dir: "row" | "col" }
  /** Buyer card top-left corners (four). */
  buyers: Pt[]
  buyerW: number
  buyerH: number
  callEdge: string
  buyerEdges: string[]
}

const R_CALL = 28
const R_CORE = 62

/** ≥ 640px: call → core → buyers, left to right. */
const WIDE: Layout = {
  w: 600,
  h: 400,
  call: { x: 64, y: 200 },
  callInfo: { x: 64, y: 200 + R_CALL + 10, align: "center" },
  core: { x: 290, y: 200 },
  screens: { x: 290, y: 200 + R_CORE + 12, dir: "row" },
  buyerW: 168,
  buyerH: 60,
  buyers: [72, 152, 232, 312].map((y) => ({ x: 420, y: y - 30 })),
  callEdge: `M ${64 + R_CALL} 200 L ${290 - R_CORE} 200`,
  buyerEdges: [72, 152, 232, 312].map((y) => `M ${290 + R_CORE} 200 C 396 200, 376 ${y}, 420 ${y}`),
}

/** < 640px: stacked — call on top, core in the middle, buyers in a 2×2
 *  grid underneath. Row-two edges route around the outside of row one. */
const COMPACT: Layout = {
  w: 360,
  h: 514,
  call: { x: 48, y: 56 },
  callInfo: { x: 48 + R_CALL + 12, y: 56, align: "left" },
  core: { x: 180, y: 230 },
  screens: { x: 180 + R_CORE + 12, y: 230, dir: "col" },
  buyerW: 166,
  buyerH: 60,
  buyers: [
    { x: 10, y: 360 },
    { x: 184, y: 360 },
    { x: 10, y: 436 },
    { x: 184, y: 436 },
  ],
  callEdge: `M 48 ${56 + R_CALL} C 48 160, ${180 - R_CORE} 160, ${180 - R_CORE} 230`,
  buyerEdges: [
    `M 180 ${230 + R_CORE} C 180 326, 93 326, 93 360`,
    `M 180 ${230 + R_CORE} C 180 326, 267 326, 267 360`,
    `M 180 ${230 + R_CORE} C 160 330, 4 316, 4 400 C 4 440, 4 466, 10 466`,
    `M 180 ${230 + R_CORE} C 200 330, 356 316, 356 400 C 356 440, 356 466, 350 466`,
  ],
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)
const money = (n: number) => `$${n.toFixed(2)}`

const OUTCOME_LABEL: Record<Outcome, string> = {
  won: "Connected",
  outbid: "Outbid",
  cap: "Cap reached",
  geo: "Out of geo",
}

/* ─── Component ────────────────────────────────────────────────────── */

interface RoutingEngineProps {
  /** Fires when the stage changes: index into ringing…connected, or -1 on reset. */
  onPhase?: (phaseIndex: number) => void
}

export function RoutingEngine({ onPhase }: RoutingEngineProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [reduced, setReduced] = useState(false)
  const [wide, setWide] = useState(true)
  const [visible, setVisible] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)
  const [scenarioIdx, setScenarioIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>("ringing")
  const [phaseT, setPhaseT] = useState(0)
  const [routedToday, setRoutedToday] = useState(1283)

  const onPhaseRef = useRef(onPhase)
  onPhaseRef.current = onPhase

  // Reduced motion → freeze on the finished state, first scenario.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => {
      setReduced(mq.matches)
      if (mq.matches) {
        setScenarioIdx(0)
        setPhase("connected")
        setPhaseT(1)
      }
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Pick the graph geometry for the viewport.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const apply = () => setWide(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Only animate while on screen and the tab is in the foreground.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    const onVis = () => setTabVisible(document.visibilityState === "visible")
    document.addEventListener("visibilitychange", onVis)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  const running = visible && tabVisible && !reduced

  // The single clock: progress the current phase 0→1, then advance.
  useEffect(() => {
    if (!running) return
    const phaseIndex = PHASES.indexOf(phase)
    onPhaseRef.current?.(phaseIndex)
    if (phase === "connected") setRoutedToday((n) => n + 1)

    const dur = PHASE_MS[phase]
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setPhaseT(t)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    setPhaseT(0)
    raf = requestAnimationFrame(tick)

    const timeout = setTimeout(() => {
      const next = PHASES[phaseIndex + 1]
      if (next) {
        setPhase(next)
      } else {
        onPhaseRef.current?.(-1)
        setScenarioIdx((i) => (i + 1) % SCENARIOS.length)
        setPhase("ringing")
      }
    }, dur + 60)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timeout)
    }
  }, [phase, scenarioIdx, running])

  const L = wide ? WIDE : COMPACT
  const px = (v: number) => `${(v / L.w) * 100}%`
  const py = (v: number) => `${(v / L.h) * 100}%`

  const s = SCENARIOS[scenarioIdx]
  const stage = PHASES.indexOf(phase)
  const decided = phase === "connected"
  const winner = s.buyers.findIndex((b) => b.outcome === "won")

  // Derived display values — all pure functions of (phase, phaseT).
  const screens = [
    stage > 1 || (phase === "screening" && phaseT > 0.25),
    stage > 1 || (phase === "screening" && phaseT > 0.55),
    stage > 1 || (phase === "screening" && phaseT > 0.85),
  ]
  const intentT = stage > 2 ? 1 : phase === "scoring" ? easeOut(phaseT / 0.85) : 0
  const intentShown = stage >= 2
  const intent = Math.round(s.intent * intentT)
  const bidT = (i: number) => (stage > 3 ? 1 : phase === "bidding" ? easeOut((phaseT - i * 0.1) / 0.55) : 0)
  const bidsShown = stage >= 3

  const callEdgeState: EdgeState = stage <= 2 ? "flow" : "dim"
  const buyerEdgeState = (i: number): EdgeState =>
    decided ? (i === winner ? "lit" : "off") : phase === "bidding" ? "flow" : "off"

  const payout = s.buyers[winner].bid

  return (
    <div
      ref={rootRef}
      className="w-full overflow-hidden rounded-2xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)]"
      style={{ boxShadow: "var(--bento-shadow)" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-baltic-sea-800)] px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-baltic-sea-400)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-keppel-400)] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-keppel-500)]" />
          </span>
          <span className="text-[var(--color-baltic-sea-300)]">routing engine</span>
          <span className="text-[var(--color-baltic-sea-700)]">·</span>
          <span>us-east-1</span>
          <span className="hidden text-[var(--color-baltic-sea-700)] sm:inline">·</span>
          <span className="hidden sm:inline">{s.vertical}</span>
        </div>
        <div
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors duration-300 ${
            decided
              ? "border-[var(--color-keppel-500)] bg-[var(--color-keppel-500)] text-[var(--color-keppel-950)]"
              : "border-[var(--color-keppel-800)] bg-[var(--color-keppel-950)] text-[var(--color-keppel-300)]"
          }`}
        >
          {PHASE_LABEL[phase]}
        </div>
      </div>

      {/* ── Graph ──────────────────────────────────────────────── */}
      <div className="relative w-full" style={{ aspectRatio: `${L.w} / ${L.h}` }}>
        {/* Ambient glow behind the core */}
        <div
          aria-hidden
          className="pointer-events-none absolute h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700"
          style={{
            left: px(L.core.x),
            top: py(L.core.y),
            background: "radial-gradient(circle, var(--color-keppel-500) 0%, transparent 65%)",
            opacity: decided ? 0.22 : 0.1,
          }}
        />

        {/* Edges */}
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${L.w} ${L.h}`}
          preserveAspectRatio="none"
        >
          <Edge d={L.callEdge} state={callEdgeState} />
          {L.buyerEdges.map((d, i) => (
            <Edge key={i} d={d} state={buyerEdgeState(i)} />
          ))}
        </svg>

        {/* Inbound call node */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: px(L.call.x), top: py(L.call.y) }}
        >
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--color-baltic-sea-500)]">
            Inbound
          </span>
          <div className="relative flex h-14 w-14 items-center justify-center">
            {phase === "ringing" && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full border border-[var(--color-keppel-500)] opacity-60" />
                <span
                  className="absolute -inset-2 animate-ping rounded-full border border-[var(--color-keppel-700)] opacity-40"
                  style={{ animationDelay: "300ms" }}
                />
              </>
            )}
            <div
              className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition-colors duration-500 ${
                stage <= 2
                  ? "border-[var(--color-keppel-500)] bg-[var(--color-keppel-950)] text-[var(--color-keppel-300)]"
                  : "border-[var(--color-baltic-sea-700)] bg-[var(--color-baltic-sea-900)] text-[var(--color-baltic-sea-300)]"
              }`}
            >
              <Phone weight="fill" className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Caller details */}
        <div
          key={`caller-${scenarioIdx}`}
          className={`absolute flex flex-col gap-0.5 whitespace-nowrap animate-in fade-in duration-500 ${
            L.callInfo.align === "center" ? "-translate-x-1/2 items-center text-center" : "-translate-y-1/2 items-start text-left"
          }`}
          style={{ left: px(L.callInfo.x), top: py(L.callInfo.y) }}
        >
          <span className="font-mono text-[11px] text-[var(--color-baltic-sea-200)]">{s.caller}</span>
          <span className="text-[10px] text-[var(--color-baltic-sea-400)]">
            {s.state} · {s.source}
          </span>
          <span className="text-[10px] text-[var(--color-baltic-sea-500)]">via {s.publisher}</span>
        </div>

        {/* Intent core */}
        <div
          className="absolute h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2"
          style={{ left: px(L.core.x), top: py(L.core.y) }}
        >
          {/* Score ring */}
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 124 124">
            <circle cx="62" cy="62" r="58" fill="none" stroke="var(--color-baltic-sea-800)" strokeWidth="2" />
            <circle
              cx="62"
              cy="62"
              r="58"
              fill="none"
              stroke="var(--color-keppel-500)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 58}
              strokeDashoffset={2 * Math.PI * 58 * (1 - (s.intent / 100) * intentT)}
              style={{ filter: decided ? "drop-shadow(0 0 6px var(--color-keppel-500))" : undefined }}
            />
          </svg>
          {/* Scanner arcs — sweep while the core is still deciding */}
          <svg
            className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)]"
            viewBox="0 0 140 140"
            style={{
              animation: decided ? "none" : `rv-orbit ${phase === "bidding" ? 1.6 : 3.2}s linear infinite`,
              transformOrigin: "50% 50%",
              opacity: decided ? 0 : 1,
              transition: "opacity 400ms",
            }}
          >
            <circle
              cx="70"
              cy="70"
              r="67"
              fill="none"
              stroke="var(--color-keppel-400)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="34 387"
              opacity="0.9"
            />
            <circle
              cx="70"
              cy="70"
              r="67"
              fill="none"
              stroke="var(--color-keppel-600)"
              strokeWidth="1"
              strokeDasharray="8 120 3 290"
              strokeDashoffset="-150"
              opacity="0.6"
            />
          </svg>
          {/* Connected halo */}
          {decided && (
            <div
              aria-hidden
              className="absolute -inset-3 rounded-full border border-[var(--color-keppel-500)]"
              style={{ animation: "rv-halo 1.8s ease-in-out infinite", boxShadow: "0 0 32px -6px var(--color-keppel-500)" }}
            />
          )}
          {/* Core face */}
          <div className="absolute inset-[7px] flex flex-col items-center justify-center rounded-full bg-[var(--color-baltic-sea-950)]">
            <span className="font-mono text-[32px] font-semibold leading-none tabular-nums text-[var(--color-baltic-sea-50)]">
              {intentShown ? intent : "—"}
            </span>
            <span className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--color-keppel-400)]">
              intent
            </span>
          </div>
        </div>

        {/* Compliance screens */}
        <div
          className={`absolute flex gap-1.5 ${
            L.screens.dir === "row" ? "-translate-x-1/2 flex-row items-center" : "-translate-y-1/2 flex-col items-start"
          }`}
          style={{ left: px(L.screens.x), top: py(L.screens.y) }}
        >
          {["TCPA", "DNC", "VoIP"].map((label, i) => {
            const ok = screens[i]
            return (
              <span
                key={label}
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-wide transition-all duration-300 ${
                  ok
                    ? "border-[var(--color-keppel-700)] bg-[var(--color-keppel-950)] text-[var(--color-keppel-300)]"
                    : "border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)] text-[var(--color-baltic-sea-500)]"
                }`}
              >
                {ok ? (
                  <Check weight="bold" className="h-2.5 w-2.5" />
                ) : (
                  <ShieldCheck weight="bold" className="h-2.5 w-2.5 opacity-60" />
                )}
                {label}
              </span>
            )
          })}
        </div>

        {/* Buyer nodes */}
        {s.buyers.map((b, i) => {
          const isWinner = decided && i === winner
          const isLoser = decided && i !== winner
          const shownBid = b.bid * bidT(i)
          return (
            <div
              key={`${scenarioIdx}-${b.name}`}
              className={`absolute flex flex-col justify-center rounded-lg border px-2.5 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2 ${
                isWinner
                  ? "border-[var(--color-keppel-500)] bg-[var(--color-keppel-950)]"
                  : "border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)]"
              } ${isLoser ? "opacity-40" : "opacity-100"}`}
              style={{
                left: px(L.buyers[i].x),
                top: py(L.buyers[i].y),
                width: px(L.buyerW),
                height: py(L.buyerH),
                boxShadow: isWinner ? "0 0 28px -6px var(--color-keppel-500)" : undefined,
                animationDelay: `${i * 70}ms`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`truncate text-[11px] font-medium ${
                    isWinner ? "text-[var(--color-keppel-200)]" : "text-[var(--color-baltic-sea-200)]"
                  }`}
                >
                  {b.name}
                </span>
                <span
                  className={`shrink-0 font-mono text-[11px] tabular-nums ${
                    isWinner ? "text-[var(--color-keppel-300)]" : "text-[var(--color-baltic-sea-100)]"
                  }`}
                >
                  {bidsShown ? money(shownBid) : "—"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-baltic-sea-800)]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ${
                      b.capUsed >= 1 ? "bg-[var(--color-baltic-sea-600)]" : "bg-[var(--color-keppel-600)]"
                    }`}
                    style={{ width: `${Math.round(b.capUsed * 100)}%` }}
                  />
                </div>
                <span
                  className={`shrink-0 text-[9px] uppercase tracking-wider ${
                    isWinner
                      ? "inline-flex items-center gap-0.5 text-[var(--color-keppel-300)]"
                      : "text-[var(--color-baltic-sea-500)]"
                  }`}
                >
                  {isWinner && <Lightning weight="fill" className="h-2.5 w-2.5" />}
                  {decided ? OUTCOME_LABEL[b.outcome] : `${Math.round(b.capUsed * 100)}% cap`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Telemetry ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 border-t border-[var(--color-baltic-sea-800)] sm:grid-cols-4">
        <Stat label="Time to connect" value={decided ? `${s.connectSec.toFixed(1)}s` : "—"} accent={decided} />
        <Stat label="Buyer payout" value={decided ? money(payout) : "—"} />
        <Stat label="Publisher earns" value={decided ? money(payout * PUBLISHER_SHARE) : "—"} />
        <Stat label="Routed today" value={String(routedToday)} />
      </div>
    </div>
  )
}

/* ─── Pieces ───────────────────────────────────────────────────────── */

type EdgeState = "off" | "dim" | "flow" | "lit"

/** One graph edge. `flow` animates dashes toward the target and carries a
 *  packet along the path; `lit` is the solid, glowing winning route. */
function Edge({ d, state }: { d: string; state: EdgeState }) {
  const stroke =
    state === "lit"
      ? "var(--color-keppel-400)"
      : state === "flow"
        ? "var(--color-keppel-500)"
        : state === "dim"
          ? "var(--color-keppel-800)"
          : "var(--color-baltic-sea-800)"
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={state === "lit" ? 2 : 1.25}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        strokeDasharray={state === "flow" ? "6 8" : undefined}
        style={{
          transition: "stroke 400ms, opacity 400ms",
          opacity: state === "off" ? 0.6 : 1,
          animation: state === "flow" ? "rv-flow 0.6s linear infinite" : undefined,
          filter: state === "lit" ? "drop-shadow(0 0 4px var(--color-keppel-500))" : undefined,
        }}
      />
      {state === "flow" && (
        <circle r="3" fill="var(--color-keppel-300)" style={{ filter: "drop-shadow(0 0 4px var(--color-keppel-400))" }}>
          <animateMotion dur="1.1s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </g>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-r border-[var(--color-baltic-sea-800)] px-4 py-2.5 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r last:border-r-0 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0">
      <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">{label}</span>
      <span
        className={`font-mono text-sm tabular-nums transition-colors duration-300 ${
          accent ? "text-[var(--color-keppel-400)]" : "text-[var(--color-baltic-sea-100)]"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

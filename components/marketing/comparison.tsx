"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Minus, X, Wrench, ChartBar } from "@phosphor-icons/react/dist/ssr"
import { Logo } from "@/components/brand/logo"

/**
 * Comparison — Avortyx vs. legacy call trackers vs. a DIY carrier stack.
 *
 * The Avortyx column is the spine of the table: it's tinted, carries a
 * one-line statement of *how* each capability works, and is scored at the
 * bottom. The other two columns answer with a verdict icon plus the short
 * reason (what you'd actually get instead), so the table argues rather than
 * just ticks boxes. On phones the same data collapses into one card per
 * capability.
 */

type Support = boolean | "partial"

interface Verdict {
  v: Support
  note: string
}

interface Feature {
  name: string
  /** How Avortyx does it — shown in the Avortyx cell. */
  how: string
  legacy: Verdict
  diy: Verdict
}

const FEATURES: Feature[] = [
  {
    name: "Intent scoring on the first ring",
    how: "Scored from live signals before the buyer picks up",
    legacy: { v: false, note: "Post-call only" },
    diy: { v: false, note: "Not available" },
  },
  {
    name: "Real-time buyer bidding",
    how: "Every eligible buyer bids on every call",
    legacy: { v: "partial", note: "Static price tiers" },
    diy: { v: false, note: "Manual rate cards" },
  },
  {
    name: "TCPA & DNC screening built in",
    how: "Every attempt screened before it rings",
    legacy: { v: "partial", note: "Third-party add-on" },
    diy: { v: false, note: "Your own integration" },
  },
  {
    name: "Live barge & whisper",
    how: "Supervisors join any in-flight call",
    legacy: { v: "partial", note: "Listen-only" },
    diy: { v: false, note: "Carrier dependent" },
  },
  {
    name: "Per-buyer caps & concurrency",
    how: "Hourly, daily, monthly and concurrent limits",
    legacy: { v: true, note: "Daily caps" },
    diy: { v: "partial", note: "Hand-built limits" },
  },
  {
    name: "Automated publisher payouts",
    how: "Settled from the call record, no spreadsheets",
    legacy: { v: false, note: "Export & reconcile" },
    diy: { v: false, note: "Manual" },
  },
  {
    name: "Visual routing rules",
    how: "Geo, daypart, intent and caps in one builder",
    legacy: { v: false, note: "Config forms" },
    diy: { v: false, note: "Code" },
  },
  {
    name: "Number porting & pooling",
    how: "Port, pool and rotate from one place",
    legacy: { v: "partial", note: "Buy only" },
    diy: { v: true, note: "Via your carrier" },
  },
]

const CONTENDERS = [
  { key: "avortyx", name: "Avortyx", tagline: "Routing engine, all in one", icon: "logo" as const },
  { key: "legacy", name: "Legacy trackers", tagline: "Tracking + manual ops", icon: ChartBar },
  { key: "diy", name: "DIY carrier", tagline: "Carrier APIs + your code", icon: Wrench },
]

const score = (v: Support) => (v === true ? 1 : v === "partial" ? 0.5 : 0)
const TOTAL = FEATURES.length
const SCORES = {
  avortyx: TOTAL,
  legacy: FEATURES.reduce((n, f) => n + score(f.legacy.v), 0),
  diy: FEATURES.reduce((n, f) => n + score(f.diy.v), 0),
}

/* ─── Pieces ───────────────────────────────────────────────────────── */

function VerdictIcon({ value, isVisible, delay }: { value: Support; isVisible: boolean; delay: number }) {
  const base = `flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
    isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
  }`
  if (value === true) {
    return (
      <div className={`${base} bg-[var(--color-keppel-900)]`} style={{ transitionDelay: `${delay}ms` }}>
        <Check weight="bold" className="h-3.5 w-3.5 text-[var(--color-keppel-400)]" />
      </div>
    )
  }
  if (value === "partial") {
    return (
      <div className={`${base} bg-[var(--color-baltic-sea-800)]`} style={{ transitionDelay: `${delay}ms` }}>
        <Minus weight="bold" className="h-3.5 w-3.5 text-[var(--color-baltic-sea-400)]" />
      </div>
    )
  }
  return (
    <div className={`${base} bg-[var(--color-baltic-sea-900)]`} style={{ transitionDelay: `${delay}ms` }}>
      <X weight="bold" className="h-3.5 w-3.5 text-[var(--color-baltic-sea-600)]" />
    </div>
  )
}

/** Verdict + reason, for the two non-Avortyx columns. */
function VerdictCell({ verdict, isVisible, delay }: { verdict: Verdict; isVisible: boolean; delay: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <VerdictIcon value={verdict.v} isVisible={isVisible} delay={delay} />
      <span
        className={`text-xs transition-opacity duration-500 ${
          verdict.v === true ? "text-[var(--color-baltic-sea-300)]" : "text-[var(--color-baltic-sea-500)]"
        }`}
        style={{ opacity: isVisible ? 1 : 0, transitionDelay: `${delay + 120}ms` }}
      >
        {verdict.note}
      </span>
    </div>
  )
}

/** Coverage bar with an animated count for the footer row. */
function Coverage({ value, accent, isVisible, delay }: { value: number; accent?: boolean; isVisible: boolean; delay: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!isVisible) return
    const start = performance.now()
    const dur = 900
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start - delay) / dur)
      if (t >= 0) setShown(value * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isVisible, value, delay])

  const label = Number.isInteger(shown) ? String(shown) : shown.toFixed(1)
  return (
    <div>
      <div className="flex items-baseline gap-1 font-mono tabular-nums">
        <span className={`text-lg font-semibold ${accent ? "text-[var(--color-keppel-400)]" : "text-[var(--color-baltic-sea-200)]"}`}>
          {label}
        </span>
        <span className="text-[11px] text-[var(--color-baltic-sea-500)]">/ {TOTAL}</span>
      </div>
      <div className="mt-1.5 h-1 w-full max-w-[9rem] overflow-hidden rounded-full bg-[var(--color-baltic-sea-800)]">
        <div
          className={`h-full rounded-full ${accent ? "bg-[var(--color-keppel-500)]" : "bg-[var(--color-baltic-sea-500)]"}`}
          style={{ width: `${(shown / TOTAL) * 100}%` }}
        />
      </div>
    </div>
  )
}

function ContenderHeader({ contender, accent }: { contender: (typeof CONTENDERS)[number]; accent?: boolean }) {
  const Icon = contender.icon
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
          accent
            ? "border-[var(--color-keppel-700)] bg-[var(--color-keppel-950)] text-[var(--color-keppel-300)]"
            : "border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)] text-[var(--color-baltic-sea-400)]"
        }`}
      >
        {Icon === "logo" ? (
          <Logo tone="current" uid="mk-compare" className="h-4.5 w-4.5" />
        ) : (
          <Icon weight="duotone" className="h-4.5 w-4.5" />
        )}
      </div>
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${accent ? "text-[var(--color-keppel-300)]" : "text-[var(--color-baltic-sea-200)]"}`}>
          {contender.name}
        </div>
        <div className="text-[11px] text-[var(--color-baltic-sea-500)]">{contender.tagline}</div>
      </div>
    </div>
  )
}

/* ─── Section ──────────────────────────────────────────────────────── */

export function Comparison() {
  const [isVisible, setIsVisible] = useState(false)
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
    return () => observer.disconnect()
  }, [])

  const avortyxCol = "bg-[var(--color-keppel-950)]/35 border-x border-[var(--color-keppel-900)]"

  return (
    <section ref={ref} className="py-24 border-t border-[var(--color-baltic-sea-900)] overflow-hidden">
      <div className="mx-auto max-w-[1100px] px-2.5 sm:px-6 lg:px-12">
        <div
          className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-12 blur-sm"}`}
        >
          <span className="text-sm font-medium text-[var(--color-keppel-400)] uppercase tracking-wider">
            Comparison
          </span>
          <h2 className="mt-3 text-3xl font-bold text-[var(--color-baltic-sea-100)] md:text-4xl text-balance">
            Why networks choose Avortyx
          </h2>
          <p className="mt-4 text-lg text-[var(--color-baltic-sea-400)]">
            Everything a pay-per-call network needs, without stitching a tracker to a carrier to a spreadsheet.
          </p>
        </div>

        <div
          className={`rounded-2xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)] overflow-hidden transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-95"
          }`}
          style={{ boxShadow: "var(--bento-shadow)", transitionDelay: "200ms" }}
        >
          {/* ── Desktop / tablet table ─────────────────────────── */}
          <table className="hidden w-full md:table">
            <colgroup>
              <col className="w-[27%]" />
              <col className="w-[31%]" />
              <col className="w-[21%]" />
              <col className="w-[21%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--color-baltic-sea-800)]">
                <th className="p-5 lg:p-6 text-left align-bottom">
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">
                    Capability
                  </span>
                </th>
                {CONTENDERS.map((c) => (
                  <th
                    key={c.key}
                    className={`p-5 lg:p-6 text-left align-bottom font-normal ${c.key === "avortyx" ? avortyxCol : ""}`}
                  >
                    <ContenderHeader contender={c} accent={c.key === "avortyx"} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr
                  key={f.name}
                  className={`group border-b border-[var(--color-baltic-sea-800)]/60 transition-all duration-500 hover:bg-[var(--color-baltic-sea-900)]/40 ${
                    isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
                  }`}
                  style={{ transitionDelay: `${300 + i * 60}ms` }}
                >
                  <td className="p-5 lg:p-6 text-sm font-medium text-[var(--color-baltic-sea-200)]">{f.name}</td>
                  <td className={`p-5 lg:p-6 ${avortyxCol}`}>
                    <div className="flex items-start gap-2.5">
                      <VerdictIcon value={true} isVisible={isVisible} delay={400 + i * 60} />
                      <span
                        className="text-xs leading-snug text-[var(--color-keppel-200)] transition-opacity duration-500"
                        style={{ opacity: isVisible ? 1 : 0, transitionDelay: `${520 + i * 60}ms` }}
                      >
                        {f.how}
                      </span>
                    </div>
                  </td>
                  <td className="p-5 lg:p-6">
                    <VerdictCell verdict={f.legacy} isVisible={isVisible} delay={450 + i * 60} />
                  </td>
                  <td className="p-5 lg:p-6">
                    <VerdictCell verdict={f.diy} isVisible={isVisible} delay={500 + i * 60} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--color-baltic-sea-800)]">
                <td className="p-5 lg:p-6">
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">
                    Coverage
                  </span>
                  <div className="mt-1 text-[11px] text-[var(--color-baltic-sea-500)]">Partial counts as half</div>
                </td>
                <td className={`p-5 lg:p-6 ${avortyxCol}`}>
                  <Coverage value={SCORES.avortyx} accent isVisible={isVisible} delay={900} />
                </td>
                <td className="p-5 lg:p-6">
                  <Coverage value={SCORES.legacy} isVisible={isVisible} delay={1000} />
                </td>
                <td className="p-5 lg:p-6">
                  <Coverage value={SCORES.diy} isVisible={isVisible} delay={1100} />
                </td>
              </tr>
            </tfoot>
          </table>

          {/* ── Phone: one card per capability ─────────────────── */}
          <div className="md:hidden">
            <div className="grid grid-cols-3 gap-2 border-b border-[var(--color-baltic-sea-800)] p-4">
              {CONTENDERS.map((c) => (
                <div key={c.key} className="min-w-0">
                  <div className={`truncate text-xs font-semibold ${c.key === "avortyx" ? "text-[var(--color-keppel-300)]" : "text-[var(--color-baltic-sea-300)]"}`}>
                    {c.name}
                  </div>
                  <div className="mt-1">
                    <Coverage
                      value={SCORES[c.key as keyof typeof SCORES]}
                      accent={c.key === "avortyx"}
                      isVisible={isVisible}
                      delay={400}
                    />
                  </div>
                </div>
              ))}
            </div>
            {FEATURES.map((f, i) => (
              <div
                key={f.name}
                className={`border-b border-[var(--color-baltic-sea-800)]/60 p-4 last:border-b-0 transition-all duration-500 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${300 + i * 60}ms` }}
              >
                <div className="text-sm font-medium text-[var(--color-baltic-sea-200)]">{f.name}</div>
                <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-[var(--color-keppel-900)] bg-[var(--color-keppel-950)]/40 px-2.5 py-2">
                  <VerdictIcon value={true} isVisible={isVisible} delay={400 + i * 60} />
                  <span className="text-xs leading-snug text-[var(--color-keppel-200)]">{f.how}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["legacy", "diy"] as const).map((k) => (
                    <div key={k} className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-baltic-sea-500)]">
                        {k === "legacy" ? "Legacy" : "DIY"}
                      </div>
                      <div className="mt-1">
                        <VerdictCell verdict={f[k]} isVisible={isVisible} delay={450 + i * 60} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

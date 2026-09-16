"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Check, CurrencyDollar, GitBranch, Phone } from "@phosphor-icons/react/dist/ssr"

/**
 * How it works — three steps, each headed by a small live vignette of the
 * product surface for that step (a provisioned number, a rule set, a call
 * receipt) so the sequence reads as the product rather than as captions.
 * A signal rail runs behind the step markers and fills left-to-right as
 * each step comes alive on scroll.
 */

const STEPS = [
  {
    icon: Phone,
    number: "01",
    title: "Point a number at Avortyx",
    description:
      "Buy or port a tracking number and attach it to a campaign with your caps, geos and schedule.",
  },
  {
    icon: GitBranch,
    number: "02",
    title: "Set the routing rules",
    description:
      "Score on intent, filter by state and daypart, and respect every buyer's concurrency and daily caps.",
  },
  {
    icon: CurrencyDollar,
    number: "03",
    title: "Connect and get paid",
    description:
      "The best-fit buyer answers. Duration, qualification and payout are recorded on the call automatically.",
  },
]

const RULES = [
  { key: "intent", value: "≥ 70" },
  { key: "state", value: "TX · FL · OH" },
  { key: "daypart", value: "09:00 – 21:00" },
  { key: "concurrency", value: "≤ 25 per buyer" },
]

/** Deterministic bar heights for the call waveform (0–1). */
const WAVE = [0.3, 0.55, 0.8, 0.45, 0.9, 0.6, 0.35, 0.7, 1, 0.5, 0.25, 0.65, 0.85, 0.4, 0.6, 0.3, 0.75, 0.5]

export function HowItWorks() {
  const [isVisible, setIsVisible] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
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

  useEffect(() => {
    if (!isVisible) return
    const ids = STEPS.map((_, i) => setTimeout(() => setActiveStep(i), 400 + i * 450))
    return () => ids.forEach(clearTimeout)
  }, [isVisible])

  return (
    <section id="how-it-works" ref={ref} className="py-24 border-t border-[var(--color-baltic-sea-900)] overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
        <div
          className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-12 blur-sm"}`}
        >
          <span className="text-sm font-medium text-[var(--color-keppel-400)] uppercase tracking-wider">
            How it works
          </span>
          <h2 className="mt-3 text-3xl font-bold text-[var(--color-baltic-sea-100)] md:text-4xl text-balance">
            From first ring to paid call in seconds
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10 md:gap-8 lg:gap-12">
          {STEPS.map((step, i) => {
            const on = activeStep >= i
            return (
              <div
                key={step.number}
                className={`relative flex flex-col transition-all duration-700 ease-out ${
                  on ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-16 scale-95"
                }`}
              >
                {/* Signal rail to the next step */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[10.25rem] -right-5 lg:-right-9 h-px">
                    <div className="absolute inset-0 bg-[var(--color-baltic-sea-800)]" />
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--color-keppel-500)] via-[var(--color-keppel-400)] to-[var(--color-keppel-600)] transition-[width] duration-1000 ease-out"
                      style={{ width: activeStep > i ? "100%" : "0%", transitionDelay: "150ms" }}
                    />
                    {activeStep > i && (
                      <span
                        className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--color-keppel-300)] shadow-[0_0_10px_var(--color-keppel-400)]"
                        style={{ animation: "hiw-travel 2.4s linear infinite" }}
                      />
                    )}
                  </div>
                )}

                {/* Marker */}
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className={`relative h-14 w-14 rounded-2xl bg-[var(--color-baltic-sea-900)] border flex items-center justify-center transition-all duration-500 ${
                      on
                        ? "border-[var(--color-keppel-700)] shadow-[0_0_24px_-6px_var(--color-keppel-500)]"
                        : "border-[var(--color-baltic-sea-800)]"
                    }`}
                  >
                    <step.icon
                      weight="duotone"
                      className={`h-7 w-7 transition-colors duration-500 ${on ? "text-[var(--color-keppel-400)]" : "text-[var(--color-baltic-sea-600)]"}`}
                    />
                  </div>
                  <span
                    className={`font-mono text-sm tracking-[0.2em] transition-colors duration-500 ${
                      on ? "text-[var(--color-keppel-400)]" : "text-[var(--color-baltic-sea-600)]"
                    }`}
                  >
                    STEP {step.number}
                  </span>
                </div>

                {/* Vignette */}
                <div
                  className={`relative flex flex-1 flex-col justify-center rounded-xl border bg-[var(--color-baltic-sea-950)] p-4 transition-all duration-700 ${
                    on ? "border-[var(--color-baltic-sea-800)]" : "border-[var(--color-baltic-sea-900)]"
                  }`}
                  style={{ boxShadow: on ? "var(--bento-shadow)" : undefined }}
                >
                  {i === 0 && <NumberVignette on={on} />}
                  {i === 1 && <RulesVignette on={on} />}
                  {i === 2 && <ReceiptVignette on={on} />}
                </div>

                <h3 className="mt-6 text-xl font-semibold text-[var(--color-baltic-sea-100)] mb-2">{step.title}</h3>
                <p className="text-[var(--color-baltic-sea-400)]">{step.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─── Vignettes ────────────────────────────────────────────────────── */

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
        tone === "accent"
          ? "border-[var(--color-keppel-800)] bg-[var(--color-keppel-950)] text-[var(--color-keppel-300)]"
          : "border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)] text-[var(--color-baltic-sea-300)]"
      }`}
    >
      {children}
    </span>
  )
}

/** Step 1 — a tracking number being provisioned and attached to a campaign. */
function NumberVignette({ on }: { on: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">Tracking number</div>
          <div className="mt-1 font-mono text-base text-[var(--color-baltic-sea-100)]">+1 833 555 0148</div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all duration-500 ${
            on
              ? "border-[var(--color-keppel-700)] bg-[var(--color-keppel-950)] text-[var(--color-keppel-300)] opacity-100"
              : "border-[var(--color-baltic-sea-800)] text-[var(--color-baltic-sea-500)] opacity-60"
          }`}
          style={{ transitionDelay: "500ms" }}
        >
          <Check weight="bold" className="h-2.5 w-2.5" />
          {on ? "Provisioned" : "Pending"}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--color-baltic-sea-400)]">
        <ArrowRight weight="bold" className="h-3 w-3 text-[var(--color-keppel-500)]" />
        <span>attached to</span>
        <Chip tone="accent">medicare-open-enrollment</Chip>
      </div>

      <div
        className="mt-3 flex flex-wrap gap-1.5 transition-all duration-500"
        style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(6px)", transitionDelay: "700ms" }}
      >
        <Chip>TX</Chip>
        <Chip>FL</Chip>
        <Chip>OH</Chip>
        <Chip>09:00–21:00</Chip>
        <Chip>500 / day</Chip>
      </div>
    </div>
  )
}

/** Step 2 — the rule set, each rule switching on in sequence. */
function RulesVignette({ on }: { on: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">Routing rules</div>
        <span className="font-mono text-[10px] text-[var(--color-baltic-sea-500)]">{RULES.length} active</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {RULES.map((rule, i) => (
          <div
            key={rule.key}
            className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)] px-2.5 py-1.5 transition-all duration-500"
            style={{ opacity: on ? 1 : 0.35, transform: on ? "translateX(0)" : "translateX(-6px)", transitionDelay: `${300 + i * 160}ms` }}
          >
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[var(--color-baltic-sea-400)]">{rule.key}</span>
              <span className="text-[var(--color-baltic-sea-100)]">{rule.value}</span>
            </div>
            {/* Toggle */}
            <span
              className={`relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors duration-300 ${
                on ? "bg-[var(--color-keppel-500)]" : "bg-[var(--color-baltic-sea-700)]"
              }`}
              style={{ transitionDelay: `${400 + i * 160}ms` }}
            >
              <span
                className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-baltic-sea-950)] transition-[left] duration-300"
                style={{ left: on ? "calc(100% - 0.75rem)" : "0.125rem", transitionDelay: `${400 + i * 160}ms` }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Step 3 — the call record: duration counts up, qualifies, pays out. */
function ReceiptVignette({ on }: { on: boolean }) {
  const [seconds, setSeconds] = useState(0)
  const target = 252 // 04:12

  useEffect(() => {
    if (!on) return
    const start = performance.now()
    const dur = 1600
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      setSeconds(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const delay = setTimeout(() => {
      raf = requestAnimationFrame(tick)
    }, 400)
    return () => {
      clearTimeout(delay)
      cancelAnimationFrame(raf)
    }
  }, [on])

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0")
  const ss = String(seconds % 60).padStart(2, "0")
  const qualified = seconds >= 60
  const done = seconds >= target

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">Answered by</div>
          <div className="mt-1 text-sm font-medium text-[var(--color-baltic-sea-100)]">Apex Insurance Group</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">Duration</div>
          <div className="mt-1 font-mono text-sm tabular-nums text-[var(--color-baltic-sea-100)]">
            {mm}:{ss}
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div className="mt-3 flex h-6 items-end gap-[3px]">
        {WAVE.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm transition-all duration-500"
            style={{
              height: `${Math.max(12, h * 100)}%`,
              backgroundColor: i / WAVE.length < seconds / target ? "var(--color-keppel-500)" : "var(--color-baltic-sea-800)",
              transitionDelay: `${i * 20}ms`,
            }}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors duration-300 ${
            qualified
              ? "border-[var(--color-keppel-700)] bg-[var(--color-keppel-950)] text-[var(--color-keppel-300)]"
              : "border-[var(--color-baltic-sea-800)] text-[var(--color-baltic-sea-500)]"
          }`}
        >
          <Check weight="bold" className="h-2.5 w-2.5" />
          {qualified ? "Qualified · 60s+" : "Qualifying…"}
        </span>
        <div className="text-right">
          <span className="font-mono text-base tabular-nums text-[var(--color-keppel-400)] transition-opacity duration-300" style={{ opacity: done ? 1 : 0.35 }}>
            $65.00
          </span>
          <span className="ml-1.5 text-[10px] text-[var(--color-baltic-sea-500)]">payout</span>
        </div>
      </div>
    </div>
  )
}

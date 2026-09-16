"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, Phone } from "@phosphor-icons/react/dist/ssr"
import { Logo } from "@/components/brand/logo"
import { ROUTES } from "@/lib/constants"

/**
 * "Launch a campaign" — a config file types itself on the left while the
 * right-hand pane renders the campaign the file describes, field by field,
 * as it's typed. When the file completes, the campaign flips to live and a
 * number is attached. Five configs cycle; the dots in the header jump
 * between them.
 */

const CONFIGS = [
  {
    name: "medicare-open-enrollment",
    vertical: "health",
    payout: "$65.00",
    daily: "500",
    concurrency: "25",
    states: '["TX", "FL", "OH"]',
    number: "+1 833 555 0148",
  },
  {
    name: "auto-insurance-high-intent",
    vertical: "auto",
    payout: "$42.00",
    daily: "600",
    concurrency: "30",
    states: '["CA", "TX", "GA"]',
    number: "+1 844 555 0192",
  },
  {
    name: "roofing-storm-damage",
    vertical: "home",
    payout: "$92.00",
    daily: "250",
    concurrency: "15",
    states: '["FL", "LA", "NC"]',
    number: "+1 855 555 0117",
  },
  {
    name: "mass-tort-intake",
    vertical: "legal",
    payout: "$320.00",
    daily: "100",
    concurrency: "8",
    states: '["*"]',
    number: "+1 866 555 0163",
  },
  {
    name: "debt-relief-consultation",
    vertical: "finance",
    payout: "$58.00",
    daily: "350",
    concurrency: "20",
    states: '["NY", "IL", "PA"]',
    number: "+1 877 555 0129",
  },
]

const VERTICAL_LABEL: Record<string, string> = {
  health: "Health",
  auto: "Auto",
  home: "Home services",
  legal: "Legal",
  finance: "Finance",
}

/** Largest daily cap across configs — scales the cap bar. */
const MAX_DAILY = Math.max(...CONFIGS.map((c) => Number(c.daily)))

export function TerminalDemo() {
  const [configIndex, setConfigIndex] = useState(0)
  const [typedChars, setTypedChars] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const animationRef = useRef<NodeJS.Timeout | null>(null)
  const cycleRef = useRef<NodeJS.Timeout | null>(null)
  const [bulletsVisible, setBulletsVisible] = useState([false, false, false])
  const bulletsSectionRef = useRef<HTMLDivElement>(null)
  const bulletsAnimatedRef = useRef(false)

  const config = CONFIGS[configIndex]

  // Build the full string we're typing
  const fullText = `${config.name}|${config.vertical}|${config.payout}|${config.daily}|${config.concurrency}|${config.states}`
  const totalChars = fullText.length

  // Get displayed value for each field based on typedChars
  const getFieldValue = (fieldIndex: number): string => {
    const parts = fullText.split("|")
    let charsBefore = 0
    for (let i = 0; i < fieldIndex; i++) {
      charsBefore += parts[i].length + 1 // +1 for delimiter
    }
    const fieldStart = charsBefore
    const fieldEnd = charsBefore + parts[fieldIndex].length

    if (typedChars <= fieldStart) return ""
    if (typedChars >= fieldEnd) return parts[fieldIndex]
    return parts[fieldIndex].slice(0, typedChars - fieldStart)
  }

  const getCursorField = (): number => {
    const parts = fullText.split("|")
    let charsBefore = 0
    for (let i = 0; i < parts.length; i++) {
      const fieldEnd = charsBefore + parts[i].length
      if (typedChars <= fieldEnd) return i
      charsBefore = fieldEnd + 1
    }
    return -1
  }

  // Single typing effect
  useEffect(() => {
    if (isComplete) return

    if (typedChars < totalChars) {
      animationRef.current = setTimeout(
        () => {
          setTypedChars((prev) => prev + 1)
        },
        70 + Math.random() * 40,
      )
    } else {
      setIsComplete(true)
    }

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current)
    }
  }, [typedChars, totalChars, isComplete])

  // Cycle to next config after completion
  useEffect(() => {
    if (!isComplete) return

    cycleRef.current = setTimeout(() => {
      setConfigIndex((prev) => (prev + 1) % CONFIGS.length)
      setTypedChars(0)
      setIsComplete(false)
    }, 4000)

    return () => {
      if (cycleRef.current) clearTimeout(cycleRef.current)
    }
  }, [isComplete])

  useEffect(() => {
    if (!bulletsSectionRef.current || bulletsAnimatedRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !bulletsAnimatedRef.current) {
            bulletsAnimatedRef.current = true
            // Stagger the bullet animations
            setTimeout(() => setBulletsVisible((prev) => [true, prev[1], prev[2]]), 0)
            setTimeout(() => setBulletsVisible((prev) => [prev[0], true, prev[2]]), 200)
            setTimeout(() => setBulletsVisible((prev) => [prev[0], prev[1], true]), 400)
          }
        })
      },
      { threshold: 0.3 },
    )

    observer.observe(bulletsSectionRef.current)
    return () => observer.disconnect()
  }, [])

  const cursorField = getCursorField()
  const showCursor = !isComplete

  const renderValue = (fieldIndex: number, isString = true) => {
    const value = getFieldValue(fieldIndex)
    const hasCursor = showCursor && cursorField === fieldIndex
    const colorClass = isString ? "text-[var(--color-keppel-300)]" : "text-[var(--color-keppel-400)]"

    return (
      <span className={colorClass}>
        {isString ? `"${value}"` : value}
        {hasCursor && (
          <span className="inline-block w-[2px] h-[1em] bg-[var(--color-keppel-400)] ml-px animate-pulse" />
        )}
      </span>
    )
  }

  // ── Live preview values, derived from what has been typed so far ──
  const typedName = getFieldValue(0)
  const typedVertical = getFieldValue(1)
  const typedPayout = getFieldValue(2)
  const typedDaily = Number(getFieldValue(3)) || 0
  const typedConcurrency = Number(getFieldValue(4)) || 0
  const typedStates = Array.from(getFieldValue(5).matchAll(/"([A-Z*]{1,2})"/g), (m) => m[1])
  const verticalLabel = VERTICAL_LABEL[typedVertical]

  return (
    <section className="py-24 border-t border-[var(--color-baltic-sea-900)]">
      <div className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">
          {/* Config + live preview - left */}
          <div className="flex-1 min-w-0">
            <div
              className="rounded-2xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)] overflow-hidden"
              style={{ boxShadow: "var(--bento-shadow)" }}
            >
              <div className="flex items-center justify-between border-b border-[var(--color-baltic-sea-800)] px-4 py-3 bg-[var(--color-baltic-sea-950)]/50">
                <div className="flex items-center gap-3">
                  <Logo tone="current" uid="mk-terminal" className="h-4 w-4 text-[var(--color-baltic-sea-500)]" />
                  <span className="text-xs text-[var(--color-baltic-sea-500)] font-mono">campaign.config.ts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {CONFIGS.map((c, i) => (
                    <button
                      key={i}
                      aria-label={`Show ${c.name}`}
                      onClick={() => {
                        if (animationRef.current) clearTimeout(animationRef.current)
                        if (cycleRef.current) clearTimeout(cycleRef.current)
                        setConfigIndex(i)
                        setTypedChars(0)
                        setIsComplete(false)
                      }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === configIndex
                          ? "w-4 bg-[var(--color-keppel-400)]"
                          : "w-1.5 bg-[var(--color-baltic-sea-600)] hover:bg-[var(--color-baltic-sea-500)]"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-[1.15fr_1fr]">
                {/* Code */}
                <div className="flex flex-col p-5 font-mono text-sm overflow-x-auto border-b md:border-b-0 md:border-r border-[var(--color-baltic-sea-800)]">
                  <pre className="text-[var(--color-baltic-sea-400)]">
                    <code>
                      <span className="text-[var(--color-baltic-sea-500)]">{"// Define your campaign"}</span>
                      {"\n"}
                      <span className="text-[var(--color-keppel-400)]">export default</span>{" "}
                      <span className="text-[var(--color-baltic-sea-200)]">defineCampaign</span>
                      {"({"}
                      {"\n"}
                      {"  "}
                      <span className="text-[var(--color-baltic-sea-300)]">name</span>: {renderValue(0)},{"\n"}
                      {"  "}
                      <span className="text-[var(--color-baltic-sea-300)]">vertical</span>: {renderValue(1)},{"\n"}
                      {"  "}
                      <span className="text-[var(--color-baltic-sea-300)]">payout</span>: {renderValue(2)},{"\n"}
                      {"  "}
                      <span className="text-[var(--color-baltic-sea-300)]">caps</span>: {"{"}
                      {"\n"}
                      {"    "}
                      <span className="text-[var(--color-baltic-sea-300)]">daily</span>: {renderValue(3, false)},{"\n"}
                      {"    "}
                      <span className="text-[var(--color-baltic-sea-300)]">concurrency</span>: {renderValue(4, false)},{"\n"}
                      {"  "}
                      {"}"},{"\n"}
                      {"  "}
                      <span className="text-[var(--color-baltic-sea-300)]">states</span>: {renderValue(5, false)},{"\n"}
                      {"})"}
                    </code>
                  </pre>
                  {/* Deploy status line — sits at the bottom of the pane */}
                  <div className="mt-auto flex items-center gap-2 pt-6 text-[11px]">
                    <span className="text-[var(--color-keppel-500)]">→</span>
                    {isComplete ? (
                      <span className="text-[var(--color-keppel-400)] animate-in fade-in duration-300">
                        deployed · routing on {config.number}
                      </span>
                    ) : (
                      <span className="text-[var(--color-baltic-sea-500)]">
                        avortyx deploy --watch
                        <span className="ml-1 inline-block h-3 w-[2px] translate-y-0.5 bg-[var(--color-baltic-sea-500)] animate-pulse" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Live preview */}
                <div className="relative p-5 bg-[var(--color-baltic-sea-950)]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 transition-opacity duration-700"
                    style={{
                      background: "radial-gradient(120% 80% at 100% 0%, var(--color-keppel-500) 0%, transparent 60%)",
                      opacity: isComplete ? 0.14 : 0.05,
                    }}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-baltic-sea-500)]">Campaign</span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors duration-300 ${
                          isComplete
                            ? "border-[var(--color-keppel-500)] bg-[var(--color-keppel-500)] text-[var(--color-keppel-950)]"
                            : "border-[var(--color-baltic-sea-800)] text-[var(--color-baltic-sea-400)]"
                        }`}
                      >
                        {isComplete ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-keppel-950)]" />
                            Live
                          </>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-baltic-sea-500)] animate-pulse" />
                            Drafting
                          </>
                        )}
                      </span>
                    </div>

                    {/* Name + vertical */}
                    <div className="mt-2 min-h-[1.75rem] flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-[var(--color-baltic-sea-100)] break-all">
                        {typedName || <span className="text-[var(--color-baltic-sea-600)]">untitled</span>}
                      </span>
                      {verticalLabel && (
                        <span className="rounded-md border border-[var(--color-keppel-800)] bg-[var(--color-keppel-950)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-keppel-300)] animate-in fade-in zoom-in-95 duration-300">
                          {verticalLabel}
                        </span>
                      )}
                    </div>

                    {/* Payout */}
                    <div className="mt-4 flex items-baseline gap-2">
                      <span
                        className={`font-mono text-2xl font-semibold tabular-nums transition-colors duration-300 ${
                          typedPayout ? "text-[var(--color-keppel-400)]" : "text-[var(--color-baltic-sea-700)]"
                        }`}
                      >
                        {typedPayout || "$—"}
                      </span>
                      <span className="text-[11px] text-[var(--color-baltic-sea-500)]">per qualified call</span>
                    </div>

                    {/* Caps */}
                    <div className="mt-4 space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="uppercase tracking-[0.14em] text-[var(--color-baltic-sea-500)]">Daily cap</span>
                          <span className="font-mono tabular-nums text-[var(--color-baltic-sea-200)]">
                            {typedDaily || "—"}
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--color-baltic-sea-800)]">
                          <div
                            className="h-full rounded-full bg-[var(--color-keppel-500)] transition-[width] duration-300"
                            style={{ width: `${(typedDaily / MAX_DAILY) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="uppercase tracking-[0.14em] text-[var(--color-baltic-sea-500)]">Concurrency</span>
                          <span className="font-mono tabular-nums text-[var(--color-baltic-sea-200)]">
                            {typedConcurrency || "—"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex gap-[3px]">
                          {Array.from({ length: 15 }, (_, i) => (
                            <span
                              key={i}
                              className="h-1.5 flex-1 rounded-sm transition-colors duration-200"
                              style={{
                                backgroundColor:
                                  i < Math.ceil((typedConcurrency / 30) * 15)
                                    ? "var(--color-keppel-500)"
                                    : "var(--color-baltic-sea-800)",
                                transitionDelay: `${i * 15}ms`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* States */}
                    <div className="mt-4">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-baltic-sea-500)]">States</div>
                      <div className="mt-1.5 flex min-h-[1.375rem] flex-wrap gap-1.5">
                        {typedStates.length === 0 && (
                          <span className="text-[11px] text-[var(--color-baltic-sea-600)]">—</span>
                        )}
                        {typedStates.map((st) => (
                          <span
                            key={st}
                            className="rounded-md border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-baltic-sea-200)] animate-in fade-in zoom-in-95 duration-200"
                          >
                            {st === "*" ? "All states" : st}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Number attached on completion */}
                    <div
                      className="mt-4 flex items-center gap-2 border-t border-[var(--color-baltic-sea-800)] pt-3 text-[11px] transition-all duration-500"
                      style={{ opacity: isComplete ? 1 : 0.35 }}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-300 ${
                          isComplete
                            ? "bg-[var(--color-keppel-500)] text-[var(--color-keppel-950)]"
                            : "bg-[var(--color-baltic-sea-800)] text-[var(--color-baltic-sea-500)]"
                        }`}
                      >
                        {isComplete ? <Check weight="bold" className="h-3 w-3" /> : <Phone weight="fill" className="h-2.5 w-2.5" />}
                      </span>
                      <span className="text-[var(--color-baltic-sea-400)]">{isComplete ? "Number attached" : "Attaching number"}</span>
                      <span className="ml-auto font-mono text-[var(--color-baltic-sea-200)]">{config.number}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA content - right */}
          <div className="lg:max-w-md lg:shrink-0">
            <span className="text-sm font-medium text-[var(--color-keppel-400)] uppercase tracking-wider">
              Get started
            </span>
            <h2 className="mt-3 text-3xl font-bold text-[var(--color-baltic-sea-100)] md:text-4xl">
              Launch a campaign in under 60 seconds
            </h2>
            <p className="mt-4 text-lg text-[var(--color-baltic-sea-400)]">
              Define the campaign, attach a number, and calls start routing. No carriers to wire up, no
              spreadsheets, no waiting on an integration.
            </p>

            <div ref={bulletsSectionRef} className="mt-8 space-y-4">
              {["Only pay for calls that reach a buyer", "Numbers, routing and payouts in one workspace", "Port your existing numbers in one click"].map(
                (text, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 transition-all duration-500 ease-out"
                    style={{
                      opacity: bulletsVisible[index] ? 1 : 0,
                      transform: bulletsVisible[index] ? "translateX(0)" : "translateX(40px)",
                    }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-keppel-950)] border border-[var(--color-keppel-800)]">
                      <Check weight="bold" className="h-4 w-4 text-[var(--color-keppel-400)]" />
                    </div>
                    <span className="text-[var(--color-baltic-sea-300)]">{text}</span>
                  </div>
                ),
              )}
            </div>

            <div className="mt-10">
              <Button
                asChild
                size="lg"
                className="bg-[var(--color-keppel-400)] text-[var(--color-keppel-950)] hover:bg-[var(--color-keppel-300)] rounded-full h-12 px-6"
              >
                <Link href={ROUTES.signup}>
                  Start routing
                  <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

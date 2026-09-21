"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "@phosphor-icons/react"
import { useCallback, useRef, useState } from "react"
import { ROUTES } from "@/lib/constants"
import { PORTAL_CTA, PUBLIC_PORTAL_LINKS } from "@/lib/portal-access"
import { RoutingEngine } from "./routing-engine"

/** Background grid cells that light up as the routing engine advances —
 *  keyed by stage: screening, scoring, bidding. Cumulative. */
const GRID_ACTIVATION_MAP: Record<number, number[]> = {
  1: [5, 23, 47, 68, 92, 115, 138, 167, 189, 215],
  2: [12, 31, 56, 78, 103, 127, 152, 178, 201, 223, 8, 45, 89, 134, 176],
  3: [3, 19, 42, 65, 88, 112, 139, 163, 186, 209, 234, 17, 54, 97, 143, 188, 211, 237],
}

export function HeroSection() {
  const [activeCells, setActiveCells] = useState<Set<number>>(new Set())
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // The engine reports each stage; the grid behind it lights up in step
  // and clears when a new call comes in.
  const onPhase = useCallback((phaseIndex: number) => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    if (phaseIndex < 0) {
      setActiveCells(new Set())
      return
    }
    const cells = GRID_ACTIVATION_MAP[phaseIndex] || []
    cells.forEach((cellIndex, i) => {
      timeoutsRef.current.push(
        setTimeout(() => {
          setActiveCells((prev) => new Set([...prev, cellIndex]))
        }, i * 60),
      )
    })
  }, [])

  return (
    <section className="relative pb-12 overflow-hidden">
      <div className="absolute inset-0 -top-20 -left-20 -right-20 overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-20 gap-3 sm:gap-4 lg:gap-5 p-4 opacity-30">
          {[...Array(240)].map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-sm transition-all duration-700 ${
                activeCells.has(i)
                  ? "bg-[var(--color-keppel-500)] shadow-[0_0_30px_var(--color-keppel-500)]"
                  : "border border-[var(--color-baltic-sea-800)] bg-transparent"
              }`}
              style={{
                opacity: activeCells.has(i) ? 0.8 : 0.4,
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
        {/* Fills a normal viewport, but is capped so a tall or zoomed-out
            window doesn't pad the hero with empty canvas above and below. */}
        <div className="flex min-h-[min(100svh,54rem)] flex-col lg:flex-row lg:items-center lg:justify-between gap-12 lg:gap-20 pt-24 lg:pt-20">
          {/* Left column - text content */}
          <div className="lg:max-w-xl flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-keppel-700)] bg-[var(--color-keppel-950)] px-3 py-1 text-xs text-[var(--color-keppel-300)] mb-8 w-fit">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-keppel-400)]" />
              Live intent scoring now available
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--color-baltic-sea-50)] leading-[1.1]">
              Turn every
              <br />
              <span className="text-[var(--color-keppel-400)]">inbound call</span>
              <br />
              into revenue
            </h1>

            <p className="mt-6 text-lg text-[var(--color-baltic-sea-400)] max-w-md leading-relaxed">
              Avortyx scores every call the moment it rings and routes it to the buyer most likely to close.
              Compliance, monitoring and payouts run underneath — automatically.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-[var(--color-keppel-500)] hover:bg-[var(--color-keppel-600)] text-[var(--color-keppel-950)] font-semibold px-6"
              >
                <Link href={PUBLIC_PORTAL_LINKS ? ROUTES.signup : PORTAL_CTA.href}>
                  {PUBLIC_PORTAL_LINKS ? "Start routing" : PORTAL_CTA.label}
                  <ArrowRight className="ml-2 h-4 w-4" weight="bold" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="text-[var(--color-baltic-sea-300)] hover:text-[var(--color-baltic-sea-100)] hover:bg-[var(--color-baltic-sea-900)]"
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
          </div>

          {/* Right column - live routing engine */}
          <div className="w-full lg:flex-1 lg:max-w-2xl flex flex-col items-center justify-center">
            <RoutingEngine onPhase={onPhase} />
          </div>
        </div>
      </div>
    </section>
  )
}

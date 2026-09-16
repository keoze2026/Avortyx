"use client"

import { useEffect, useRef, useState } from "react"

const TESTIMONIALS_ROW_1 = [
  {
    quote:
      "We moved 40 campaigns off a legacy tracker in a weekend. Time-to-connect dropped from 9 seconds to under 2, and our connect rate followed.",
    author: "Sarah Chen",
    role: "Head of Media Buying",
    company: "Northaven Leads",
    avatar: "SC",
  },
  {
    quote:
      "The live monitor alone is worth it. For the first time we can see what our buyers are actually doing with the calls we send them.",
    author: "Marcus Webb",
    role: "COO",
    company: "Ringwell",
    avatar: "MW",
  },
  {
    quote:
      "Avortyx lets us focus on traffic instead of plumbing. Setting up a new buyer went from a two-day ticket to a ten-minute form.",
    author: "Priya Sharma",
    role: "Operations Lead",
    company: "Calibr Media",
    avatar: "PS",
  },
  {
    quote: "Finally, a router that actually understands intent. The scoring pays for itself on the first week of health traffic.",
    author: "James Liu",
    role: "Founder",
    company: "Tenpoint Performance",
    avatar: "JL",
  },
  {
    quote: "We went from six spreadsheets and a carrier portal to one campaign config. Our publishers noticed the payout accuracy immediately.",
    author: "Elena Rodriguez",
    role: "VP Partnerships",
    company: "Meridian Call Network",
    avatar: "ER",
  },
]

const TESTIMONIALS_ROW_2 = [
  {
    quote: "Our buyers fill caps 3x faster because calls hit the right desk on the first ring. Nothing else we tried came close.",
    author: "David Park",
    role: "VP Growth",
    company: "Halcyon Insurance Leads",
    avatar: "DP",
  },
  {
    quote: "The visual routing rules mean our whole team can ship a geo change without waiting on an engineer.",
    author: "Aisha Patel",
    role: "Campaign Manager",
    company: "Bellcast",
    avatar: "AP",
  },
  {
    quote: "TCPA screening on every attempt cut our compliance exceptions to zero. Our legal team stopped asking for weekly exports.",
    author: "Michael Torres",
    role: "Compliance Director",
    company: "Signalfront",
    avatar: "MT",
  },
  {
    quote: "Automated payouts closed the month in a day instead of a week. Our publishers get paid on time, every time.",
    author: "Rachel Kim",
    role: "Finance Lead",
    company: "Ringwell",
    avatar: "RK",
  },
  {
    quote: "From first number to paid call in an afternoon. Avortyx changed how we launch verticals.",
    author: "Tom Anderson",
    role: "CEO",
    company: "Tenpoint Performance",
    avatar: "TA",
  },
]

function TestimonialCard({
  testimonial,
  onMouseEnter,
  onMouseLeave,
}: {
  testimonial: (typeof TESTIMONIALS_ROW_1)[0]
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex-shrink-0 w-[350px] md:w-[400px] rounded-2xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)] p-6 hover:border-[var(--color-keppel-800)] transition-colors duration-300"
      style={{ boxShadow: "var(--bento-shadow)" }}
    >
      <p className="text-[var(--color-baltic-sea-300)] leading-relaxed text-sm">{testimonial.quote}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--color-keppel-600)] to-[var(--color-keppel-800)] flex items-center justify-center text-xs font-bold text-[var(--color-keppel-100)]">
          {testimonial.avatar}
        </div>
        <div>
          <div className="font-medium text-[var(--color-baltic-sea-200)] text-sm">{testimonial.author}</div>
          <div className="text-xs text-[var(--color-baltic-sea-500)]">
            {testimonial.role}, {testimonial.company}
          </div>
        </div>
      </div>
    </div>
  )
}

function MarqueeRow({
  testimonials,
  direction = "left",
  speed = 30,
}: {
  testimonials: typeof TESTIMONIALS_ROW_1
  direction?: "left" | "right"
  speed?: number
}) {
  const [isPaused, setIsPaused] = useState(false)
  const duplicated = [...testimonials, ...testimonials]

  return (
    <div className="relative flex overflow-hidden">
      {/* Gradient masks on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-[var(--background)] to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-[var(--background)] to-transparent pointer-events-none" />

      <div
        className="flex gap-6 py-4"
        style={{
          animation: `scroll-${direction} ${speed}s linear infinite`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      >
        {duplicated.map((testimonial, i) => (
          <TestimonialCard
            key={`${testimonial.author}-${i}`}
            testimonial={testimonial}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          />
        ))}
      </div>
    </div>
  )
}

export function Testimonials() {
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

  return (
    <section ref={ref} className="py-24 border-t border-[var(--color-baltic-sea-900)] overflow-hidden">
      {/* Section header */}
      <div className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
        <div
          className={`text-center max-w-2xl mx-auto mb-12 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-12 blur-sm"}`}
        >
          <span className="text-sm font-medium text-[var(--color-keppel-400)] uppercase tracking-wider">
            Testimonials
          </span>
          <h2 className="mt-3 text-3xl font-bold text-[var(--color-baltic-sea-100)] md:text-4xl text-balance">
            Loved by performance marketers
          </h2>
        </div>
      </div>

      <div
        className={`space-y-6 transition-all duration-1000 ${isVisible ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDelay: "300ms" }}
      >
        <MarqueeRow testimonials={TESTIMONIALS_ROW_1} direction="left" speed={40} />
        <MarqueeRow testimonials={TESTIMONIALS_ROW_2} direction="right" speed={45} />
      </div>
    </section>
  )
}

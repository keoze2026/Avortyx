"use client"

import { useEffect, useRef, useState } from "react"
import {
  Broadcast,
  Compass,
  Hexagon,
  Lighthouse,
  Mountains,
  Pulse,
  Waveform,
  WifiHigh,
} from "@phosphor-icons/react/dist/ssr"

const LOGOS = [
  { name: "Ringwell", Icon: Broadcast },
  { name: "Northaven", Icon: Compass },
  { name: "Calibr", Icon: Waveform },
  { name: "Tenpoint", Icon: Hexagon },
  { name: "Meridian", Icon: Mountains },
  { name: "Halcyon", Icon: Lighthouse },
  { name: "Bellcast", Icon: WifiHigh },
  { name: "Signalfront", Icon: Pulse },
]

export function LogoCloud() {
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
    <section ref={ref} className="py-16 border-t border-[var(--color-baltic-sea-900)] overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
        <p
          className={`text-center text-sm text-[var(--color-baltic-sea-500)] mb-10 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-4 blur-sm"}`}
        >
          Trusted by performance networks at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          {LOGOS.map((logo, i) => (
            <div
              key={logo.name}
              className={`flex items-center gap-3 text-[var(--color-baltic-sea-400)] transition-all duration-700 ease-out ${
                isVisible
                  ? "opacity-100 translate-x-0 scale-100"
                  : `opacity-0 ${i % 2 === 0 ? "-translate-x-8" : "translate-x-8"} scale-90`
              }`}
              style={{ transitionDelay: `${100 + i * 80}ms` }}
            >
              <logo.Icon weight="fill" className="w-5 h-5" />
              <span className="font-medium">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

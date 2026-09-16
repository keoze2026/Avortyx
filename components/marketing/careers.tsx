"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Buildings,
  ChartLineUp,
  Code,
  Compass,
  GlobeHemisphereWest,
  Headset,
  HeartStraight,
  Lightning,
  MapPin,
  Rocket,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"

import { Button } from "@/components/ui/button"
import { BRAND, ROUTES } from "@/lib/constants"

/**
 * Careers — the same design language as the landing page (eyebrow + bold
 * heading, bento cards, keppel accents, reveal-on-scroll) applied to a
 * hiring page: who we are, what we value, the open roles, and how to apply.
 *
 * Roles are data (see OPEN_ROLES) so the list is edited in one place; each
 * "Apply" opens a pre-addressed email until an ATS is wired up.
 */

interface Role {
  title: string
  team: string
  location: string
  type: string
  summary: string
}

const OPEN_ROLES: Role[] = [
  {
    title: "Senior Backend Engineer, Telephony",
    team: "Engineering",
    location: "Remote · US / EU",
    type: "Full-time",
    summary: "Own the routing core: SIP, carrier integrations and the sub-second decision path every call takes.",
  },
  {
    title: "Frontend Engineer, Product",
    team: "Engineering",
    location: "Remote · US / EU",
    type: "Full-time",
    summary: "Build the live monitor, reports and campaign tooling operators live in all day — Next.js, TypeScript, real-time data.",
  },
  {
    title: "Machine Learning Engineer, Intent Scoring",
    team: "Data",
    location: "Remote · US",
    type: "Full-time",
    summary: "Turn live call signals into intent scores buyers bid on. Feature pipelines, online inference, honest evaluation.",
  },
  {
    title: "Solutions Engineer",
    team: "Customer",
    location: "Remote · US",
    type: "Full-time",
    summary: "Get networks live: number porting, routing design, compliance setup and integrations, side by side with customers.",
  },
  {
    title: "Account Executive, Pay-Per-Call",
    team: "Sales",
    location: "Remote · US",
    type: "Full-time",
    summary: "Bring Avortyx to performance networks and buyers who are tired of stitching trackers to carriers to spreadsheets.",
  },
]

const VALUES: Array<{ icon: typeof Lightning; title: string; text: string }> = [
  {
    icon: Lightning,
    title: "Decide in the first ring",
    text: "We ship in small, fast loops. A call can't wait, and neither should a fix.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance is a feature",
    text: "TCPA, DNC and consent aren't paperwork — they're product. We build them in, never bolt them on.",
  },
  {
    icon: UsersThree,
    title: "Operators first",
    text: "Every screen is designed with the people running campaigns at 2am, not for a slide deck.",
  },
  {
    icon: Compass,
    title: "Own the outcome",
    text: "Small teams, real scope. You'll carry problems from customer call to production and back.",
  },
]

const BENEFITS: Array<{ icon: typeof Lightning; text: string }> = [
  { icon: GlobeHemisphereWest, text: "Remote-first across US and EU time zones" },
  { icon: HeartStraight, text: "Health, dental and vision fully covered" },
  { icon: ChartLineUp, text: "Meaningful equity in a growing company" },
  { icon: Rocket, text: "Hardware and home-office budget on day one" },
  { icon: Buildings, text: "Twice-yearly team on-sites" },
  { icon: Headset, text: "Learning stipend and conference travel" },
]

const TEAM_ICON: Record<string, typeof Lightning> = {
  Engineering: Code,
  Data: ChartLineUp,
  Customer: Headset,
  Sales: Buildings,
}

/** IntersectionObserver reveal, matching the landing-page sections. */
function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-sm font-medium text-[var(--color-keppel-400)] uppercase tracking-wider">{children}</span>
  )
}

const applyHref = (role?: string) =>
  `mailto:${BRAND.email}?subject=${encodeURIComponent(role ? `Application: ${role}` : "Open application")}`

export function CareersPage() {
  const hero = useReveal<HTMLDivElement>(0.1)
  const values = useReveal<HTMLDivElement>()
  const roles = useReveal<HTMLDivElement>()
  const benefits = useReveal<HTMLDivElement>()

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-36 pb-20 lg:pt-44 lg:pb-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, color-mix(in oklch, var(--color-keppel-500) 22%, transparent) 0%, transparent 70%)",
          }}
        />
        <div
          ref={hero.ref}
          className={`relative mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12 transition-all duration-700 ${
            hero.visible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-8 blur-sm"
          }`}
        >
          <div className="max-w-3xl">
            <Eyebrow>Careers</Eyebrow>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--color-baltic-sea-50)] leading-[1.08] text-balance">
              Build the routing layer for{" "}
              <span className="text-[var(--color-keppel-400)]">every inbound call</span>
            </h1>
            <p className="mt-6 text-lg text-[var(--color-baltic-sea-400)] max-w-2xl leading-relaxed">
              Avortyx scores, routes and settles calls for pay-per-call networks in the time it takes a phone to
              ring once. We're a small team of engineers, operators and sellers who like hard real-time problems
              and customers who notice when they're solved.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-[var(--color-keppel-400)] text-[var(--color-keppel-950)] hover:bg-[var(--color-keppel-300)] rounded-full h-12 px-6 font-semibold"
              >
                <a href="#open-roles">
                  See open roles
                  <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-[var(--color-baltic-sea-300)] hover:text-[var(--color-baltic-sea-100)] hover:bg-[var(--color-baltic-sea-900)] rounded-full h-12 px-6"
              >
                <a href={applyHref()}>Send an open application</a>
              </Button>
            </div>
          </div>

          {/* Quick facts */}
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: String(OPEN_ROLES.length), label: "Open roles" },
              { value: "Remote", label: "US & EU time zones" },
              { value: "< 1s", label: "Our routing budget" },
              { value: "2018", label: "Founded" },
            ].map((f, i) => (
              <div
                key={f.label}
                className={`rounded-xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)] px-5 py-4 transition-all duration-700 ${
                  hero.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${200 + i * 80}ms`, boxShadow: "var(--bento-shadow)" }}
              >
                <div className="font-mono text-2xl font-semibold tabular-nums text-[var(--color-baltic-sea-50)]">
                  {f.value}
                </div>
                <div className="mt-1 text-xs text-[var(--color-baltic-sea-500)]">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────────────── */}
      <section className="py-24 border-t border-[var(--color-baltic-sea-900)]">
        <div ref={values.ref} className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
          <div
            className={`max-w-2xl transition-all duration-700 ${
              values.visible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-8 blur-sm"
            }`}
          >
            <Eyebrow>How we work</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold text-[var(--color-baltic-sea-100)] md:text-4xl text-balance">
              Small team, real-time stakes
            </h2>
            <p className="mt-4 text-lg text-[var(--color-baltic-sea-400)]">
              Every call that rings through Avortyx is someone's revenue. That shapes how we build and who we hire.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <div
                key={v.title}
                className={`rounded-2xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)] p-6 transition-all duration-700 hover:border-[var(--color-keppel-800)] ${
                  values.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${150 + i * 100}ms`, boxShadow: "var(--bento-shadow)" }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-keppel-800)] bg-[var(--color-keppel-950)]">
                  <v.icon weight="duotone" className="h-5 w-5 text-[var(--color-keppel-400)]" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-[var(--color-baltic-sea-100)]">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-baltic-sea-400)]">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Open roles ───────────────────────────────────────────── */}
      <section id="open-roles" className="py-24 border-t border-[var(--color-baltic-sea-900)] scroll-mt-24">
        <div ref={roles.ref} className="mx-auto max-w-[1100px] px-2.5 sm:px-6 lg:px-12">
          <div
            className={`text-center max-w-2xl mx-auto transition-all duration-700 ${
              roles.visible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-8 blur-sm"
            }`}
          >
            <Eyebrow>Open roles</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold text-[var(--color-baltic-sea-100)] md:text-4xl text-balance">
              Where we're hiring now
            </h2>
            <p className="mt-4 text-lg text-[var(--color-baltic-sea-400)]">
              Every role is remote. Interviews are four conversations, not a gauntlet — we'll tell you where you
              stand after each one.
            </p>
          </div>

          <div
            className={`mt-12 overflow-hidden rounded-2xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)] transition-all duration-700 ${
              roles.visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.98]"
            }`}
            style={{ boxShadow: "var(--bento-shadow)", transitionDelay: "150ms" }}
          >
            {OPEN_ROLES.map((role, i) => {
              const Icon = TEAM_ICON[role.team] ?? Code
              return (
                <a
                  key={role.title}
                  href={applyHref(role.title)}
                  className={`group flex flex-col gap-4 border-b border-[var(--color-baltic-sea-800)]/60 p-5 last:border-b-0 transition-all duration-500 hover:bg-[var(--color-baltic-sea-900)]/50 sm:flex-row sm:items-center sm:gap-6 lg:p-6 ${
                    roles.visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"
                  }`}
                  style={{ transitionDelay: `${250 + i * 70}ms` }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-900)] text-[var(--color-baltic-sea-400)] transition-colors group-hover:border-[var(--color-keppel-800)] group-hover:text-[var(--color-keppel-400)]">
                    <Icon weight="duotone" className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-base font-semibold text-[var(--color-baltic-sea-100)]">{role.title}</h3>
                      <span className="rounded-md border border-[var(--color-keppel-800)] bg-[var(--color-keppel-950)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-keppel-300)]">
                        {role.team}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-baltic-sea-400)]">{role.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-baltic-sea-500)]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin weight="bold" className="h-3 w-3" />
                        {role.location}
                      </span>
                      <span>{role.type}</span>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-keppel-400)] transition-transform group-hover:translate-x-0.5">
                    Apply
                    <ArrowUpRight weight="bold" className="h-4 w-4" />
                  </span>
                </a>
              )
            })}
          </div>

          <p
            className={`mt-6 text-center text-sm text-[var(--color-baltic-sea-500)] transition-opacity duration-700 ${
              roles.visible ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: "700ms" }}
          >
            Nothing that fits?{" "}
            <a href={applyHref()} className="text-[var(--color-keppel-400)] hover:text-[var(--color-keppel-300)]">
              Tell us what you'd build here
            </a>{" "}
            — we read every note.
          </p>
        </div>
      </section>

      {/* ── Benefits + CTA ───────────────────────────────────────── */}
      <section className="py-24 border-t border-[var(--color-baltic-sea-900)]">
        <div ref={benefits.ref} className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-20">
            <div
              className={`transition-all duration-700 ${
                benefits.visible ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-8 blur-sm"
              }`}
            >
              <Eyebrow>Benefits</Eyebrow>
              <h2 className="mt-3 text-3xl font-bold text-[var(--color-baltic-sea-100)] md:text-4xl text-balance">
                Set up to do your best work
              </h2>
              <p className="mt-4 text-lg text-[var(--color-baltic-sea-400)]">
                We'd rather you spend your energy on the product than on logistics.
              </p>
              <div className="mt-8">
                <Button
                  asChild
                  size="lg"
                  className="bg-[var(--color-keppel-400)] text-[var(--color-keppel-950)] hover:bg-[var(--color-keppel-300)] rounded-full h-12 px-6 font-semibold"
                >
                  <a href="#open-roles">
                    Browse open roles
                    <ArrowRight weight="bold" className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {BENEFITS.map((b, i) => (
                <li
                  key={b.text}
                  className={`flex items-center gap-3 rounded-xl border border-[var(--color-baltic-sea-800)] bg-[var(--color-baltic-sea-950)] px-4 py-3.5 transition-all duration-500 ${
                    benefits.visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"
                  }`}
                  style={{ transitionDelay: `${200 + i * 70}ms` }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-keppel-950)] border border-[var(--color-keppel-800)]">
                    <b.icon weight="duotone" className="h-4 w-4 text-[var(--color-keppel-400)]" />
                  </span>
                  <span className="text-sm text-[var(--color-baltic-sea-200)]">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-16 text-center text-xs text-[var(--color-baltic-sea-600)]">
            Avortyx is an equal-opportunity employer.{" "}
            <Link href={ROUTES.home} className="hover:text-[var(--color-baltic-sea-400)]">
              Back to the product
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}

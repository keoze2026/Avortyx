"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Lightning } from "@phosphor-icons/react/dist/ssr"
import { Logo } from "@/components/brand/logo"
import { BRAND_GRADIENT_TEXT } from "@/components/brand/wordmark"
import { BRAND, ROUTES } from "@/lib/constants"
import { PORTAL_CTA, PUBLIC_PORTAL_LINKS } from "@/lib/portal-access"

/** Section anchors are rooted at "/" so they work from any marketing page. */
const NAV: Array<{ label: string; href: string }> = [
  { label: "Product", href: "/#product" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Careers", href: ROUTES.careers },
]

const NAV_ACTIVE = "px-4 py-1.5 text-sm text-[var(--color-baltic-sea-100)] rounded-full bg-[var(--color-baltic-sea-800)]"
const NAV_IDLE =
  "px-4 py-1.5 text-sm text-[var(--color-baltic-sea-400)] hover:text-[var(--color-baltic-sea-100)] transition-colors"

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  // The home page highlights "Product" (as the template does); any other
  // marketing page highlights its own entry.
  const activeHref = pathname === ROUTES.home ? "/#product" : pathname

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.5)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-2.5 sm:px-6 lg:px-12">
          {/* Brand lock-up — the Avortyx mark in its blue ramp with the name
              beside it (same as the app and the auth pages); the name folds
              away on scroll and the mark stays. The template's white tile
              around the logo is gone: the mark carries its own glow. */}
          <Link href={ROUTES.home} className="group flex items-center gap-2.5" aria-label={BRAND.name}>
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full opacity-70 blur-md transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: "var(--vortyx-glow)" }}
              />
              <Logo tone="brand" uid="mk-header" className="relative h-9 w-9 drop-shadow-[0_0_12px_var(--vortyx-glow)]" />
            </span>
            <span
              className={`
                text-xl font-semibold tracking-tight
                transition-all duration-500 overflow-hidden whitespace-nowrap
                ${scrolled ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"}
              `}
              style={BRAND_GRADIENT_TEXT}
            >
              {BRAND.name}
            </span>
          </Link>

          {/* Navigation - only shows at top, replaced by floating CTA when scrolled */}
          <nav
            className={`
              hidden md:flex items-center gap-1 rounded-full border border-[var(--color-baltic-sea-800)]
              bg-[var(--color-baltic-sea-900)]/80 backdrop-blur-md px-2 py-1.5
              transition-all duration-500 ease-out
              ${scrolled ? "opacity-0 pointer-events-none" : "opacity-100"}
              absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2
            `}
          >
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={item.href === activeHref ? NAV_ACTIVE : NAV_IDLE}>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Actions - hidden once scrolled (the floating CTA takes over) */}
          <div className="flex items-center gap-4">
            {/* Sign in only when portal links are public — otherwise the
                public site gives no hint that a portal exists. */}
            {PUBLIC_PORTAL_LINKS && (
              <Link
                href={ROUTES.login}
                className={`
                  hidden text-sm text-[var(--color-baltic-sea-400)] hover:text-[var(--color-baltic-sea-100)] transition-all duration-500 md:block
                  ${scrolled ? "opacity-0 pointer-events-none" : "opacity-100"}
                `}
              >
                Sign in
              </Link>
            )}
            <Button
              asChild
              className={`
                hidden md:flex bg-[var(--color-keppel-400)] text-[var(--color-keppel-950)] hover:bg-[var(--color-keppel-300)]
                rounded-full px-5 py-2.5 h-auto text-sm
                transition-all duration-500
                ${scrolled ? "opacity-0 pointer-events-none" : "opacity-100"}
              `}
            >
              <Link href={PORTAL_CTA.href}>
                <Lightning weight="fill" className="mr-1.5 h-4 w-4" />
                {PORTAL_CTA.label}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Floating CTA once the hero has scrolled past. Sits just left of the
          AI chat button, which owns the bottom-right corner. */}
      <div
        className={`
          fixed z-50 bottom-6 right-24 lg:right-28
          transition-all duration-500 ease-out
          ${scrolled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
        `}
      >
        <Button
          asChild
          className="bg-[var(--color-keppel-400)] text-[var(--color-keppel-950)] hover:bg-[var(--color-keppel-300)]
            rounded-full px-6 py-3 h-auto text-sm shadow-lg shadow-[var(--color-keppel-400)]/20"
        >
          <Link href={PORTAL_CTA.href}>
            <Lightning weight="fill" className="mr-1.5 h-4 w-4" />
            {PORTAL_CTA.label}
          </Link>
        </Button>
      </div>
    </>
  )
}

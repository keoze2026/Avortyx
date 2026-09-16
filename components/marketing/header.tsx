"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Lightning } from "@phosphor-icons/react/dist/ssr"
import { Logo } from "@/components/brand/logo"
import { BRAND, ROUTES } from "@/lib/constants"

export function Header() {
  const [scrolled, setScrolled] = useState(false)

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
          {/* Logo - always stays at top */}
          <Link href={ROUTES.home} className="flex items-center gap-3" aria-label={BRAND.name}>
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-baltic-sea-100)]">
                <Logo tone="dark" uid="mk-header" className="h-5 w-5" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-baltic-sea-950)] bg-[var(--color-keppel-400)]" />
            </div>
            <span
              className={`
                text-xl font-semibold tracking-tight text-[var(--color-baltic-sea-50)]
                transition-all duration-500 overflow-hidden whitespace-nowrap
                ${scrolled ? "max-w-0 opacity-0" : "max-w-[100px] opacity-100"}
              `}
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
            <a
              href="#product"
              className="px-4 py-1.5 text-sm text-[var(--color-baltic-sea-100)] rounded-full bg-[var(--color-baltic-sea-800)]"
            >
              Product
            </a>
            <a
              href="#how-it-works"
              className="px-4 py-1.5 text-sm text-[var(--color-baltic-sea-400)] hover:text-[var(--color-baltic-sea-100)] transition-colors"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="px-4 py-1.5 text-sm text-[var(--color-baltic-sea-400)] hover:text-[var(--color-baltic-sea-100)] transition-colors"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="px-4 py-1.5 text-sm text-[var(--color-baltic-sea-400)] hover:text-[var(--color-baltic-sea-100)] transition-colors"
            >
              FAQ
            </a>
          </nav>

          {/* Actions - hidden once scrolled (the floating CTA takes over) */}
          <div className="flex items-center gap-4">
            <Link
              href={ROUTES.login}
              className={`
                hidden text-sm text-[var(--color-baltic-sea-400)] hover:text-[var(--color-baltic-sea-100)] transition-all duration-500 md:block
                ${scrolled ? "opacity-0 pointer-events-none" : "opacity-100"}
              `}
            >
              Sign in
            </Link>
            <Button
              asChild
              className={`
                hidden md:flex bg-[var(--color-keppel-400)] text-[var(--color-keppel-950)] hover:bg-[var(--color-keppel-300)]
                rounded-full px-5 py-2.5 h-auto text-sm
                transition-all duration-500
                ${scrolled ? "opacity-0 pointer-events-none" : "opacity-100"}
              `}
            >
              <Link href={ROUTES.signup}>
                <Lightning weight="fill" className="mr-1.5 h-4 w-4" />
                Get started
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
          <Link href={ROUTES.signup}>
            <Lightning weight="fill" className="mr-1.5 h-4 w-4" />
            Get started
          </Link>
        </Button>
      </div>
    </>
  )
}

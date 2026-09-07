"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { ROUTES } from "@/lib/constants";
import { ThemeColorSwitcher } from "@/components/marketing/theme-color-switcher";

const NAV_LINKS = [
  { href: "#routing", label: "Routing" },
  { href: "#compliance", label: "Compliance" },
  { href: "#platform", label: "Platform" },
  { href: "#developers", label: "Developers" },
];

const HEADER_H = 64;

export function Navbar() {
  /**
   * The header floats transparently over the dark hero and turns solid once
   * the hero has scrolled past. Pages without a `#hero` element start solid.
   */
  const [overHero, setOverHero] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) {
      setOverHero(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setOverHero(entry.isIntersecting),
      { rootMargin: `-${HEADER_H}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  // An open drawer always needs an opaque backdrop to stay legible.
  const solid = !overHero || open;

  const linkColor = solid ? "var(--m-fg-2)" : "rgba(255,255,255,0.74)";
  const linkHover = solid ? "var(--m-fg)" : "#FFFFFF";
  const linkHoverBg = solid ? "var(--m-bg-alt)" : "rgba(255,255,255,0.10)";

  return (
    <header
      style={{
        // Fixed, not sticky — sticky reserves height in flow, which would park
        // the bar above the hero instead of over it.
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: solid ? "rgba(255,255,255,0.72)" : "rgba(12,19,16,0.55)",
        backdropFilter: "saturate(180%) blur(14px)",
        WebkitBackdropFilter: "saturate(180%) blur(14px)",
        borderBottom: `1px solid ${solid ? "var(--m-line)" : "rgba(255,255,255,0.10)"}`,
        transition: "background 0.28s ease, border-color 0.28s ease",
      }}
    >
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
        <nav style={{ display: "flex", alignItems: "center", height: HEADER_H, gap: 32 }}>
          <Link href="/" style={{ flexShrink: 0, textDecoration: "none" }}>
            <Wordmark
              size="sm"
              uid="mk-nav"
              gradient={false}
              tone={solid ? "brand" : "light"}
              href={null}
            />
          </Link>

          {/* Desktop links — visibility is owned by the class, not inline style */}
          <div className="hidden lg:flex" style={{ alignItems: "center", gap: 4 }}>
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                style={{
                  fontSize: 14,
                  fontWeight: 450,
                  letterSpacing: "-0.008em",
                  color: linkColor,
                  textDecoration: "none",
                  padding: "7px 11px",
                  borderRadius: "var(--m-r-sm)",
                  transition: "color 0.2s ease, background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = linkHover;
                  e.currentTarget.style.background = linkHoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = linkColor;
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="hidden xl:flex">
              <ThemeColorSwitcher onDark={!solid} />
            </div>

            <Link
              href={ROUTES.login}
              className="hidden md:inline-flex"
              style={{
                alignItems: "center",
                fontSize: 14,
                fontWeight: 450,
                color: linkColor,
                textDecoration: "none",
                padding: "7px 10px",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = linkHover)}
              onMouseLeave={(e) => (e.currentTarget.style.color = linkColor)}
            >
              Sign in
            </Link>

            <Link
              href={ROUTES.signup}
              className={`m-btn ${solid ? "m-btn-primary" : "m-btn-on-dark"}`}
              style={{ padding: "8px 16px", fontSize: 14 }}
            >
              Get started
            </Link>

            {/* Menu toggle — hidden from lg up, where the inline links take over */}
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="inline-flex lg:hidden"
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                border: `1px solid ${solid ? "var(--m-line-2)" : "rgba(255,255,255,0.28)"}`,
                borderRadius: "var(--m-r-sm)",
                background: "transparent",
                color: solid ? "var(--m-fg-2)" : "#FFFFFF",
                cursor: "pointer",
                transition: "color 0.2s ease, border-color 0.2s ease",
              }}
            >
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden" style={{ borderTop: "1px solid var(--m-line)", background: "var(--m-bg)" }}>
          <div style={{ maxWidth: 1140, margin: "0 auto", padding: "8px 24px 20px" }}>
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "12px 0",
                  fontSize: 15,
                  color: "var(--m-fg)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--m-line)",
                }}
              >
                {l.label}
              </a>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Link href={ROUTES.login} className="m-btn m-btn-ghost" style={{ flex: 1 }}>
                Sign in
              </Link>
              <Link href={ROUTES.signup} className="m-btn m-btn-primary" style={{ flex: 1 }}>
                Get started
              </Link>
            </div>
            <div style={{ marginTop: 16 }}>
              <ThemeColorSwitcher />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

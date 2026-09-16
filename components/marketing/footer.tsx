import { LinkedinLogo, TelegramLogo, XLogo } from "@phosphor-icons/react/dist/ssr"
import { Wordmark } from "@/components/brand/wordmark"
import { BRAND } from "@/lib/constants"

const LINK_CLASS =
  "text-sm text-[var(--color-baltic-sea-500)] hover:text-[var(--color-keppel-400)] transition-colors"

const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    links: [
      { label: "Live monitor", href: "#product" },
      { label: "Routing rules", href: "#how-it-works" },
      { label: "Marketplace", href: "#product" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "API reference", href: "#" },
      { label: "Webhooks", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Customers", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: `mailto:${BRAND.email}` },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "TCPA", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
]

const SOCIAL_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-baltic-sea-800)] hover:border-[var(--color-keppel-700)] hover:bg-[var(--color-keppel-950)] transition-colors"

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-baltic-sea-900)] py-16">
      <div className="mx-auto max-w-[1400px] px-2.5 sm:px-6 lg:px-12">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          {/* Brand column */}
          <div className="lg:max-w-xs">
            {/* Same lock-up as the header — brand mark + name in the blue ramp. */}
            <Wordmark size="md" uid="mk-footer" />
            <p className="mt-4 text-sm text-[var(--color-baltic-sea-500)]">
              Real-time call scoring, routing and analytics for pay-per-call networks.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a href="https://t.me/Avortyx_Sup" target="_blank" rel="noreferrer" aria-label="Telegram" className={SOCIAL_CLASS}>
                <TelegramLogo weight="fill" className="h-4 w-4 text-[var(--color-baltic-sea-500)]" />
              </a>
              <a href="#" aria-label="X" className={SOCIAL_CLASS}>
                <XLogo weight="fill" className="h-4 w-4 text-[var(--color-baltic-sea-500)]" />
              </a>
              <a href="#" aria-label="LinkedIn" className={SOCIAL_CLASS}>
                <LinkedinLogo weight="fill" className="h-4 w-4 text-[var(--color-baltic-sea-500)]" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-16">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-medium text-[var(--color-baltic-sea-200)]">{col.title}</h4>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className={LINK_CLASS}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--color-baltic-sea-900)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-[var(--color-baltic-sea-600)]">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </span>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-keppel-400)] animate-pulse" />
            <span className="text-xs text-[var(--color-baltic-sea-500)]">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

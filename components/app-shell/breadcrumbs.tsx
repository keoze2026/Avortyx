"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { NAV_GROUPS, NAV_LABEL_BY_PATH } from "@/lib/nav";
import { useUIStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

function humanize(seg: string) {
  return seg.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Compute the section index for a given top-level path (Dashboard = 00, Live = 01, …).
 * Falls back to a hash-derived index for unknown paths so dynamic routes stay stable.
 */
function sectionIndexFor(href: string) {
  let idx = 0;
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (item.href === href || href.startsWith(`${item.href}/`)) {
        return idx.toString().padStart(2, "0");
      }
      idx += 1;
    }
  }
  return "—";
}

/** Menu label keys by path, so the crumbs read in the chosen language. */
const NAV_KEY_BY_PATH: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.href, i.nameKey])),
);

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const overrides = useUIStore((s) => s.breadcrumbOverrides);
  const { t } = useTranslation();

  if (!pathname || pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = overrides[href] ?? (NAV_KEY_BY_PATH[href] ? t(NAV_KEY_BY_PATH[href]) : NAV_LABEL_BY_PATH[href] ?? humanize(seg));
    return { href, label };
  });

  const sectionIndex = sectionIndexFor(pathname);

  return (
    <nav
      aria-label={t("x318.app.breadcrumb")}
      className={cn(
        "flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]",
        className,
      )}
    >
      {/* Section index chip */}
      <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
        {sectionIndex}
      </span>

      {/* Avortyx root */}
      <Link
        href={ROUTES.dashboard}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        vortyx
      </Link>

      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-2">
            <span aria-hidden className="text-muted-foreground/40">
              /
            </span>
            {last ? (
              <span className="text-foreground">{c.label.toLowerCase()}</span>
            ) : (
              <Link
                href={c.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.label.toLowerCase()}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

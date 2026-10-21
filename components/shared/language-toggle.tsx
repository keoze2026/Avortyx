"use client";

/**
 * Language picker — globe icon popover that swaps between the configured
 * locales (English, Russian, Japanese). State persists via `useLocaleStore`.
 */

import { useEffect, useState } from "react";
import { Check, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LOCALES } from "@/lib/i18n/locales";
import { useLocaleStore } from "@/lib/store/locale-store";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

// Inline SVG flags. Windows does not draw flag emoji (it shows "US", "RU"...),
// so the picker draws its own to look the same on every OS.
const STAR = "0,-1 0.2245,-0.309 0.9511,-0.309 0.3633,0.118 0.5878,0.809 0,0.382 -0.5878,0.809 -0.3633,0.118 -0.9511,-0.309 -0.2245,-0.309";

function Flag({ id }: { id: string }) {
  const common = {
    viewBox: "0 0 30 20",
    className: "h-4 w-6 shrink-0 rounded-[2px] ring-1 ring-black/20",
    "aria-hidden": true,
  } as const;

  if (id === "ru") {
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#fff" />
        <rect y="6.67" width="30" height="6.67" fill="#0039A6" />
        <rect y="13.33" width="30" height="6.67" fill="#D52B1E" />
      </svg>
    );
  }
  if (id === "ja") {
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#fff" />
        <circle cx="15" cy="10" r="6" fill="#BC002D" />
      </svg>
    );
  }
  if (id === "zh") {
    return (
      <svg {...common}>
        <rect width="30" height="20" fill="#DE2910" />
        <polygon points={STAR} fill="#FFDE00" transform="translate(5 5) scale(3)" />
        <polygon points={STAR} fill="#FFDE00" transform="translate(10 2) scale(1)" />
        <polygon points={STAR} fill="#FFDE00" transform="translate(12 4) scale(1)" />
        <polygon points={STAR} fill="#FFDE00" transform="translate(12 7) scale(1)" />
        <polygon points={STAR} fill="#FFDE00" transform="translate(10 9) scale(1)" />
      </svg>
    );
  }
  // en / US
  return (
    <svg {...common}>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#B22234" />
      ))}
      <rect width="12" height={(7 * 20) / 13} fill="#3C3B6E" />
    </svg>
  );
}

// Right-hand column: the country for English, the English name for the rest.
const SECONDARY: Record<string, string> = { en: "US" };

export function LanguageToggle({ className }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { t } = useTranslation();

  // SSR-safe — render a stable shell until hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("relative", className)}
        aria-label={t("topbar.language")}
      >
        <Globe className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={t("topbar.language")}
        >
          <Globe className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("preferences.language")}
        </div>
        <ul className="space-y-0.5">
          {LOCALES.map((loc) => {
            const active = locale === loc.id;
            return (
              <li key={loc.id}>
                <button
                  type="button"
                  onClick={() => setLocale(loc.id)}
                  className={cn(
                    "grid w-full grid-cols-[1.5rem_1fr_5.5rem_0.875rem] items-center gap-3 rounded-md border px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "border-accent/60 bg-accent/10 text-foreground"
                      : "border-transparent text-foreground/90 hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <Flag id={loc.id} />
                  <span className="truncate text-left">{loc.label}</span>
                  <span className="truncate text-left text-muted-foreground">
                    {SECONDARY[loc.id] ?? loc.english}
                  </span>
                  {active ? (
                    <Check className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <span />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
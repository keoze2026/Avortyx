"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/hooks/use-translation";
import { ACCENTS, DEFAULT_ACCENT_ID } from "@/lib/accent-themes";
import { useAccentStore } from "@/lib/store/accent-store";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** "icon" = compact button (topbar). "menu" = legacy dropdown with theme modes only. */
  variant?: "icon" | "menu";
}

export function ThemeToggle({ className, variant = "menu" }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const accent = useAccentStore((s) => s.accent);
  const setAccent = useAccentStore((s) => s.setAccent);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // SSR placeholder — render a stable shell to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label={t("topbar.theme")}>
        <Sun className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  const isDark = (resolvedTheme ?? theme) === "dark";

  if (variant === "icon") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative overflow-hidden", className)}
            aria-label={t("x2.theme.themeAndAccent")}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.span
                  key="moon"
                  initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Moon className="h-4 w-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="sun"
                  initial={{ rotate: 90, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Sun className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 p-3">
          {/* Mode segmented control */}
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("preferences.mode")}
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-md border border-border bg-secondary/40 p-0.5">
            {[
              { id: "light", label: t("preferences.light"), icon: Sun },
              { id: "dark", label: t("preferences.dark"), icon: Moon },
              { id: "system", label: t("preferences.auto"), icon: Monitor },
            ].map((m) => {
              const Icon = m.icon;
              const active = theme === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTheme(m.id)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Color theme swatches — full palette swap */}
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("preferences.colorTheme")}
          </div>
          <div className="mt-1.5 grid grid-cols-5 gap-1.5">
            {ACCENTS.map((a) => {
              const active = accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccent(a.id)}
                  className={cn(
                    "relative inline-flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110",
                    active ? "border-foreground" : "border-transparent",
                    a.gradient && "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
                  )}
                  // `background` (not backgroundColor) accepts both solid
                  // colors and CSS gradient strings — gradient themes are
                  // multi-stop linear gradients.
                  style={{ background: a.swatch }}
                  aria-label={t("x2.theme.applyTheme").replace("{name}", t(a.nameKey))}
                  title={t(a.nameKey)}
                >
                  {active && (
                    <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 truncate text-[11px] text-muted-foreground">
            {t((ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0]).nameKey)}
            {accent !== DEFAULT_ACCENT_ID && (
              <button
                type="button"
                onClick={() => setAccent(DEFAULT_ACCENT_ID)}
                className="ml-2 text-accent hover:underline"
              >
                {t("preferences.reset")}
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const Icon = theme === "system" ? Monitor : isDark ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label={t("topbar.theme")}>
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onSelect={() => setTheme("light")}>
          <Sun className="h-4 w-4" /> {t("preferences.light")}
          {theme === "light" && <span className="ml-auto text-[10px] text-accent">●</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}>
          <Moon className="h-4 w-4" /> {t("preferences.dark")}
          {theme === "dark" && <span className="ml-auto text-[10px] text-accent">●</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}>
          <Monitor className="h-4 w-4" /> {t("x2.theme.system")}
          {theme === "system" && <span className="ml-auto text-[10px] text-accent">●</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

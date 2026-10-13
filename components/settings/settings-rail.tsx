"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Bell, CalendarClock, GitFork, KeyRound, Monitor, ShieldCheck, UserCog } from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { usePermissions } from "@/lib/my-permissions";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "profile"
  | "security"
  | "api-keys"
  | "notifications"
  | "sessions"
  | "scheduled-reports"
  | "advanced-routing";

/** Sections that can be opened from a link: /settings?section=<id>. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  "profile",
  "security",
  "api-keys",
  "notifications",
  "sessions",
  "scheduled-reports",
  "advanced-routing",
];

interface RailItem {
  id: SettingsSection;
  /** Dotted translation key under `settings.rail.*.label`. */
  labelKey: string;
  /** Dotted translation key under `settings.rail.*.description`. */
  descriptionKey: string;
  icon: LucideIcon;
}

const ITEMS: RailItem[] = [
  { id: "profile",            labelKey: "settings.rail.profile.label",       descriptionKey: "settings.rail.profile.description",       icon: UserCog },
  { id: "security",           labelKey: "settings.rail.security.label",      descriptionKey: "settings.rail.security.description",      icon: ShieldCheck },
  { id: "api-keys",           labelKey: "settings.rail.apiKeys.label",       descriptionKey: "settings.rail.apiKeys.description",       icon: KeyRound },
  { id: "notifications",      labelKey: "settings.rail.notifications.label", descriptionKey: "settings.rail.notifications.description", icon: Bell },
  { id: "sessions",           labelKey: "settings.rail.sessions.label",      descriptionKey: "settings.rail.sessions.description",      icon: Monitor },
  { id: "scheduled-reports",  labelKey: "settings.scheduledReports.railLabel", descriptionKey: "settings.scheduledReports.railDescription", icon: CalendarClock },
  // The rule-based routing editor, moved here from the Routing page (admins only).
  { id: "advanced-routing",   labelKey: "settings.rail.advancedRouting.label", descriptionKey: "settings.rail.advancedRouting.description", icon: GitFork },
];

/** Advanced Routing is for the workspace admin (and employees whose role can see call flows). */
export function useCanSeeAdvancedRouting(): boolean {
  const role = useAuthStore((s) => s.user?.role);
  const { canSeePath } = usePermissions();
  return role === "admin" && canSeePath(ROUTES.routing);
}

interface Props {
  active: SettingsSection;
  onSelect: (id: SettingsSection) => void;
}

export function SettingsRail({ active, onSelect }: Props) {
  const { t } = useTranslation();
  const showAdvanced = useCanSeeAdvancedRouting();
  const items = ITEMS.filter((i) => i.id !== "advanced-routing" || showAdvanced);
  return (
    <aside className="space-y-1.5">
      <h2 className="px-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
        {t("settings.rail.title")}
      </h2>
      <ul className="space-y-1">
        {items.map((item, i) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  "group relative flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all",
                  isActive
                    ? "border-accent/40 bg-accent/8 shadow-sm"
                    : "border-transparent hover:border-border hover:bg-secondary/40",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-rail-active"
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-accent"
                  />
                )}
                <span
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "bg-secondary/60 text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className={cn("text-sm font-medium", isActive && "text-foreground")}>
                    {t(item.labelKey)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{t(item.descriptionKey)}</div>
                </div>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </aside>
  );
}

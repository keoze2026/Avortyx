"use client";

/**
 * iPhone-style banner stack pinned to the top of the screen.
 *
 * Listens to the push-notifications store and renders any active banners in
 * a vertical column under the topbar. Banners auto-dismiss after their
 * `durationMs` (default 6s); the operator can also click the × to dismiss
 * early. AnimatePresence handles slide-in / slide-out so the stack stays calm.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  DollarSign,
  Phone,
  ShieldAlert,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import {
  usePushNotificationsStore,
  type PushIcon,
  type PushNotification,
} from "@/lib/store/push-notifications-store";
import { SEVERITY_DOT, type NotificationSeverity } from "@/lib/mock/notifications";
import { cn } from "@/lib/utils";

const DEFAULT_DURATION_MS = 6000;

const ICONS: Record<PushIcon, LucideIcon> = {
  phone: Phone,
  dollar: DollarSign,
  shield: ShieldAlert,
  spark: Sparkles,
  alert: AlertTriangle,
};

/** Tint behind the icon tile — keyed off severity so it reads at a glance. */
const SEVERITY_TILE: Record<NotificationSeverity, string> = {
  critical: "bg-destructive/15 text-destructive",
  warn: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  info: "bg-accent/15 text-accent",
  insight: "bg-[oklch(0.7_0.2_290)]/15 text-[oklch(0.7_0.2_290)]",
};

export function PushNotifications() {
  const banners = usePushNotificationsStore((s) => s.banners);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3 sm:top-4 sm:px-0">
      <div className="flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {banners.map((b) => (
            <BannerCard key={b.id} banner={b} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BannerCard({ banner }: { banner: PushNotification }) {
  const { t } = useTranslation();
  const router = useRouter();
  const dismiss = usePushNotificationsStore((s) => s.dismiss);
  const Icon: LucideIcon = banner.icon ? ICONS[banner.icon] : ICONS.alert;
  const duration = banner.durationMs ?? DEFAULT_DURATION_MS;

  // Auto-dismiss timer. 0 means sticky — only dismissed by the × button.
  React.useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(() => dismiss(banner.id), duration);
    return () => clearTimeout(t);
  }, [banner.id, duration, dismiss]);

  return (
    <motion.div
      layout
      initial={{ y: -32, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -16, opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "pointer-events-auto group/banner relative flex gap-3 overflow-hidden",
        // iPhone-style: frosted glass, rounded, soft shadow.
        "rounded-2xl border border-border/60 bg-background/85 px-3 py-3 shadow-[0_12px_32px_rgba(15,18,32,0.18)] backdrop-blur-xl",
      )}
    >
      {/* Icon tile */}
      <span
        className={cn(
          "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          SEVERITY_TILE[banner.severity],
        )}
      >
        <Icon className="h-4 w-4" />
        {/* Severity dot — sits above the tile, mirroring the dropdown's dot. */}
        <span
          aria-hidden
          className={cn(
            "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-background",
            SEVERITY_DOT[banner.severity],
          )}
        />
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h4 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
            {banner.title}
          </h4>
          <button
            type="button"
            onClick={() => dismiss(banner.id)}
            aria-label={t("notificationsUI.push.dismiss")}
            className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {banner.source && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {banner.source}
          </div>
        )}
        <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground/90">
          {banner.body}
        </p>
        {banner.action && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                dismiss(banner.id);
                if (banner.actionHref) router.push(banner.actionHref);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-accent/45 hover:text-accent"
            >
              {banner.action}
            </button>
          </div>
        )}
      </div>

      {/* Progress hairline along the bottom, draining toward dismissal. */}
      {duration > 0 && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent/45"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: duration / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

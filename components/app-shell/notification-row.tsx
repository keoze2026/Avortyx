"use client";

import { Building2, MapPin, Megaphone, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { useLocalName } from "@/lib/i18n/local-name";
import {
  ALERT_KIND_DOT,
  ALERT_KIND_TEXT,
  SEVERITY_DOT,
  type NotificationItem,
} from "@/lib/mock/notifications";
import { cn } from "@/lib/utils";

/**
 * One notification row — used both in the topbar dropdown list and on the
 * dedicated /notifications page. Layout is identical across both surfaces.
 */
export function NotificationRow({ item }: { item: NotificationItem }) {
  const { t } = useTranslation();
  const localName = useLocalName();
  // "AI Insights" is the feed's own default source; anything else is a name the team typed.
  const sourceLabel = item.source === "AI Insights" ? t("nav.aiInsights") : localName(item.source);
  const positive = (item.delta ?? 0) >= 0;
  // Prefer the fine-grained alert-kind color (missed=red / cap-over=orange
  // / low-aht=yellow) when present; fall back to the severity dot.
  const dotClass = item.alertKind
    ? ALERT_KIND_DOT[item.alertKind]
    : SEVERITY_DOT[item.severity];
  // Tint the title with the matching alert-kind color so a glance picks up
  // the urgency tier (red/orange/yellow) without having to read the dot.
  // Faded copies once the row is marked read so unread items stay louder.
  const titleColorClass = item.alertKind
    ? item.read
      ? cn(ALERT_KIND_TEXT[item.alertKind], "opacity-65")
      : ALERT_KIND_TEXT[item.alertKind]
    : item.read
      ? "text-muted-foreground"
      : "text-foreground";

  return (
    <li
      className={cn(
        "group/notif relative flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/35",
        !item.read && "bg-secondary/15",
      )}
    >
      {/* Severity / alert-kind dot */}
      <span
        aria-hidden
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotClass)}
      />

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h4
            className={cn(
              "truncate text-sm font-semibold leading-snug",
              titleColorClass,
            )}
          >
            {item.title}
          </h4>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{item.time}</span>
        </div>
        {item.source && !item.destination && !item.buyer && !item.campaign && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={sourceLabel !== item.source ? item.source : undefined}>{sourceLabel}</div>
        )}

        {/* Structured entity context — explicit "Destination: X" / "Buyer: Y"
            chips so the reader instantly knows WHICH destination missed and
            WHICH buyer's cap fired, instead of having to guess what `source`
            refers to. */}
        {(item.destination || item.buyer || item.campaign) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {item.destination && (
              <EntityChip
                icon={MapPin}
                label={t("notificationsUI.entity.destination")}
                value={localName(item.destination)}
                real={item.destination}
              />
            )}
            {item.buyer && (
              <EntityChip
                icon={Building2}
                label={t("notificationsUI.entity.buyer")}
                value={localName(item.buyer)}
                real={item.buyer}
              />
            )}
            {item.campaign && (
              <EntityChip
                icon={Megaphone}
                label={t("notificationsUI.entity.campaign")}
                value={localName(item.campaign)}
                real={item.campaign}
              />
            )}
          </div>
        )}

        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">{item.body}</p>

        {(typeof item.delta === "number" || item.action) && (
          <div className="mt-2 flex items-center gap-2">
            {typeof item.delta === "number" && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  positive
                    ? "bg-[color:var(--success)]/12 text-[color:var(--success)]"
                    : "bg-destructive/12 text-destructive",
                )}
              >
                {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {positive ? "+" : ""}
                {item.delta.toFixed(1)}%
              </span>
            )}
            {item.action && (
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-accent/45 hover:text-accent"
              >
                {item.severity === "insight" && <Sparkles className="h-3 w-3" />}
                {item.action}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Small labeled chip showing which entity an alert is about — e.g.
 * `📍 Destination · Solar Nationwide` or `🏢 Buyer · Apex Solutions`.
 * Lets readers tell at a glance whether the source name refers to a
 * destination, a buyer, or a campaign.
 */
function EntityChip({
  icon: Icon,
  label,
  value,
  real,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  /** The name as typed, shown on hover when the chip shows it in another script. */
  real?: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px]">
      <Icon className="h-2.5 w-2.5 text-muted-foreground" />
      <span className="font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-foreground/90" title={real && real !== value ? real : undefined}>{value}</span>
    </span>
  );
}

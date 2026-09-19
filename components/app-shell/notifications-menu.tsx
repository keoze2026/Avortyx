"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, BellRing, CheckCheck, ChevronRight, Inbox } from "lucide-react";

import { NotificationRow } from "@/components/app-shell/notification-row";
import { PopupAlertSettings } from "@/components/app-shell/popup-alert-settings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useAiInsightsStore } from "@/lib/store/ai-insights-store";
import { useNotificationsReadStore } from "@/lib/store/notifications-read-store";
import {
  ALERT_KIND_DOT,
  type AlertKind,
  type NotificationItem,
} from "@/lib/mock/notifications";
import { anomalyToNotification, capAlertToNotification } from "@/lib/notifications/mappers";
import { useCapAlertsStore } from "@/lib/store/cap-alerts-store";
import { cn } from "@/lib/utils";

type TabId = "all" | "critical" | "insights";
type AlertFilter = "all" | AlertKind;

/** Cap on the topbar dropdown — the full set lives on /notifications. */
const POPUP_LIMIT = 6;

export function NotificationsMenu() {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<TabId>("all");
  // Sub-filter for the Alerts tab — split alerts by missed / cap / AHT.
  const [alertFilter, setAlertFilter] = React.useState<AlertFilter>("all");
  // "Pop-up alerts" panel — which alert kinds may pop a banner on top.
  const [showPopupPrefs, setShowPopupPrefs] = React.useState(false);
  // Live anomalies from /api/ai/anomalies become the topbar dropdown's source.
  // Each anomaly is mapped to the NotificationItem shape via the shared
  // mappers module (same code path as the /notifications page). Read-state
  // lives in a tiny persisted store so flips survive refresh and stay in
  // sync between the dropdown and the full page.
  const anomalies = useAiInsightsStore((s) => s.anomalies);
  const readIds = useNotificationsReadStore((s) => s.readIds);
  const markAllReadStore = useNotificationsReadStore((s) => s.markAllRead);
  // Cap alerts come from the live destination / campaign counters (see
  // lib/cap-watch-runtime.ts); they sit alongside the AI anomalies, newest
  // first, and share the same read-state store.
  const capAlerts = useCapAlertsStore((s) => s.alerts);
  const items: NotificationItem[] = React.useMemo(() => {
    const fromAnomalies = anomalies.map((a) => ({ item: anomalyToNotification(a), at: a.detectedAt }));
    const fromCaps = capAlerts.map((a) => ({ item: capAlertToNotification(a, t), at: a.at }));
    return [...fromCaps, ...fromAnomalies]
      .sort((x, y) => y.at - x.at)
      .map(({ item }) => ({ ...item, read: !!readIds[item.id] }));
  }, [anomalies, capAlerts, readIds, t]);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "all", label: t("notificationsUI.menu.tabs.all") },
    { id: "critical", label: t("notificationsUI.menu.tabs.alerts") },
    { id: "insights", label: t("notificationsUI.menu.tabs.insights") },
  ];

  const unread = items.filter((n) => !n.read).length;

  /** All alert-severity items (`critical` + `warn`). Used both for the
   *  "Alerts" tab count and the sub-chip counts. */
  const alertItems = items.filter(
    (x) => x.severity === "critical" || x.severity === "warn",
  );

  const counts: Record<TabId, number> = {
    all: items.length,
    critical: alertItems.length,
    insights: items.filter((x) => x.severity === "insight").length,
  };

  /** Per-alert-kind counts for the sub-chip badges. `all` is the full alerts
   *  total; the three named kinds count only items tagged with that kind. */
  const alertKindCounts: Record<AlertFilter, number> = {
    all: alertItems.length,
    missed: alertItems.filter((x) => x.alertKind === "missed").length,
    "cap-over": alertItems.filter((x) => x.alertKind === "cap-over").length,
    "low-aht": alertItems.filter((x) => x.alertKind === "low-aht").length,
    other: alertItems.filter((x) => x.alertKind === "other").length,
  };

  const alertChips: Array<{ id: AlertFilter; label: string; dot?: string }> = [
    { id: "all", label: t("notificationsUI.menu.alertKinds.all") },
    {
      id: "missed",
      label: t("notificationsUI.menu.alertKinds.missed"),
      dot: ALERT_KIND_DOT.missed,
    },
    {
      id: "cap-over",
      label: t("notificationsUI.menu.alertKinds.capOver"),
      dot: ALERT_KIND_DOT["cap-over"],
    },
    {
      id: "low-aht",
      label: t("notificationsUI.menu.alertKinds.lowAht"),
      dot: ALERT_KIND_DOT["low-aht"],
    },
  ];

  const filtered = items
    .filter((n) => {
      if (tab === "all") return true;
      if (tab === "insights") return n.severity === "insight";
      // Alerts tab — also honor the sub-filter chip.
      if (n.severity !== "critical" && n.severity !== "warn") return false;
      if (alertFilter === "all") return true;
      return n.alertKind === alertFilter;
    })
    .slice(0, POPUP_LIMIT);

  const markAllRead = () => markAllReadStore(items.map((n) => n.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notificationsUI.menu.bellLabel")}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full border border-background bg-accent px-1 text-[9px] font-bold text-accent-foreground">
              {unread}
            </span>
          )}
          <span className="sr-only">{t("notificationsUI.menu.srLabel")}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(380px,calc(100vw-1rem))] overflow-hidden border-border bg-popover p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h3 className="text-sm font-semibold">{t("notificationsUI.menu.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {unread > 0
                ? t("notificationsUI.menu.unreadSuffix").replace("{n}", String(unread))
                : t("notificationsUI.menu.allCaughtUp")}
            </p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("notificationsUI.menu.markAllRead")}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4 pb-3">
          <div className="flex gap-1 rounded-md border border-border bg-secondary/30 p-0.5">
            {tabs.map((tabItem) => {
              const isActive = tab === tabItem.id;
              const count = counts[tabItem.id];
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setTab(tabItem.id)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tabItem.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] tabular-nums",
                      isActive ? "bg-accent/15 text-accent" : "bg-secondary/60 text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Alert-kind sub-chips — only relevant when Alerts tab is active.
              Each chip carries its own color dot so the user can spot which
              category they're filtering at a glance. */}
          {tab === "critical" && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {/* Pop-up alerts toggle — opens the switch list for which
                  alert kinds may pop a banner at the top of the screen. */}
              <button
                type="button"
                onClick={() => setShowPopupPrefs((v) => !v)}
                aria-pressed={showPopupPrefs}
                title={t("notificationsUI.popupPrefs.button")}
                className={cn(
                  "order-last ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  showPopupPrefs
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <BellRing className="h-3 w-3" />
                {t("notificationsUI.popupPrefs.button")}
              </button>
              {alertChips.map((chip) => {
                const isActive = alertFilter === chip.id;
                const count = alertKindCounts[chip.id];
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setAlertFilter(chip.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "border-foreground/35 bg-secondary/60 text-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {chip.dot && (
                      <span
                        aria-hidden
                        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", chip.dot)}
                      />
                    )}
                    {chip.label}
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* List — or, on the Alerts tab, the pop-up alert switches */}
        <div className="max-h-[420px] overflow-y-auto border-t border-border/60">
          {tab === "critical" && showPopupPrefs ? (
            <PopupAlertSettings />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Inbox className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">{t("notificationsUI.menu.empty")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((n) => (
                <NotificationRow key={n.id} item={n} />
              ))}
            </ul>
          )}
        </div>

        {/* Footer — link to the full page */}
        <div className="border-t border-border/60 bg-secondary/20 px-2 py-1.5">
          <Link
            href={ROUTES.notifications}
            className="inline-flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            {t("notificationsUI.menu.viewAll")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

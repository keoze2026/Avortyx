"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Inbox } from "lucide-react";
import { toast } from "sonner";

import { NotificationRow } from "@/components/app-shell/notification-row";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import type { NotificationItem } from "@/lib/mock/notifications";
import {
  anomalyToNotification,
  recommendationToNotification,
} from "@/lib/notifications/mappers";
import { useAiInsightsStore } from "@/lib/store/ai-insights-store";
import { useNotificationsReadStore } from "@/lib/store/notifications-read-store";
import { cn } from "@/lib/utils";

type TabId = "all" | "critical" | "insights" | "read";

const TABS: Array<{ id: TabId; label: string; labelKey: string }> = [
  { id: "all", label: "All", labelKey: "notificationsUI.menu.tabs.all" },
  { id: "critical", label: "Alerts", labelKey: "notificationsUI.menu.tabs.alerts" },
  { id: "insights", label: "Insights", labelKey: "notificationsUI.menu.tabs.insights" },
  { id: "read", label: "Read", labelKey: "notificationsUI.menu.tabs.read" },
];

export default function NotificationsPage() {
  const { t: tr } = useTranslation();
  const [tab, setTab] = useState<TabId>("all");

  // Live data — anomalies (alerts) + recommendations (insights) from the AI
  // store, hydrated once on app boot by StoreHydrator. The backend has no
  // dedicated alert-feed endpoint; we synthesize one from these two sources.
  const anomalies = useAiInsightsStore((s) => s.anomalies);
  const recommendations = useAiInsightsStore((s) => s.recommendations);

  // Read-state is purely client-side (backend rows have no per-user read
  // flag). Persisted to localStorage so flips survive refresh and stay in
  // sync with the topbar dropdown.
  const readIds = useNotificationsReadStore((s) => s.readIds);
  const markAllReadStore = useNotificationsReadStore((s) => s.markAllRead);

  const items: NotificationItem[] = useMemo(() => {
    const merged: NotificationItem[] = [
      ...anomalies.map(anomalyToNotification),
      ...recommendations.map(recommendationToNotification),
    ];
    return merged.map((n) => ({ ...n, read: !!readIds[n.id] }));
  }, [anomalies, recommendations, readIds]);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const counts: Record<TabId, number> = useMemo(
    () => ({
      all: items.length,
      critical: items.filter((x) => x.severity === "critical" || x.severity === "warn").length,
      insights: items.filter((x) => x.severity === "insight").length,
      read: items.filter((x) => x.read).length,
    }),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((n) => {
        if (tab === "all") return true;
        if (tab === "critical") return n.severity === "critical" || n.severity === "warn";
        if (tab === "insights") return n.severity === "insight";
        return n.read;
      }),
    [items, tab],
  );

  const markAllRead = () => {
    markAllReadStore(items.map((n) => n.id));
    toast.success(tr("x5.notifications.allMarkedRead"));
  };

  return (
    <>
      <PageHeader
        title={tr("notificationsUI.menu.title")}
        description={
          unread > 0
            ? tr("x5.notifications.unreadSummary").replace("{count}", String(unread))
            : tr("x5.notifications.allCaughtUp")
        }
        actions={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> {tr("notificationsUI.menu.markAllRead")}
            </Button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-md border border-border bg-secondary/30 p-0.5 w-fit">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tr(t.labelKey)}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "bg-secondary/60 text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Inbox className="h-7 w-7 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{tr("x5.notifications.emptyFilter")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {filtered.map((n) => (
              <NotificationRow key={n.id} item={n} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

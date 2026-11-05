"use client";

/**
 * Notifications page. CH-558 (Sir, 5 Nov: "We need notification box more
 * organized" / "this is too long to read"), in Sir's design:
 *   - "1 unread", Mark all read, Alert settings;
 *   - All / Alerts / Insights / Read;
 *   - grouped by day (Today, Yesterday, ...);
 *   - one entry per kind of problem: "7 buyers are missing calls" with each
 *     buyer's % missed and View buyers; "15 campaigns have no active buyers"
 *     with Assign buyers - instead of one row per buyer / campaign.
 */
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { toast } from "sonner";

import { FeedRow } from "@/components/app-shell/feed-row";
import { PopupAlertSettings } from "@/components/app-shell/popup-alert-settings";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/use-translation";
import { dayLabel, useClearAllNotifications, useNotificationFeed, type FeedEntry } from "@/lib/notifications/feed";
import { useNotificationsReadStore } from "@/lib/store/notifications-read-store";
import { cn } from "@/lib/utils";

type TabId = "all" | "alerts" | "insights" | "read";

export default function NotificationsPage() {
  const { t, locale } = useTranslation();
  const [tab, setTab] = useState<TabId>("all");
  const [settings, setSettings] = useState(false);
  const { entries, counts, unread, allIds, everyId } = useNotificationFeed();
  const clearAll = useClearAllNotifications(everyId);
  const markAllReadStore = useNotificationsReadStore((s) => s.markAllRead);

  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: "all", label: t("notificationsUI.menu.tabs.all"), count: counts.all },
    { id: "alerts", label: t("notificationsUI.menu.tabs.alerts"), count: counts.alerts },
    { id: "insights", label: t("notificationsUI.menu.tabs.insights"), count: counts.insights },
    { id: "read", label: t("notificationsUI.menu.tabs.read"), count: counts.read },
  ];

  const days = useMemo(() => {
    const shown = entries.filter((e) =>
      tab === "all" ? true : tab === "read" ? e.read : tab === "alerts" ? e.kind === "alert" : e.kind === "insight",
    );
    const out: Array<{ label: string; items: FeedEntry[] }> = [];
    for (const e of shown) {
      const label = dayLabel(e.at, t, locale);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    }
    return out;
  }, [entries, tab, t, locale]);

  const markAllRead = () => {
    markAllReadStore(allIds);
    toast.success(t("x5.notifications.allMarkedRead"));
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("notificationsUI.menu.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0 ? t("x558.unread").replace("{n}", String(unread)) : t("x5.notifications.allCaughtUp")}
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm">
          {unread > 0 && (
            <button type="button" onClick={markAllRead} className="text-muted-foreground transition-colors hover:text-foreground">
              {t("notificationsUI.menu.markAllRead")}
            </button>
          )}
          {everyId.length > 0 && (
            <button type="button" onClick={clearAll} className="text-muted-foreground transition-colors hover:text-foreground">
              {t("x578.clearAll")}
            </button>
          )}
          <button type="button" onClick={() => setSettings(true)} className="font-medium text-foreground/90 transition-colors hover:text-foreground">
            {t("x558.alertSettings")}
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-7 border-b border-border/60">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={cn(
              "-mb-px border-b-2 pb-3 text-[15px] transition-colors",
              tab === x.id ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label} <span className="ml-1 text-sm tabular-nums text-muted-foreground">{x.count}</span>
          </button>
        ))}
      </div>

      {days.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <Inbox className="h-7 w-7 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{t("x5.notifications.emptyFilter")}</p>
        </div>
      ) : (
        days.map((d) => (
          <section key={d.label} className="mt-7">
            <h2 className="mb-2.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{d.label}</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ul className="divide-y divide-border/50">
                {d.items.map((e) => (
                  <FeedRow key={e.id} entry={e} full />
                ))}
              </ul>
            </div>
          </section>
        ))
      )}

      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto p-0">
          <DialogTitle className="sr-only">{t("x558.alertSettings")}</DialogTitle>
          <PopupAlertSettings />
        </DialogContent>
      </Dialog>
    </div>
  );
}

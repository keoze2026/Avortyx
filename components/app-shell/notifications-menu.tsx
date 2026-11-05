"use client";

/**
 * The bell menu. CH-558 (Sir, 5 Nov: "We need notification box more
 * organized"): Sir's design - All / Alerts / Insights, one entry per kind of
 * problem ("7 buyers are missing calls - TP9, RHS, Q06 and 4 more"), "1
 * unread" and View all at the foot, and the pop-up alert switches behind a
 * settings button, grouped Calls / Caps / Account / System.
 */
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck, Inbox, PhoneOff, Settings2, Trash2 } from "lucide-react";

import { FeedRow } from "@/components/app-shell/feed-row";
import { PopupAlertSettings } from "@/components/app-shell/popup-alert-settings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useClearAllNotifications, useNotificationFeed, useVisibleDeletedTfns } from "@/lib/notifications/feed";
import { useNotificationsReadStore } from "@/lib/store/notifications-read-store";
import { useDeletedTfnsStore } from "@/lib/store/deleted-tfns-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabId = "all" | "alerts" | "insights";

/** Entries in the menu - the full list lives on /notifications. */
const POPUP_LIMIT = 6;

export function NotificationsMenu() {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<TabId>("all");
  const [view, setView] = React.useState<"list" | "settings" | "confirmClear">("list");
  // CH-583: controlled, so a link inside the menu can close it.
  const [open, setOpen] = React.useState(false);
  // CH-568: the bell shows today's (Eastern) notifications only; the page keeps all.
  const { entries, counts, unread: feedUnread, everyId } = useNotificationFeed({ today: true });
  const markAllReadStore = useNotificationsReadStore((s) => s.markAllRead);

  // "TFNs deleted" (backend CH-179): pinned above the list until 12 PM
  // Eastern (CH-182); only numbers not yet Seen count on the bell. Not part
  // of "Mark all read" on purpose.
  const deletedUnseen = useDeletedTfnsStore((s) => s.unseenCount);
  const visibleTfns = useVisibleDeletedTfns();
  const tfnCount = visibleTfns.numbers.length + visibleTfns.kept.length;
  const unread = feedUnread + (tfnCount > 0 ? deletedUnseen : 0);
  const clearAll = useClearAllNotifications(everyId);

  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: "all", label: t("notificationsUI.menu.tabs.all"), count: counts.all },
    { id: "alerts", label: t("notificationsUI.menu.tabs.alerts"), count: counts.alerts },
    { id: "insights", label: t("notificationsUI.menu.tabs.insights"), count: counts.insights },
  ];
  const shown = entries
    .filter((e) => tab === "all" || (tab === "alerts" ? e.kind === "alert" : e.kind === "insight"))
    .slice(0, POPUP_LIMIT);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("list");
      }}
    >
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
        // CH-567: the alert settings open wider, so every switch shows at once.
        className={cn(
          "overflow-hidden rounded-xl border-border bg-popover p-0",
          view === "settings" ? "w-[min(760px,calc(100vw-1rem))]" : "w-[min(360px,calc(100vw-1rem))]",
        )}
      >
        {view === "settings" ? (
          <>
            <button
              type="button"
              onClick={() => setView("list")}
              className="flex w-full items-center gap-2 border-b border-border/60 px-5 py-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("notificationsUI.menu.title")}
            </button>
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto">
              <PopupAlertSettings wide />
            </div>
          </>
        ) : view === "confirmClear" ? (
          // CH-580: a panel in the menu, as the settings are. A dialog over the
          // dropdown can leave the page unclickable when the two close.
          <div className="p-5">
            <h3 className="text-base font-semibold">{t("x578.confirm.title")}</h3>
            <p className="mt-2 text-sm leading-snug text-muted-foreground">{t("x578.confirm.body")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setView("list")}>
                {t("x578.confirm.cancel")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  clearAll();
                  setView("list");
                }}
              >
                {t("x578.clearAll")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 pt-3">
              <h3 className="text-[13px] font-semibold">{t("notificationsUI.menu.title")}</h3>
              <div className="flex items-center gap-1">
                {/* CH-568: always there (it hid once everything was read). */}
                <button
                  type="button"
                  onClick={() => markAllReadStore(everyId)}
                  disabled={feedUnread === 0}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent transition-colors hover:bg-secondary/60 disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                >
                  <CheckCheck className="h-3 w-3" />
                  {t("notificationsUI.menu.markAllRead")}
                </button>
                {/* CH-578 */}
                <button
                  type="button"
                  onClick={() => setView("confirmClear")}
                  disabled={everyId.length + tfnCount === 0}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-accent transition-colors hover:bg-secondary/60 disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("x578.clearAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setView("settings")}
                  title={t("x558.alertSettings")}
                  aria-label={t("x558.alertSettings")}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  <Settings2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Tabs - underlined, like the page */}
            <div className="mt-1.5 flex gap-4 border-b border-border/60 px-3.5">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setTab(x.id)}
                  className={cn(
                    "-mb-px border-b-2 pb-1.5 text-[12px] transition-colors",
                    tab === x.id ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {x.label} <span className="ml-0.5 text-[10.5px] tabular-nums text-muted-foreground">{x.count}</span>
                </button>
              ))}
            </div>

            {tfnCount > 0 && <DeletedTfnsCard onNavigate={() => setOpen(false)} />}

            <div className="max-h-[440px] overflow-y-auto">
              {shown.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <Inbox className="h-6 w-6 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">{t("notificationsUI.menu.empty")}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {shown.map((e) => (
                    <FeedRow key={e.id} entry={e} />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/60 px-3.5 py-2 text-[11px]">
              <span className="text-muted-foreground">
                {unread > 0 ? t("x558.unread").replace("{n}", String(unread)) : t("notificationsUI.menu.allCaughtUp")}
              </span>
              <Link href={ROUTES.notifications} onClick={() => setOpen(false)} className="font-medium text-accent hover:underline">
                {t("notificationsUI.menu.viewAll")}
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The pinned "TFNs deleted" card. Stays until 12 PM Eastern (CH-182); Seen
 *  only clears the badge, so numbers already seen are dimmed, not removed. */
function DeletedTfnsCard({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const unseen = useDeletedTfnsStore((s) => s.unseenCount);
  const { numbers, kept } = useVisibleDeletedTfns();
  const markSeen = useDeletedTfnsStore((s) => s.markSeen);
  const [busy, setBusy] = React.useState(false);
  const count = numbers.length + kept.length;
  // The server marks what this user has Seen (backend CH-182).
  const listed = [...numbers.map((n) => ({ ...n, seen: !!n.seen })), ...kept.map((n) => ({ ...n, seen: true }))];
  const shown = listed.slice(0, 8);
  const more = count - shown.length;

  return (
    <div
      className={cn(
        "mx-5 mt-3 rounded-md border p-3",
        unseen > 0 ? "border-destructive/40 bg-destructive/10" : "border-border bg-secondary/30",
      )}
    >
      <div className="flex items-start gap-2">
        <PhoneOff className={cn("mt-0.5 h-4 w-4 shrink-0", unseen > 0 ? "text-destructive" : "text-muted-foreground")} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">
            {count === 1 ? t("deletedTfnsOne.title") : t("deletedTfns.title").replace("{count}", String(count))}
          </p>
          {/* Sir's wording (24 Oct). The notice still goes by itself at 12 PM
              Eastern (the server stops listing the numbers); the page no
              longer says so. */}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {count === 1 ? t("deletedTfnsOne.body") : t("deletedTfns.body")}
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {shown.map((n) => (
              <li key={n.id} className={cn("flex items-baseline justify-between gap-2 text-[11px]", n.seen && "opacity-60")}>
                {/* The number only (CH-199): carrier codes and rules are for our backend. */}
                <span className="font-mono text-foreground">{prettyTfn(n.number)}</span>
              </li>
            ))}
          </ul>
          {more > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("deletedTfns.more").replace("{count}", String(more))}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            {count === 1 ? t("deletedTfnsOne.replace") : t("deletedTfns.replace")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {unseen > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await markSeen();
                  } catch {
                    toast.error(t("deletedTfns.seenFailed"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <CheckCheck className="h-3.5 w-3.5" /> {t("deletedTfns.seen")}
              </Button>
            )}
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
              <Link href={ROUTES.numbers} onClick={onNavigate}>{t("deletedTfns.addTfns")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** +18888910358 -> 18888910358, as Sir writes it in the TFN Expired notice. */
function prettyTfn(number: string): string {
  const d = (number || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d;
  return number;
}

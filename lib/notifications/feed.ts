/**
 * CH-558 (Sir, 5 Nov: "We need notification box more organized" / "this is
 * too long to read"): one feed for the bell menu and the Notifications page.
 *
 * The same insight used to be one row per buyer / campaign ("Buyer TP9 has
 * high no-answer rate", "Buyer RHS has ...", 7 rows; "Campaign C-16 has no
 * active buyers", 15 rows). Now each kind is ONE entry:
 *   "7 buyers are missing calls - TP9, RHS, Q06 and 4 more"
 *   "15 campaigns have no active buyers - C-16, C-15, C-14 and 12 more"
 * with the per-buyer figures and a link (View buyers / Assign buyers).
 * Cap alerts and other alerts stay one entry each. Counts on the tabs and
 * "unread" still count every underlying notification.
 */
import * as React from "react";

import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import type { NotificationItem } from "@/lib/mock/notifications";
import { anomalyToNotification, capAlertToNotification, recommendationToNotification } from "@/lib/notifications/mappers";
import { useAiInsightsStore } from "@/lib/store/ai-insights-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { useCapAlertsStore } from "@/lib/store/cap-alerts-store";
import { activeCleared, useNotificationsClearedStore } from "@/lib/store/notifications-cleared-store";
import { useDeletedTfnsStore } from "@/lib/store/deleted-tfns-store";
import { useNotificationsReadStore } from "@/lib/store/notifications-read-store";

export type FeedTone = "red" | "amber" | "blue" | "green" | "grey" | "violet";
export type FeedKind = "alert" | "insight";

export interface FeedDetail {
  name: string;
  value: string;
  hot: boolean;
}

export interface FeedEntry {
  id: string;
  /** The notifications it stands for (read state, counts). */
  ids: string[];
  kind: FeedKind;
  tone: FeedTone;
  title: string;
  subtitle?: string;
  /** One line under the title on the full page. */
  body?: string;
  details?: FeedDetail[];
  action?: { label: string; href: string };
  at: number;
  read: boolean;
}

export const TONE_DOT: Record<FeedTone, string> = {
  red: "bg-[#EF4444]",
  amber: "bg-[#F59E0B]",
  blue: "bg-[#3B82F6]",
  green: "bg-[color:var(--success)]",
  grey: "bg-muted-foreground/60",
  violet: "bg-[oklch(0.7_0.2_290)]",
};

interface Raw {
  item: NotificationItem;
  at: number;
  action?: string;
  title: string;
}

const NAME_FROM_TITLE: Record<string, RegExp> = {
  pause_buyer: /^Buyer (.+?) has high no-answer rate/i,
  assign_buyer: /^Campaign (.+?) has no active buyers/i,
};

function names(list: string[], t: (k: string) => string, shown = 3): string {
  if (list.length <= shown) return list.join(", ");
  return `${list.slice(0, shown).join(", ")}${t("x558.andMore").replace("{n}", String(list.length - shown))}`;
}

function plural(t: (k: string) => string, key: string, n: number): string {
  return t(`${key}.${n === 1 ? "one" : "other"}`).replace("{n}", String(n));
}

function toneOf(item: NotificationItem): FeedTone {
  if (item.alertKind === "missed") return "red";
  if (item.alertKind === "cap-over") return item.severity === "critical" ? "blue" : "amber";
  if (item.severity === "critical") return "red";
  if (item.severity === "warn") return "amber";
  if (item.severity === "info") return "blue";
  return "violet";
}

/** Group the raw notifications into feed entries (pure - tested by shape). */
export function buildFeed(raws: Raw[], readIds: Record<string, true>, t: (k: string) => string): FeedEntry[] {
  const out: FeedEntry[] = [];
  const groups = new Map<string, Raw[]>();
  for (const r of raws) {
    if (r.action && NAME_FROM_TITLE[r.action]) {
      const list = groups.get(r.action) ?? [];
      list.push(r);
      groups.set(r.action, list);
      continue;
    }
    out.push({
      id: r.item.id,
      ids: [r.item.id],
      kind: r.item.severity === "insight" ? "insight" : "alert",
      tone: toneOf(r.item),
      title: r.item.title,
      subtitle: r.item.campaign || r.item.destination || r.item.buyer || undefined,
      body: r.item.body,
      at: r.at,
      read: !!readIds[r.item.id],
    });
  }
  for (const [action, list] of groups) {
    const rows = list.map((r) => {
      const name = NAME_FROM_TITLE[action].exec(r.title)?.[1] ?? r.item.source ?? r.title;
      const pct = Number(/(\d+(?:\.\d+)?)\s*%/.exec(r.item.body)?.[1] ?? NaN);
      return { r, name, pct };
    });
    const ids = list.map((r) => r.item.id);
    const at = Math.max(...list.map((r) => r.at));
    const read = ids.every((id) => readIds[id]);
    if (action === "pause_buyer") {
      rows.sort((a, b) => (b.pct || 0) - (a.pct || 0) || a.name.localeCompare(b.name));
      out.push({
        id: "group:pause_buyer",
        ids,
        kind: "insight",
        tone: "red",
        title: plural(t, "x558.missing.title", rows.length),
        subtitle: names(rows.map((x) => x.name), t),
        body: t("x558.missing.body"),
        details: rows.map((x) => ({
          name: x.name,
          value: Number.isFinite(x.pct) ? t("x558.missing.pct").replace("{pct}", String(Math.round(x.pct))) : "",
          hot: x.pct >= 80,
        })),
        action: { label: t("x558.viewBuyers"), href: ROUTES.buyers },
        at,
        read,
      });
    } else {
      rows.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
      out.push({
        id: "group:assign_buyer",
        ids,
        kind: "insight",
        tone: "amber",
        title: plural(t, "x558.noBuyers.title", rows.length),
        subtitle: names(rows.map((x) => x.name), t),
        body: t("x558.noBuyers.body"),
        action: { label: t("x558.assignBuyers"), href: ROUTES.campaigns },
        at,
        read,
      });
    }
  }
  // Grouped problems first within the same moment, then newest first.
  return out.sort((a, b) => b.at - a.at || Number(b.id.startsWith("group:")) - Number(a.id.startsWith("group:")));
}

/** Midnight Eastern (America/New_York) of the day `now` falls in, as epoch ms. */
export function easternDayStart(now: number = Date.now()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(now));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // "24" is how some engines write midnight with hour12 off.
  let start = now - (((get("hour") % 24) * 60 + get("minute")) * 60 + get("second")) * 1000 - (now % 1000);
  // A day that changes clocks (DST) is 23 or 25 hours long: land on 00:00.
  const hourAt = (ms: number) =>
    Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit" }).format(new Date(ms))) % 24;
  if (hourAt(start) === 23) start += 3600_000;
  else if (hourAt(start) === 1) start -= 3600_000;
  return start;
}

/** CH-568: the current Eastern day's start, moving on by itself at midnight. */
function useEasternDayStart(enabled: boolean): number {
  const [start, setStart] = React.useState(() => (enabled ? easternDayStart() : 0));
  React.useEffect(() => {
    if (!enabled) return;
    const tick = () => setStart((prev) => {
      const next = easternDayStart();
      return next === prev ? prev : next;
    });
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return enabled ? start : 0;
}

/**
 * The feed for the bell menu and the page, plus the tab counts.
 *
 * `today` (CH-568, the bell): only what arrived since 12 AM Eastern - older
 * notifications leave the bell at midnight but stay on the Notifications
 * page; nothing is deleted. `everyId` is every notification, for Mark all
 * as read. The "TFNs deleted" card is not part of this feed and keeps its
 * own time (12 PM, CH-182).
 */
export function useNotificationFeed(options: { today?: boolean } = {}) {
  const { t } = useTranslation();
  const since = useEasternDayStart(Boolean(options.today));
  const anomalies = useAiInsightsStore((s) => s.anomalies);
  const recommendations = useAiInsightsStore((s) => s.recommendations);
  const capAlerts = useCapAlertsStore((s) => s.alerts);
  const readIds = useNotificationsReadStore((s) => s.readIds);
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id) ?? null;
  const today = useEasternDayStart(true);
  const clearedIds = useNotificationsClearedStore((s) => s.ids);
  const clearedDay = useNotificationsClearedStore((s) => s.day);
  const clearedOwner = useNotificationsClearedStore((s) => s.owner);
  // CH-576: a buyer or publisher login sees only its own cap alerts (CH-335).
  // The AI insights and campaign caps describe the whole workspace.
  const partner = role === "buyer" || role === "publisher";

  return React.useMemo(() => {
    const cleared = activeCleared({ ids: clearedIds, day: clearedDay, owner: clearedOwner }, today, userId);
    const every: Raw[] = ([
      ...capAlerts.filter((a) => !partner || a.entityType !== "campaign").map((a) => {
        const item = capAlertToNotification(a, t);
        return { item, at: a.at, title: item.title };
      }),
      ...(partner ? [] : anomalies).map((a) => {
        const item = anomalyToNotification(a);
        return { item, at: a.detectedAt, title: item.title };
      }),
      ...(partner ? [] : recommendations).map((r) => ({
        item: recommendationToNotification(r),
        at: r.createdAt,
        action: r.impact?.value,
        title: r.title,
      })),
    ] as Raw[]).filter((r) => !cleared[r.item.id]);
    const raws = since ? every.filter((r) => r.at >= since) : every;
    const entries = buildFeed(raws, readIds, t);
    const isAlert = (r: Raw) => r.item.severity === "critical" || r.item.severity === "warn";
    const counts = {
      all: raws.length,
      alerts: raws.filter(isAlert).length,
      insights: raws.filter((r) => !isAlert(r)).length,
      read: raws.filter((r) => readIds[r.item.id]).length,
    };
    const unread = raws.length - counts.read;
    return { entries, counts, unread, allIds: raws.map((r) => r.item.id), everyId: every.map((r) => r.item.id) };
  }, [anomalies, recommendations, capAlerts, readIds, t, since, partner, today, userId, clearedIds, clearedDay, clearedOwner]);
}

/** CH-578: Clear All - hides what is showing now until 12 AM Eastern. The
 *  TFN notice is marked Seen as well, so it stops counting on the bell. */
export function useClearAllNotifications(ids: string[]) {
  const clear = useNotificationsClearedStore((s) => s.clear);
  const userId = useAuthStore((s) => s.user?.id) ?? null;
  return React.useCallback(() => {
    const tfns = useDeletedTfnsStore.getState();
    const tfnIds = [...tfns.numbers, ...tfns.kept].map((n) => `tfn:${n.id}`);
    clear([...ids, ...tfnIds], easternDayStart(), userId);
    if (tfns.unseenCount > 0) void tfns.markSeen().catch(() => undefined);
  }, [ids, clear, userId]);
}

/** CH-578: the TFN notice's numbers, without those cleared today. */
export function useVisibleDeletedTfns() {
  const numbers = useDeletedTfnsStore((s) => s.numbers);
  const kept = useDeletedTfnsStore((s) => s.kept);
  const userId = useAuthStore((s) => s.user?.id) ?? null;
  const today = useEasternDayStart(true);
  const ids = useNotificationsClearedStore((s) => s.ids);
  const day = useNotificationsClearedStore((s) => s.day);
  const owner = useNotificationsClearedStore((s) => s.owner);
  return React.useMemo(() => {
    const cleared = activeCleared({ ids, day, owner }, today, userId);
    const show = (n: { id: string }) => !cleared[`tfn:${n.id}`];
    return { numbers: numbers.filter(show), kept: kept.filter(show) };
  }, [numbers, kept, ids, day, owner, today, userId]);
}

/** "Today" / "Yesterday" / "Mon 3 Nov" for a day heading. */
export function dayLabel(at: number, t: (k: string) => string, locale: string): string {
  const d = new Date(at);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return t("x558.today");
  if (diff === 1) return t("x558.yesterday");
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/** Short time on the right: "1m", "3h", or the clock time for older ones. */
export function shortTime(at: number, locale: string): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 6 * 3600) return `${Math.floor(s / 3600)}h`;
  return new Date(at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

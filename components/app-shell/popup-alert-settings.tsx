"use client";

/**
 * "Pop-up alerts" — the switch list under the bell menu's Alerts tab that
 * decides which alert types may interrupt the operator with a banner at
 * the top of the screen. The list is the backend's catalogue
 * (GET /api/notifications/events), so new alert types show up here on
 * their own; the choices are saved per user via
 * PATCH /api/notifications/preferences.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { useAlertPreferencesStore } from "@/lib/store/alert-preferences-store";
import { cn } from "@/lib/utils";

/** The backend's alert types (notifications/models.py NotificationRule.Event); its labels are English. */
const EVENT_KEYS: Record<string, string> = {
  "call.missed": "x318.app.event.callMissed",
  "call.completed": "x318.app.event.callCompleted",
  "campaign.cap_reached": "x318.app.event.campaignCap",
  "buyer.cap_reached": "x318.app.event.buyerCap",
  "publisher.cap_reached": "x318.app.event.publisherCap",
  "low.balance": "x318.app.event.lowBalance",
  "campaign.paused": "x318.app.event.campaignPaused",
  "daily.summary": "x318.app.event.dailySummary",
  "call.started": "x318.app.event.newCall",
  "destination.cap_reached": "x318.app.event.destinationCap",
  "buyer.missed": "x318.app.event.buyerMissed",
  "aht.low": "x318.app.event.ahtLow",
  "number.deleted": "x318.app.event.numberDeleted",
  "autopilot.alert": "x318.app.event.autopilot",
  "number.not_working": "x318.app.event.numberNotWorking",
};

/** CH-558 (Sir's design): the switches in four groups. Types not listed here
 *  (a new one from the backend) go under System. */
const SECTIONS: Array<{ key: string; events: string[] }> = [
  { key: "calls", events: ["call.missed", "buyer.missed", "call.started", "call.completed"] },
  { key: "caps", events: ["campaign.cap_reached", "buyer.cap_reached", "publisher.cap_reached", "destination.cap_reached"] },
  { key: "account", events: ["low.balance", "daily.summary"] },
  { key: "system", events: [] },
];

export function PopupAlertSettings({ className }: { className?: string }) {
  const { t, locale } = useTranslation();
  // English keeps the backend's own label; other languages use ours for the types we know.
  const eventLabel = (e: { event: string; label: string }) =>
    locale !== "en" && EVENT_KEYS[e.event] ? t(EVENT_KEYS[e.event]) : e.label;
  const events = useAlertPreferencesStore((s) => s.events);
  const popupsEnabled = useAlertPreferencesStore((s) => s.popupsEnabled);
  const popupEvents = useAlertPreferencesStore((s) => s.popupEvents);
  const hydrated = useAlertPreferencesStore((s) => s.hydrated);
  const loading = useAlertPreferencesStore((s) => s.loading);
  const error = useAlertPreferencesStore((s) => s.error);
  const fetch = useAlertPreferencesStore((s) => s.fetch);
  const setPopupsEnabled = useAlertPreferencesStore((s) => s.setPopupsEnabled);
  const setEvent = useAlertPreferencesStore((s) => s.setEvent);

  // Re-read on open so another device's change shows up here.
  React.useEffect(() => {
    void fetch();
  }, [fetch]);

  const on = new Set(popupEvents);
  const onCount = events.filter((e) => on.has(e.event)).length;
  const known = new Set(SECTIONS.flatMap((s) => s.events));
  const sections = SECTIONS.map((sec) => ({
    key: sec.key,
    items:
      sec.key === "system"
        ? events.filter((e) => !known.has(e.event))
        : sec.events.map((ev) => events.find((e) => e.event === ev)).filter((e): e is (typeof events)[number] => !!e),
  })).filter((sec) => sec.items.length > 0);

  const guard = (p: Promise<void>) =>
    p.catch(() => toast.error(t("notificationsUI.popupPrefs.saveFailed")));

  return (
    <div className={cn("px-5 py-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold">{t("x558.popups.title")}</p>
        <span className="text-sm tabular-nums text-muted-foreground">
          {t("x558.popups.on").replace("{n}", String(popupsEnabled ? onCount : 0))}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("x558.popups.desc")}</p>

      {!popupsEnabled && events.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">{t("x558.popups.off")}</span>
          <Switch checked={false} onCheckedChange={(v) => guard(setPopupsEnabled(v))} aria-label={t("notificationsUI.popupPrefs.master")} />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {!hydrated && loading && events.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("notificationsUI.popupPrefs.loading")}
        </div>
      ) : events.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("notificationsUI.popupPrefs.empty")}</p>
      ) : (
        <div className={cn("mt-2", !popupsEnabled && "opacity-50")}>
          {sections.map((sec) => (
            <div key={sec.key} className="mt-4">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t(`x558.popups.section.${sec.key}`)}
              </p>
              <ul>
                {sec.items.map((e) => {
                  const checked = on.has(e.event);
                  const id = `popup-pref-${e.event}`;
                  return (
                    <li key={e.event}>
                      <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-2">
                        <span className={cn("text-[15px]", checked ? "text-foreground" : "text-foreground/85")}>{eventLabel(e)}</span>
                        <Switch
                          id={id}
                          checked={checked}
                          disabled={!popupsEnabled}
                          onCheckedChange={(v) => guard(setEvent(e.event, v))}
                          aria-label={eventLabel(e)}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

/** Colour dot by what the event is about — same family as the Alerts chips. */
function dotFor(event: string): string {
  if (event.includes("missed") || event.includes("no_answer")) return "bg-[#EF4444]";
  if (event.includes("cap")) return "bg-[#F97316]";
  if (event.includes("aht")) return "bg-[#FACC15]";
  if (event.includes("balance")) return "bg-[color:var(--success)]";
  return "bg-muted-foreground";
}

export function PopupAlertSettings({ className }: { className?: string }) {
  const { t } = useTranslation();
  const events = useAlertPreferencesStore((s) => s.events);
  const popupsEnabled = useAlertPreferencesStore((s) => s.popupsEnabled);
  const popupEvents = useAlertPreferencesStore((s) => s.popupEvents);
  const hydrated = useAlertPreferencesStore((s) => s.hydrated);
  const loading = useAlertPreferencesStore((s) => s.loading);
  const error = useAlertPreferencesStore((s) => s.error);
  const fetch = useAlertPreferencesStore((s) => s.fetch);
  const setPopupsEnabled = useAlertPreferencesStore((s) => s.setPopupsEnabled);
  const setEvent = useAlertPreferencesStore((s) => s.setEvent);
  const setAllEvents = useAlertPreferencesStore((s) => s.setAllEvents);

  // Re-read on open so another device's change shows up here.
  React.useEffect(() => {
    void fetch();
  }, [fetch]);

  const on = new Set(popupEvents);
  const onCount = events.filter((e) => on.has(e.event)).length;
  const allOn = events.length > 0 && onCount === events.length;

  const guard = (p: Promise<void>) =>
    p.catch(() => toast.error(t("notificationsUI.popupPrefs.saveFailed")));

  return (
    <div className={cn("px-4 py-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">{t("notificationsUI.popupPrefs.title")}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {t("notificationsUI.popupPrefs.description")}
          </p>
        </div>
        <Switch
          checked={popupsEnabled}
          onCheckedChange={(v) => guard(setPopupsEnabled(v))}
          aria-label={t("notificationsUI.popupPrefs.master")}
          className="mt-0.5 shrink-0"
        />
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-destructive">{error}</p>
      )}

      {!hydrated && loading && events.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("notificationsUI.popupPrefs.loading")}
        </div>
      ) : events.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {t("notificationsUI.popupPrefs.empty")}
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {t("notificationsUI.popupPrefs.onCount")
                .replace("{on}", String(onCount))
                .replace("{total}", String(events.length))}
            </span>
            <button
              type="button"
              onClick={() => guard(setAllEvents(!allOn))}
              disabled={!popupsEnabled}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
            >
              {allOn ? t("notificationsUI.popupPrefs.allOff") : t("notificationsUI.popupPrefs.allOn")}
            </button>
          </div>

          <ul className={cn("mt-1 space-y-0.5", !popupsEnabled && "opacity-50")}>
            {events.map((e) => {
              const checked = on.has(e.event);
              const id = `popup-pref-${e.event}`;
              return (
                <li key={e.event}>
                  <label
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/40"
                  >
                    <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotFor(e.event))} />
                    <span className={cn("min-w-0 flex-1 text-xs", checked ? "text-foreground" : "text-muted-foreground")}>
                      {e.label}
                    </span>
                    <Switch
                      id={id}
                      checked={checked}
                      disabled={!popupsEnabled}
                      onCheckedChange={(v) => guard(setEvent(e.event, v))}
                      aria-label={e.label}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

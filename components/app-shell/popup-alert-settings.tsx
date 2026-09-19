"use client";

/**
 * "Pop-up alerts" — the switch list under the bell menu's Alerts tab that
 * decides which alert kinds may interrupt the operator with a banner at the
 * top of the screen. Everything still lands in the bell list; this only
 * controls the banner.
 */

import * as React from "react";

import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import {
  POPUP_ALERT_KINDS,
  useAlertPreferencesStore,
  type PopupAlertKind,
} from "@/lib/store/alert-preferences-store";
import { cn } from "@/lib/utils";

/** Colour dot per kind — same family as the Alerts sub-chips. */
const KIND_DOT: Record<PopupAlertKind, string> = {
  capNear: "bg-[#FACC15]",
  destinationCapOver: "bg-[#F97316]",
  buyerCapOver: "bg-[#F97316]",
  campaignCapOver: "bg-[#F97316]",
  lowAht: "bg-[#FACC15]",
  buyerMissed: "bg-[#EF4444]",
  other: "bg-muted-foreground",
};

export function PopupAlertSettings({ className }: { className?: string }) {
  const { t } = useTranslation();
  const popups = useAlertPreferencesStore((s) => s.popups);
  const setPopup = useAlertPreferencesStore((s) => s.setPopup);
  const setAllPopups = useAlertPreferencesStore((s) => s.setAllPopups);

  const onCount = POPUP_ALERT_KINDS.filter((k) => popups[k]).length;
  const allOn = onCount === POPUP_ALERT_KINDS.length;

  return (
    <div className={cn("px-4 py-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">{t("notificationsUI.popupPrefs.title")}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {t("notificationsUI.popupPrefs.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAllPopups(!allOn)}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          {allOn ? t("notificationsUI.popupPrefs.allOff") : t("notificationsUI.popupPrefs.allOn")}
        </button>
      </div>

      <ul className="mt-3 space-y-1">
        {POPUP_ALERT_KINDS.map((kind) => {
          const on = popups[kind];
          const id = `popup-pref-${kind}`;
          return (
            <li key={kind}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/40"
              >
                <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", KIND_DOT[kind])} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-xs", on ? "text-foreground" : "text-muted-foreground")}>
                    {t(`notificationsUI.popupPrefs.kinds.${kind}.label`)}
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {t(`notificationsUI.popupPrefs.kinds.${kind}.hint`)}
                  </span>
                </span>
                <Switch
                  id={id}
                  checked={on}
                  onCheckedChange={(v) => setPopup(kind, v)}
                  aria-label={t(`notificationsUI.popupPrefs.kinds.${kind}.label`)}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

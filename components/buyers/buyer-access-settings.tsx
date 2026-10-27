"use client";

/**
 * Buyer access — the same layout as a publisher's settings:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ Buyer name               [Timezone select]   │
 *   │ Manage access for this buyer                 │
 *   ├──────────── MEMBERS ─────────────────────────┤
 *   ├──────────── PERMISSIONS ─────────────────────┤  Block Numbers, Download Reports
 *   ├──────────── REPORTING VISIBILITY ────────────┤
 *   └─────────────────────────────────────────────┘
 *
 * Publisher-only permissions (Manage Traffic, Number Creation, Audio
 * Recording) are left out on purpose. Every change saves at once, like the
 * publisher screen - no Save button needed for this part.
 *
 * Used on the buyer's Settings tab and in the Edit buyer dialog.
 */

import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

import { BuyerMembersCard } from "@/components/buyers/buyer-members-card";
import { PartnerPermissions, PartnerReportingVisibility } from "@/components/network/partner-access-sections";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName } from "@/lib/i18n/local-name";
import {
  emptyBuyerAccess,
  useBuyerAccessStore,
} from "@/lib/store/buyer-access-store";
import { usePartnerSettingsStore } from "@/lib/store/partner-settings-store";
import { TIMEZONES } from "@/lib/store/publisher-access-store";
import { localizedTimezoneLabel } from "@/lib/timezones";
import { uiLocaleTag } from "@/lib/format";
import type { Buyer } from "@/lib/types";

interface Props {
  buyer: Buyer;
  /** Inside a dialog: no outer card, tighter spacing. */
  embedded?: boolean;
}

export function BuyerAccessSettings({ buyer, embedded = false }: Props) {
  const { t } = useTranslation();

  // Time zone (permissions are in <PartnerPermissions> below)
  const access = useBuyerAccessStore((s) => s.byBuyer[buyer.id]) ?? emptyBuyerAccess();
  const serverBacked = useBuyerAccessStore((s) => s.serverBacked[buyer.id]);
  const fetchAccess = useBuyerAccessStore((s) => s.fetchAccess);
  const setTimezone = useBuyerAccessStore((s) => s.setTimezone);

  // The time zone is also kept in the partner settings (the same place as
  // Permissions and Reporting visibility), and that copy wins when the server
  // has one - the /access copy kept coming back as UTC.
  const serverTimezone = usePartnerSettingsStore((s) => s.byPartner[`buyer:${buyer.id}`]?.timezone);
  const fetchPartnerSettings = usePartnerSettingsStore((s) => s.fetchSettings);
  const savePartnerTimezone = usePartnerSettingsStore((s) => s.setTimezone);

  React.useEffect(() => {
    void fetchAccess(buyer.id);
    void fetchPartnerSettings("buyer", buyer.id);
  }, [buyer.id, fetchAccess, fetchPartnerSettings]);

  const timezone = serverTimezone ?? access.timezone;

  const onTimezone = async (tz: string) => {
    // Saved in both places; the partner settings copy is best-effort until the
    // backend stores it there.
    void savePartnerTimezone("buyer", buyer.id, tz).catch(() => undefined);
    try {
      await setTimezone(buyer.id, tz);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("buyerAccess.saveFailed"));
    }
  };

  const body = (
    <>
      {serverBacked === false && (
        <div className="flex items-start gap-2.5 rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
          <p className="text-muted-foreground">{t("buyerAccess.localOnly")}</p>
        </div>
      )}

      {/* Header: name + time zone */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={embedded ? "text-base font-semibold tracking-tight" : "text-xl font-semibold tracking-tight"}>
              <LocalName name={buyer.name} />
            </h2>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("buyerAccess.manage")}</p>
        </div>
        <Select value={timezone} onValueChange={(v) => void onTimezone(v)}>
          <SelectTrigger className="w-full sm:w-72" aria-label={t("buyerAccess.timezone")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {localizedTimezoneLabel(tz.value, tz.label, uiLocaleTag())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Members (same table as publishers: Invited / Registered) */}
      <BuyerMembersCard buyer={buyer} />

      {/* Permissions: Block Numbers, Download Reports. Saved through the
          partner settings endpoint - the one store the backend now enforces
          (the old Buyer booleans are only mirrors of it). */}
      <PartnerPermissions
        kind="buyer"
        id={buyer.id}
        only={["block_numbers", "download_reports"]}
        title={t("buyerAccess.permissionsTitle")}
        description={t("buyerAccess.permissionsDesc")}
        toggleAria="{label}"
      />

      {/* Reporting visibility: which columns this buyer's OWN login sees.
          Saved to the field the buyer's login reads, so unticking a column
          hides it for the buyer. The admin's Reports are never affected. */}
      <PartnerReportingVisibility
        kind="buyer"
        id={buyer.id}
        idPrefix={`brv-${embedded ? "d" : "t"}`}
        title={t("buyerAccess.reportingTitle")}
        description={t("buyerAccess.reportingDesc")}
      />
    </>
  );

  if (embedded) return <div className="space-y-4">{body}</div>;
  return <Card className="space-y-6 p-6">{body}</Card>;
}
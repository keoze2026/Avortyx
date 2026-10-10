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
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import {
  BUYER_PERMISSIONS,
  emptyBuyerAccess,
  useBuyerAccessStore,
  type BuyerPermissionKey,
} from "@/lib/store/buyer-access-store";
import {
  REPORTING_COLUMNS,
  useBuyerReportingStore,
  type ReportingVisibility,
} from "@/lib/store/buyer-reporting-store";
import { TIMEZONES } from "@/lib/store/publisher-access-store";
import type { Buyer } from "@/lib/types";

const ALL_COLUMNS_ON: ReportingVisibility = {
  incoming: true,
  connected: true,
  qualified: true,
  converted: true,
  notConnected: true,
  acl: true,
  tcl: true,
  cost: true,
};

interface Props {
  buyer: Buyer;
  /** Inside a dialog: no outer card, tighter spacing. */
  embedded?: boolean;
}

export function BuyerAccessSettings({ buyer, embedded = false }: Props) {
  const { t } = useTranslation();

  // Time zone + permissions
  const access = useBuyerAccessStore((s) => s.byBuyer[buyer.id]) ?? emptyBuyerAccess();
  const serverBacked = useBuyerAccessStore((s) => s.serverBacked[buyer.id]);
  const fetchAccess = useBuyerAccessStore((s) => s.fetchAccess);
  const setTimezone = useBuyerAccessStore((s) => s.setTimezone);
  const togglePermission = useBuyerAccessStore((s) => s.togglePermission);

  // Reporting visibility (already saved on the server)
  const reporting = useBuyerReportingStore((s) => s.byBuyer[buyer.id]) ?? ALL_COLUMNS_ON;
  const fetchReporting = useBuyerReportingStore((s) => s.fetchReporting);
  const toggleReportingColumn = useBuyerReportingStore((s) => s.toggleReportingColumn);

  React.useEffect(() => {
    void fetchAccess(buyer.id);
    void fetchReporting(buyer.id);
  }, [buyer.id, fetchAccess, fetchReporting]);

  const onToggle = async (key: BuyerPermissionKey) => {
    try {
      await togglePermission(buyer.id, key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("buyerAccess.saveFailed"));
    }
  };
  const onTimezone = async (tz: string) => {
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
              {buyer.name}
            </h2>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("buyerAccess.manage")}</p>
        </div>
        <Select value={access.timezone} onValueChange={(v) => void onTimezone(v)}>
          <SelectTrigger className="w-full sm:w-72" aria-label={t("buyerAccess.timezone")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Members (same table as publishers: Invited / Registered) */}
      <BuyerMembersCard buyer={buyer} />

      {/* Permissions: Block Numbers, Download Reports */}
      <Section title={t("buyerAccess.permissionsTitle")} description={t("buyerAccess.permissionsDesc")}>
        <ul className="divide-y divide-border">
          {BUYER_PERMISSIONS.map((p) => {
            const label = t(p.labelKey);
            return (
              <li key={p.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium leading-tight">{label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t(p.descriptionKey)}</div>
                </div>
                <Switch
                  checked={!!access.permissions[p.key]}
                  onCheckedChange={() => void onToggle(p.key)}
                  aria-label={label}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Reporting visibility */}
      <Section
        title={t("buyerAccess.reportingTitle")}
        description={t("buyerAccess.reportingDesc")
          .replace("{visible}", String(REPORTING_COLUMNS.filter((c) => reporting[c.key]).length))
          .replace("{total}", String(REPORTING_COLUMNS.length))}
      >
        <ul className="grid grid-cols-1 gap-1 px-2 py-2 sm:grid-cols-2">
          {REPORTING_COLUMNS.map((col) => {
            const id = `brv-${embedded ? "d" : "t"}-${col.key}`;
            return (
              <li key={col.key}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-secondary/40"
                >
                  <Checkbox
                    id={id}
                    checked={!!reporting[col.key]}
                    onCheckedChange={() => void toggleReportingColumn(buyer.id, col.key)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">{t(col.labelKey)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t(col.descriptionKey)}</div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );

  if (embedded) return <div className="space-y-4">{body}</div>;
  return <Card className="space-y-6 p-6">{body}</Card>;
}

/* Same sub-card shell as the publisher settings. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background/30">
      <header className="px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

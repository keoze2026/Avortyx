"use client";

import { useMemo, useState } from "react";
import { Hash, Pencil, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";

import { AttachTrackingNumberDialog } from "@/components/campaigns/settings/attach-tracking-number-dialog";
import { TrackingNumberEditDialog } from "@/components/campaigns/settings/tracking-number-edit-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { formatCurrency, toE164 } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TrackingNumbersSection({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  // Stable selector + useMemo to avoid the new-ref-per-render Zustand loop.
  const allNumbers = useNumbersStore((s) => s.numbers);
  const setNumberStatus = useNumbersStore((s) => s.setNumberStatus);
  const updateNumber = useNumbersStore((s) => s.updateNumber);
  const numbers = useMemo(
    () => (allNumbers ?? []).filter((n) => n.campaignId === campaignId),
    [allNumbers, campaignId],
  );

  // The id of the tracking number currently being edited in the dialog.
  // `null` keeps the dialog closed.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Controls the "Add tracking number" dialog. Two modes: pick from existing
  // unassigned inventory, or buy a fresh one — both auto-attach to this
  // campaign so the user never re-picks a campaign they're already editing.
  const [attachOpen, setAttachOpen] = useState(false);

  const handleDetach = (id: string, label: string) => {
    // Detaching = clear the campaign link so the number drops out of this
    // section. We don't delete the number itself.
    updateNumber(id, { campaignId: undefined, campaignName: undefined });
    toast.success(
      t("trafficUI.campaigns.settings.trackingNumbers.toast.detached").replace(
        "{number}",
        label,
      ),
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider">{t("trafficUI.campaigns.settings.trackingNumbers.title")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("trafficUI.campaigns.settings.trackingNumbers.description")}
          </p>
        </div>
        <Button size="sm" onClick={() => setAttachOpen(true)}>
          <Plus className="h-4 w-4" /> {t("trafficUI.campaigns.settings.trackingNumbers.add")}
        </Button>
      </div>

      {numbers.length === 0 ? (
        <EmptyState
          icon={Hash}
          tone="violet"
          title={t("trafficUI.campaigns.settings.trackingNumbers.empty.title")}
          description={t("trafficUI.campaigns.settings.trackingNumbers.empty.description")}
          actions={
            <Button size="sm" onClick={() => setAttachOpen(true)}>
              <Plus className="h-4 w-4" /> {t("trafficUI.campaigns.settings.trackingNumbers.addTracking")}
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 uppercase tracking-wider text-[11px]">{t("trafficUI.campaigns.settings.trackingNumbers.headers.number")}</TableHead>
                <TableHead className="uppercase tracking-wider text-[11px]">{t("trafficUI.campaigns.settings.trackingNumbers.headers.type")}</TableHead>
                <TableHead className="uppercase tracking-wider text-[11px]">{t("trafficUI.campaigns.settings.trackingNumbers.headers.name")}</TableHead>
                <TableHead className="uppercase tracking-wider text-[11px]">{t("trafficUI.campaigns.settings.trackingNumbers.headers.publisher")}</TableHead>
                <TableHead className="uppercase tracking-wider text-[11px]">{t("trafficUI.campaigns.settings.trackingNumbers.headers.payout")}</TableHead>
                <TableHead className="text-center uppercase tracking-wider text-[11px]">{t("trafficUI.campaigns.settings.trackingNumbers.headers.status")}</TableHead>
                <TableHead className="pr-6 text-center uppercase tracking-wider text-[11px]">{t("trafficUI.campaigns.settings.trackingNumbers.headers.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((n) => {
                const e164 = toE164(n.number);
                return (
                  <TableRow key={n.id}>
                    <TableCell className="pl-6 font-mono text-xs whitespace-nowrap">
                      {e164}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {n.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{n.label ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {n.vendor ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {formatCurrency(n.payoutPerCall ?? 0, true)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch className="data-[state=checked]:bg-accent"
                        checked={n.status === "active"}
                        onCheckedChange={(v) => {
                          setNumberStatus(n.id, v ? "active" : "paused");
                          toast.success(
                            v
                              ? t("trafficUI.campaigns.settings.trackingNumbers.toast.activated").replace("{number}", e164)
                              : t("trafficUI.campaigns.settings.trackingNumbers.toast.paused").replace("{number}", e164),
                          );
                        }}
                        aria-label={t("trafficUI.numbers.pools.toggle").replace("{name}", e164)}
                      />
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <RowActionIcon
                          icon={Pencil}
                          label={t(
                            "trafficUI.campaigns.settings.trackingNumbers.row.edit",
                          ).replace("{number}", e164)}
                          onClick={() => setEditingId(n.id)}
                        />
                        <RowActionIcon
                          icon={Unlink}
                          label={t(
                            "trafficUI.campaigns.settings.trackingNumbers.row.detach",
                          ).replace("{number}", e164)}
                          tone="destructive"
                          onClick={() => handleDetach(n.id, e164)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit dialog — opens when a row's pencil icon is clicked. */}
      <TrackingNumberEditDialog
        numberId={editingId}
        onOpenChange={(open) => !open && setEditingId(null)}
      />

      {/* Two-mode picker — attach an already-bought number OR buy a fresh
          one from the carrier. Both paths route the result to this campaign
          so it shows up in the table above without a refresh. */}
      <AttachTrackingNumberDialog
        campaignId={campaignId}
        open={attachOpen}
        onOpenChange={setAttachOpen}
      />
    </section>
  );
}

/**
 * Single icon-button used in the row Actions cell. Mirrors the muted /
 * destructive tone pattern used by the destinations + buyers tables so the
 * row actions look identical across surfaces.
 */
function RowActionIcon({
  icon: Icon,
  label,
  onClick,
  tone = "muted",
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  tone?: "muted" | "destructive";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        tone === "destructive"
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
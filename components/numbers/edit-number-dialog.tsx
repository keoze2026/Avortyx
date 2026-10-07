"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { toE164 } from "@/lib/format";
import type { NumberStatus, TrackingNumber } from "@/lib/types";

import { deriveAllocated, deriveName } from "./track-numbers-table";
import { carriersService, type Carrier } from "@/lib/api/services/numbers.service";

interface Props {
  number: TrackingNumber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNASSIGNED = "__none";

export function EditNumberDialog({ number, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const updateNumber = useNumbersStore((s) => s.updateNumber);

  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState<string>(UNASSIGNED);
  const [allocated, setAllocated] = useState<number>(0);
  const [status, setStatus] = useState<NumberStatus>("active");
  const [carrierId, setCarrierId] = useState<string>(UNASSIGNED);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Seed form whenever the dialog opens on a new row. "Allocated" maps to
  // `allocatedCapacity` — that's what the table column reads via
  // deriveAllocated, so we must read AND write the same field, not dailyCap.
  useEffect(() => {
    if (!number) return;
    setName(number.label ?? deriveName(number));
    setCampaignId(number.campaignId ?? UNASSIGNED);
    setAllocated(number.allocatedCapacity ?? deriveAllocated(number));
    setStatus(number.status);
    setCarrierId(number.carrierId ?? UNASSIGNED);
  }, [number]);

  // The carrier list is short and changes rarely, so it is fetched when the
  // dialog opens rather than held in a store. A failure leaves the select
  // empty instead of blocking the rest of the form.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    carriersService
      .list()
      .then((rows) => {
        if (!cancelled) setCarriers(rows.filter((c) => c.isActive));
      })
      .catch(() => {
        if (!cancelled) setCarriers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!number) return null;

  const onSubmit = async () => {
    setSubmitting(true);
    const campaign =
      campaignId !== UNASSIGNED ? campaigns.find((c) => c.id === campaignId) : undefined;
    // Pass the trimmed label as-is (even empty) so a clear becomes
    // `label: ""` on the wire rather than `undefined` (which the service
    // would silently drop, making the save look like a revert).
    const labelValue = name.trim();
    // Let 0 through — it's a valid "disabled" allocation. The previous
    // `> 0` guard collapsed user intent to clear into `undefined`.
    const allocatedValue = Number.isFinite(allocated) ? allocated : undefined;
    try {
      // Await the backend round-trip so a 4xx surfaces as a toast.error
      // and the dialog stays open instead of optimistically lying.
      await updateNumber(number.id, {
        label: labelValue,
        campaignId: campaign?.id,
        campaignName: campaign?.name,
        allocatedCapacity: allocatedValue,
        status,
        // Empty string clears it; the service sends it either way so a clear
        // is not mistaken for "leave as it was".
        carrierId: carrierId === UNASSIGNED ? "" : carrierId,
      });
      toast.success(
        t("trafficUI.numbers.track.editDialog.saved").replace("{number}", toE164(number.number)),
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save number");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Pencil className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("trafficUI.numbers.track.editDialog.title")}</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{toE164(number.number)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-num-name">
              {t("trafficUI.numbers.track.editDialog.labelName")}
            </Label>
            <Input
              id="edit-num-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={deriveName(number)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("trafficUI.numbers.track.editDialog.labelCampaign")}</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>
                  {t("trafficUI.numbers.track.editDialog.unassigned")}
                </SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("trafficUI.numbers.track.editDialog.labelCarrier")}</Label>
            <Select value={carrierId} onValueChange={setCarrierId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>
                  {t("trafficUI.numbers.track.editDialog.carrierNone")}
                </SelectItem>
                {carriers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-num-allocated">
                {t("trafficUI.numbers.track.editDialog.labelAllocated")}
              </Label>
              <Input
                id="edit-num-allocated"
                type="number"
                min={0}
                step={50}
                value={allocated}
                onChange={(e) => setAllocated(Math.max(0, parseInt(e.target.value) || 0))}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("trafficUI.numbers.track.editDialog.labelStatus")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as NumberStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    {t("trafficUI.numbers.track.editDialog.statusActive")}
                  </SelectItem>
                  <SelectItem value="paused">
                    {t("trafficUI.numbers.track.editDialog.statusPaused")}
                  </SelectItem>
                  <SelectItem value="pending">
                    {t("trafficUI.numbers.track.editDialog.statusPending")}
                  </SelectItem>
                  <SelectItem value="expired">
                    {t("trafficUI.numbers.track.editDialog.statusExpired")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("trafficUI.common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                {t("trafficUI.numbers.track.editDialog.saving")}
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />{" "}
                {t("trafficUI.numbers.track.editDialog.save")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

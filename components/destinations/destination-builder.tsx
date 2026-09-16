"use client";

import { useEffect, useState } from "react";
import { Loader2, Target } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { toE164 } from "@/lib/format";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import type { Destination } from "@/lib/types";

interface DestinationBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog opens in edit mode for this destination. */
  editId?: string;
}

interface FormState {
  name: string;
  tfn: string;
  buyerId: string;
  concurrencyCap: number;
  dailyCap: number;
  monthlyCap: number;
  enabled: boolean;
}

const EMPTY: FormState = {
  name: "",
  tfn: "",
  // buyerId is seeded from the real buyers store inside the component once
  // it's hydrated — empty string here means "no selection yet".
  buyerId: "",
  concurrencyCap: 10,
  dailyCap: 100,
  monthlyCap: 2500,
  enabled: true,
};

/**
 * Loose TFN check — accepts the formats we generate elsewhere (e.g.
 * "+15551234567") plus pasted variants. Anything with at least 7 digits
 * passes; the form normalizes by trim only.
 */
function isValidTfn(s: string) {
  return (s.match(/\d/g)?.length ?? 0) >= 7;
}

export function DestinationBuilder({
  open,
  onOpenChange,
  editId,
}: DestinationBuilderProps) {
  const { t } = useTranslation();
  const add = useDestinationsStore((s) => s.add);
  const update = useDestinationsStore((s) => s.update);
  const existing = useDestinationsStore((s) =>
    editId ? s.destinations.find((d) => d.id === editId) : undefined,
  );

  const isEdit = !!existing;
  // Real buyers hydrated by StoreHydrator on app mount. The dropdown reads
  // from this — using mock IDs would result in a 500 on POST because the
  // FK lookup against the real backend would fail.
  const buyers = useBuyersStore((s) => s.buyers);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  // Seed form when the dialog opens (and when switching between create/edit).
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        name: existing.name,
        tfn: existing.tfn,
        buyerId: existing.buyerId,
        concurrencyCap: existing.concurrencyCap,
        dailyCap: existing.dailyCap,
        monthlyCap: existing.monthlyCap,
        enabled: existing.enabled,
      });
    } else {
      // Open with no buyer pre-selected — operator can pick one or skip.
      setForm(EMPTY);
    }
  }, [open, existing]);

  // Buyer is OPTIONAL — operators can create an unassigned destination and
  // attach a buyer later. Backend must accept a null / empty buyer_id.
  const canSubmit =
    form.name.trim().length >= 2 &&
    isValidTfn(form.tfn) &&
    form.concurrencyCap > 0;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const payload: Omit<Destination, "id"> = {
      name: form.name.trim(),
      tfn: toE164(form.tfn.trim()),
      buyerId: form.buyerId,
      concurrencyCap: form.concurrencyCap,
      dailyCap: form.dailyCap,
      monthlyCap: form.monthlyCap,
      enabled: form.enabled,
      liveCalls: 0,
      hourlyCalls: 0,
      dailyCalls: 0,
      monthlyCalls: 0,
      globalCalls: 0,
      hourlyRevenue: 0,
      dailyRevenue: 0,
      monthlyRevenue: 0,
      globalRevenue: 0,
      hourlySpend: 0,
      dailySpend: 0,
      monthlySpend: 0,
      globalSpend: 0,
    };

    try {
      if (existing) {
        await update(existing.id, payload);
        toast.success(t("networkUI.destinations.toast.updated").replace("{name}", payload.name));
      } else {
        const created = await add(payload);
        toast.success(t("networkUI.destinations.toast.created").replace("{name}", created.name));
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't save destination."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
              <Target className="h-4 w-4" />
            </span>
            {isEdit ? t("networkUI.destinations.builder.titleEdit") : t("networkUI.destinations.builder.titleNew")}
          </DialogTitle>
          <DialogDescription>
            {t("networkUI.destinations.builder.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="dest-name">{t("networkUI.destinations.builder.name")}</Label>
            <Input
              id="dest-name"
              placeholder={t("networkUI.destinations.builder.namePh")}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="dest-tfn">{t("networkUI.destinations.builder.tfnLabel")}</Label>
            <Input
              id="dest-tfn"
              placeholder={t("networkUI.destinations.builder.tfnPh")}
              value={form.tfn}
              onChange={(e) => setForm((f) => ({ ...f, tfn: e.target.value }))}
              className="font-mono"
            />
            {form.tfn.length > 0 && !isValidTfn(form.tfn) && (
              <p className="text-xs text-destructive">
                {t("networkUI.destinations.builder.tfnError")}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="dest-buyer">
              {t("networkUI.destinations.builder.buyer")}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">
                (optional — assign later)
              </span>
            </Label>
            <Select
              value={form.buyerId || "__none__"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, buyerId: v === "__none__" ? "" : v }))
              }
            >
              <SelectTrigger id="dest-buyer">
                <SelectValue placeholder="No buyer assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No buyer (assign later)</SelectItem>
                {buyers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {buyers.length === 0 && (
              <p className="text-[10px] text-muted-foreground">
                No buyers yet. You can create the destination now and attach a
                buyer on the Buyers page later.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="dest-cc">{t("networkUI.destinations.builder.concurrencyCap")}</Label>
              <Input
                id="dest-cc"
                type="number"
                min={1}
                value={form.concurrencyCap}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    concurrencyCap: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dest-daily">{t("networkUI.destinations.builder.dailyCap")}</Label>
              <Input
                id="dest-daily"
                type="number"
                min={0}
                value={form.dailyCap}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    dailyCap: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dest-monthly">{t("networkUI.destinations.builder.monthlyCap")}</Label>
              <Input
                id="dest-monthly"
                type="number"
                min={0}
                value={form.monthlyCap}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    monthlyCap: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {t("networkUI.destinations.builder.zeroHint")} <span className="font-mono">0</span> {t("networkUI.destinations.builder.zeroHintRest")}
          </p>

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
            <div>
              <div className="text-sm font-medium">{t("networkUI.destinations.builder.enabled")}</div>
              <div className="text-xs text-muted-foreground">
                {t("networkUI.destinations.builder.enabledDesc")}
              </div>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("networkUI.destinations.builder.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEdit ? t("networkUI.destinations.builder.saving") : t("networkUI.destinations.builder.creating")}
              </>
            ) : isEdit ? (
              t("networkUI.destinations.builder.save")
            ) : (
              t("networkUI.destinations.builder.create")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

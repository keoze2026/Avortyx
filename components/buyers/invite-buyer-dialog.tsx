"use client";

/**
 * Create-buyer dialog — adds a buyer record (routing target) to the network.
 *
 * NOTE: this used to be framed as "Invite a buyer / they'll get a setup link"
 * which was misleading — sending an email invite is a separate, optional
 * follow-up action on the buyer detail page. This dialog now only creates
 * the buyer record; email is captured up-front but never sent here.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/lib/constants";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useTranslation } from "@/hooks/use-translation";

export function InviteBuyerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const add = useBuyersStore((s) => s.add);

  const [name, setName] = useState("");
  const [bidAmount, setBidAmount] = useState(35);
  const [dailyCap, setDailyCap] = useState(200);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setBidAmount(35);
    setDailyCap(200);
    setDescription("");
    setSubmitting(false);
  };
  const onClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  // Backend schema requires the buyer name to be at least 2 characters.
  // (Organization used to be a separate field but the backend now derives
  // it server-side from the workspace context — read-only on responses,
  // not accepted in request bodies. So no FE input or validation for it.)
  const trimmedName = name.trim();
  const nameTooShort = trimmedName.length > 0 && trimmedName.length < 2;
  const canSubmit = trimmedName.length >= 2;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await add({
        name: trimmedName,
        // Organization is read-only — the backend fills it in from the
        // workspace context and echoes it on the response. The empty
        // placeholder here gets overwritten via the store's wire mapper
        // as soon as the create response lands.
        organization: "",
        description: description.trim() || undefined,
        status: "pending",
        bidAmount,
        payoutModel: "flat",
        // 0 = unlimited on the backend. Hardcoding 10 here meant every new
        // buyer was born pinched at 10 concurrent calls, and nobody knew the
        // limit existed until their traffic hit it (TBLA, then PDSO).
        concurrencyCap: 0,
        dailyCap,
        monthlyCap: dailyCap * 25,
        callsToday: 0,
        callsMonth: 0,
        spendToday: 0,
        spendMonth: 0,
        lifetimeSpend: 0,
        liveCalls: 0,
        hourlyCalls: 0,
        globalCalls: 0,
        hourlySpend: 0,
        acceptRate: 0,
        conversionRate: 0,
        campaignIds: [],
      });
      toast.success(t("y.ibd.added").replace("{name}", created.name), {
        description: t("y.ibd.addedHint"),
      });
      onClose(false);
      router.push(`${ROUTES.buyers}/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.ibd.createFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.74_0.18_155)]/15 text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("y.ibd.title")}</DialogTitle>
              <DialogDescription>
                {t("y.ibd.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="ib-name">{t("y.ibd.name")}</Label>
            <Input
              id="ib-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("y.ibd.namePlaceholder")}
              aria-invalid={nameTooShort || undefined}
            />
            {nameTooShort && (
              <p className="text-xs text-destructive">
                {t("y.ibd.nameTooShort")}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ib-bid">{t("y.ibd.bid")}</Label>
              <Input
                id="ib-bid"
                type="number"
                min={0}
                step="0.5"
                value={bidAmount}
                onChange={(e) => setBidAmount(parseFloat(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ib-cap">{t("y.ibd.dailyCap")}</Label>
              <Input
                id="ib-cap"
                type="number"
                min={0}
                value={dailyCap}
                onChange={(e) => setDailyCap(parseInt(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ib-desc">{t("y.ibd.notes")}</Label>
            <Textarea
              id="ib-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("y.ibd.notesPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            {t("y.common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("y.common.creating")}
              </>
            ) : (
              t("y.ibd.create")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

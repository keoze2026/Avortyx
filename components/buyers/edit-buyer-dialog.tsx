"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import { BuyerAccessSettings } from "@/components/buyers/buyer-access-settings";
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
import { useTranslation } from "@/hooks/use-translation";
import { useBuyersStore } from "@/lib/store/buyers-store";

interface EditBuyerDialogProps {
  /** The buyer to edit. `null` keeps the dialog closed. */
  buyerId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function EditBuyerDialog({ buyerId, onOpenChange }: EditBuyerDialogProps) {
  const { t } = useTranslation();
  const buyers = useBuyersStore((s) => s.buyers);
  const update = useBuyersStore((s) => s.update);
  const updateCap = useBuyersStore((s) => s.updateCap);

  const buyer = buyerId ? buyers.find((b) => b.id === buyerId) : null;

  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [bidAmount, setBidAmount] = useState(35);
  const [dailyCap, setDailyCap] = useState(200);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync local form state when a new buyer is selected
  useEffect(() => {
    if (!buyer) return;
    setName(buyer.name);
    setOrganization(buyer.organization);
    setContactName(buyer.contactName ?? "");
    setEmail(buyer.email ?? "");
    setBidAmount(buyer.bidAmount);
    setDailyCap(buyer.dailyCap);
    setDescription(buyer.description ?? "");
  }, [buyer]);

  const onSubmit = async () => {
    if (!buyer || !name.trim()) return;
    setSubmitting(true);
    try {
      // Backend's PATCH now accepts contact name + contact email (wire
      // field `contact_email`, FE-side `email`) alongside name + description
      // + payoutAmount.
      await update(buyer.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        bidAmount,
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
      });
      // Caps go through the dedicated cap endpoint.
      if (dailyCap !== buyer.dailyCap) {
        await updateCap(buyer.id, {
          daily: dailyCap,
          monthly: dailyCap * 25,
        });
      }
      toast.success(t("networkUI.buyers.edit.updated").replace("{name}", name.trim()));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save buyer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!buyer} onOpenChange={onOpenChange}>
      {/* Wider and scrollable: the buyer access part (same as a publisher's
          settings) sits under the details. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Pencil className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("networkUI.buyers.edit.title")}</DialogTitle>
              <DialogDescription>{t("networkUI.buyers.edit.description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eb-name">{t("networkUI.buyers.edit.buyerName")}</Label>
              <Input id="eb-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eb-org">{t("networkUI.buyers.edit.organization")}</Label>
              {/* Read-only — backend's `organization_name` is echoed here
                  for context but cannot be edited from this dialog. */}
              <Input
                id="eb-org"
                value={organization}
                disabled
                readOnly
                aria-readonly
                className="cursor-not-allowed opacity-70"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eb-contact">{t("networkUI.buyers.edit.contactName")}</Label>
              <Input
                id="eb-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eb-email">{t("networkUI.buyers.edit.email")}</Label>
              <Input
                id="eb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eb-bid">{t("networkUI.buyers.edit.bidPerCall")}</Label>
              <Input
                id="eb-bid"
                type="number"
                min={0}
                step="0.5"
                value={bidAmount}
                onChange={(e) => setBidAmount(parseFloat(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eb-cap">{t("networkUI.buyers.edit.dailyCap")}</Label>
              <Input
                id="eb-cap"
                type="number"
                min={0}
                value={dailyCap}
                onChange={(e) => setDailyCap(parseInt(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="eb-desc">{t("networkUI.buyers.edit.notes")}</Label>
            <Textarea
              id="eb-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("networkUI.buyers.edit.notesPh")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("networkUI.buyers.edit.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !name.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("networkUI.buyers.edit.saving")}
              </>
            ) : (
              t("networkUI.buyers.edit.save")
            )}
          </Button>
        </DialogFooter>

        {/* Buyer access - Members, Permissions (Block Numbers, Download
            Reports), Reporting visibility, time zone. Each change saves at
            once, like the publisher settings; Save changes above is only
            for the details. */}
        {buyer && (
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("buyerAccess.sectionTitle")}
            </h3>
            <BuyerAccessSettings buyer={buyer} embedded />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

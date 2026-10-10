"use client";

import { useMemo, useState } from "react";
import { Building2, DollarSign, Gauge, Mail, UserSquare } from "lucide-react";
import { toast } from "sonner";

import { BuyerAccessSettings } from "@/components/buyers/buyer-access-settings";
import { ErrorLine, SaveBar } from "@/components/campaigns/campaign-settings-tab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { useBuyersStore } from "@/lib/store/buyers-store";
import type { Buyer, BuyerPayoutModel } from "@/lib/types";

interface FormState {
  name: string;
  organization: string;
  contactName: string;
  email: string;
  description: string;
  bidAmount: number;
  payoutModel: BuyerPayoutModel;
  concurrencyCap: number;
  dailyCap: number;
  monthlyCap: number;
}

function fromBuyer(b: Buyer): FormState {
  return {
    name: b.name,
    organization: b.organization,
    contactName: b.contactName ?? "",
    email: b.email ?? "",
    description: b.description ?? "",
    bidAmount: b.bidAmount,
    payoutModel: b.payoutModel,
    concurrencyCap: b.concurrencyCap,
    dailyCap: b.dailyCap,
    monthlyCap: b.monthlyCap,
  };
}

export function BuyerSettingsTab({ buyer }: { buyer: Buyer }) {
  const { t } = useTranslation();
  const update = useBuyersStore((s) => s.update);
  const updateCap = useBuyersStore((s) => s.updateCap);
  const [form, setForm] = useState<FormState>(() => fromBuyer(buyer));
  const [submitting, setSubmitting] = useState(false);

  const baseline = useMemo(() => fromBuyer(buyer), [buyer]);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSave = async () => {
    if (hasErrors) {
      toast.error(t("networkUI.buyers.settings.fixFieldsFirst"));
      return;
    }
    setSubmitting(true);
    try {
      // Backend's PATCH /api/buyers/{id} now accepts contact_name,
      // contact_email (sent as `email` on the FE type), and payout_model
      // alongside the original fields.
      await update(buyer.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        bidAmount: form.bidAmount,
        contactName: form.contactName.trim() || undefined,
        email: form.email.trim() || undefined,
        payoutModel: form.payoutModel,
      });
      // Caps go through the dedicated cap endpoint — main PATCH ignores them.
      if (
        form.concurrencyCap !== baseline.concurrencyCap ||
        form.dailyCap !== baseline.dailyCap ||
        form.monthlyCap !== baseline.monthlyCap
      ) {
        await updateCap(buyer.id, {
          daily: form.dailyCap,
          monthly: form.monthlyCap,
          concurrency: form.concurrencyCap,
        });
      }
      toast.success(t("networkUI.buyers.settings.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save buyer");
    } finally {
      setSubmitting(false);
    }
  };
  const onDiscard = () => {
    setForm(baseline);
    toast.info(t("networkUI.buyers.settings.discarded"));
  };

  return (
    <div className="space-y-4">
      {/* Buyer access - laid out like a publisher's settings: name + time
          zone, Members (Invited / Registered), Permissions (Block Numbers,
          Download Reports) and Reporting visibility. Saves on each change. */}
      <BuyerAccessSettings buyer={buyer} />

      {/* Identity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-accent" />
            {t("networkUI.buyers.settings.identityTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bs-name">{t("networkUI.buyers.settings.buyerName")}</Label>
            <Input
              id="bs-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && <ErrorLine>{t(errors.name)}</ErrorLine>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bs-org">{t("networkUI.buyers.settings.organization")}</Label>
            {/* Read-only — backend's `organization_name` is shown here for
                context but never sent back in a request body. */}
            <Input
              id="bs-org"
              value={form.organization}
              disabled
              readOnly
              aria-readonly
              className="cursor-not-allowed opacity-70"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bs-desc">{t("networkUI.buyers.settings.notes")}</Label>
            <Textarea
              id="bs-desc"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t("networkUI.buyers.settings.notesPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserSquare className="h-4 w-4 text-accent" />
            {t("networkUI.buyers.settings.contactTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bs-contact">{t("networkUI.buyers.settings.contactName")}</Label>
            <Input
              id="bs-contact"
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bs-email" className="inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground" />
              {t("networkUI.buyers.settings.email")}
            </Label>
            <Input
              id="bs-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              aria-invalid={!!errors.email}
            />
            {errors.email && <ErrorLine>{t(errors.email)}</ErrorLine>}
          </div>
        </CardContent>
      </Card>

      {/* Bidding */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-accent" />
            {t("networkUI.buyers.settings.biddingTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bs-bid">{t("networkUI.buyers.settings.bidPerCall")}</Label>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="bs-bid"
                type="number"
                min={0}
                step="0.5"
                value={form.bidAmount}
                onChange={(e) => set("bidAmount", parseFloat(e.target.value) || 0)}
                className="pl-8 font-mono"
                aria-invalid={!!errors.bidAmount}
              />
            </div>
            {errors.bidAmount && <ErrorLine>{t(errors.bidAmount)}</ErrorLine>}
          </div>
          <div className="space-y-2">
            <Label>{t("networkUI.buyers.settings.payoutModel")}</Label>
            <Select
              value={form.payoutModel}
              onValueChange={(v) => set("payoutModel", v as BuyerPayoutModel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">{t("networkUI.buyers.settings.payoutFlat")}</SelectItem>
                <SelectItem value="tiered">{t("networkUI.buyers.settings.payoutTiered")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Caps */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-accent" />
            {t("networkUI.buyers.settings.capsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bs-conc">{t("networkUI.buyers.settings.concurrency")}</Label>
            <Input
              id="bs-conc"
              type="number"
              min={1}
              value={form.concurrencyCap}
              onChange={(e) => set("concurrencyCap", Math.max(1, parseInt(e.target.value) || 1))}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">{t("networkUI.buyers.settings.concurrencyHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bs-daily">{t("networkUI.buyers.settings.dailyCap")}</Label>
            <Input
              id="bs-daily"
              type="number"
              min={0}
              value={form.dailyCap}
              onChange={(e) => set("dailyCap", Math.max(0, parseInt(e.target.value) || 0))}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">{t("networkUI.buyers.settings.unlimitedHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bs-monthly">{t("networkUI.buyers.settings.monthlyCap")}</Label>
            <Input
              id="bs-monthly"
              type="number"
              min={0}
              value={form.monthlyCap}
              onChange={(e) => set("monthlyCap", Math.max(0, parseInt(e.target.value) || 0))}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">{t("networkUI.buyers.settings.unlimitedHint")}</p>
          </div>
        </CardContent>
      </Card>

      <SaveBar
        dirty={dirty}
        submitting={submitting}
        hasErrors={hasErrors}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </div>
  );
}

function validate(form: FormState) {
  const errs: Record<string, string> = {};
  if (form.name.trim().length < 2) errs.name = "networkUI.buyers.settings.errNameRequired";
  // `organization` validation removed — backend treats it as read-only, so
  // there's nothing the user can fix here even if it were empty.
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "networkUI.buyers.settings.errInvalidEmail";
  if (form.bidAmount < 0) errs.bidAmount = "networkUI.buyers.settings.errBidNegative";
  return errs;
}

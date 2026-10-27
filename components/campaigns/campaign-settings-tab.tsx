"use client";

/**
 * Inline settings editor for a single campaign.
 * Grouped into Identity / Payout / Caps / Schedule cards, with a sticky
 * footer that toggles to "Save" + "Discard" when the form is dirty.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Gauge,
  Loader2,
  Save,
  Timer,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { VerticalLabel } from "@/components/campaigns/vertical-label";
import { VERTICALS } from "@/lib/mock/campaigns";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import type { Campaign, PayoutModel, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_KEYS: Array<{ id: Weekday; key: string }> = [
  { id: 0, key: "trafficUI.common.days.sun" },
  { id: 1, key: "trafficUI.common.days.mon" },
  { id: 2, key: "trafficUI.common.days.tue" },
  { id: 3, key: "trafficUI.common.days.wed" },
  { id: 4, key: "trafficUI.common.days.thu" },
  { id: 5, key: "trafficUI.common.days.fri" },
  { id: 6, key: "trafficUI.common.days.sat" },
];

interface FormState {
  name: string;
  description: string;
  vertical: string;
  payout: number;
  payoutModel: PayoutModel;
  qualifyDurationSec: number;
  dailyCap: number;
  monthlyCap: number;
  days: Weekday[];
  startHour: number;
  endHour: number;
  timezone: Campaign["schedule"]["timezone"];
}

function fromCampaign(c: Campaign): FormState {
  return {
    name: c.name,
    description: c.description ?? "",
    vertical: c.vertical,
    payout: c.payout,
    payoutModel: c.payoutModel,
    qualifyDurationSec: c.qualifyDurationSec,
    dailyCap: c.dailyCap,
    monthlyCap: c.monthlyCap,
    days: c.schedule.days,
    startHour: c.schedule.startHour,
    endHour: c.schedule.endHour,
    timezone: c.schedule.timezone,
  };
}

export function CampaignSettingsTab({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation();
  const update = useCampaignsStore((s) => s.update);
  const [form, setForm] = useState<FormState>(() => fromCampaign(campaign));
  const [submitting, setSubmitting] = useState(false);
  const DAY_LABELS: Array<{ id: Weekday; label: string }> = DAY_KEYS.map((d) => ({ id: d.id, label: t(d.key) }));

  // Recompute baseline if the campaign id changes (rare on this page, but safe)
  const baseline = useMemo(() => fromCampaign(campaign), [campaign]);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const errors = validate(form, t);
  const hasErrors = Object.keys(errors).length > 0;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (d: Weekday) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort((a, b) => a - b),
    }));

  const onSave = async () => {
    if (hasErrors) {
      toast.error(t("trafficUI.campaigns.toast.fixErrors"));
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 350));
    update(campaign.id, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      vertical: form.vertical,
      payout: form.payout,
      payoutModel: form.payoutModel,
      qualifyDurationSec: form.qualifyDurationSec,
      dailyCap: form.dailyCap,
      monthlyCap: form.monthlyCap,
      schedule: {
        days: form.days,
        startHour: form.startHour,
        endHour: form.endHour,
        timezone: form.timezone,
      },
    });
    setSubmitting(false);
    toast.success(t("trafficUI.campaigns.toast.settingsSaved"));
  };
  const onDiscard = () => {
    setForm(baseline);
    toast.info(t("trafficUI.campaigns.toast.discarded"));
  };

  return (
    <div className="space-y-4">
      {/* Identity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-accent" />
            {t("trafficUI.campaigns.settings.identity")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cs-name">{t("trafficUI.campaigns.builder.labels.name")}</Label>
            <Input
              id="cs-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && <ErrorLine>{errors.name}</ErrorLine>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-vert">{t("trafficUI.campaigns.builder.labels.vertical")}</Label>
            <Select value={form.vertical} onValueChange={(v) => set("vertical", v)}>
              <SelectTrigger id="cs-vert">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERTICALS.map((v) => (
                  <SelectItem key={v} value={v}>
                    <VerticalLabel vertical={v} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cs-desc">{t("trafficUI.campaigns.builder.labels.description")}</Label>
            <Textarea
              id="cs-desc"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t("trafficUI.campaigns.builder.placeholders.description")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payout */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-accent" />
            {t("trafficUI.campaigns.settings.payout")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cs-payout">{t("trafficUI.campaigns.settings.payoutPerCall")}</Label>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="cs-payout"
                type="number"
                min={0}
                step="0.5"
                value={form.payout}
                onChange={(e) => set("payout", parseFloat(e.target.value) || 0)}
                className="pl-8 font-mono"
                aria-invalid={!!errors.payout}
              />
            </div>
            {errors.payout && <ErrorLine>{errors.payout}</ErrorLine>}
          </div>
          <div className="space-y-2">
            <Label>{t("trafficUI.campaigns.builder.labels.payoutModel")}</Label>
            <Select
              value={form.payoutModel}
              onValueChange={(v) => set("payoutModel", v as PayoutModel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per-call">{t("trafficUI.campaigns.builder.payoutModel.perCall")}</SelectItem>
                <SelectItem value="per-qualified">{t("trafficUI.campaigns.builder.payoutModel.perQualified")}</SelectItem>
                <SelectItem value="per-minute">{t("trafficUI.campaigns.builder.payoutModel.perMinute")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.payoutModel === "per-qualified" && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cs-qual" className="inline-flex items-center gap-1.5">
                <Timer className="h-3 w-3 text-muted-foreground" />
                {t("trafficUI.campaigns.settings.qualifyDuration")}
              </Label>
              <Input
                id="cs-qual"
                type="number"
                min={0}
                value={form.qualifyDurationSec}
                onChange={(e) => set("qualifyDurationSec", parseInt(e.target.value) || 0)}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                {t("trafficUI.campaigns.settings.qualifyShort")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Caps */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-accent" />
            {t("trafficUI.campaigns.settings.caps")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cs-daily">{t("trafficUI.campaigns.builder.labels.dailyCap")}</Label>
            <Input
              id="cs-daily"
              type="number"
              min={0}
              value={form.dailyCap}
              onChange={(e) => set("dailyCap", Math.max(0, parseInt(e.target.value) || 0))}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">{t("trafficUI.common.hint.zeroUnlimited")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-monthly">{t("trafficUI.campaigns.builder.labels.monthlyCap")}</Label>
            <Input
              id="cs-monthly"
              type="number"
              min={0}
              value={form.monthlyCap}
              onChange={(e) => set("monthlyCap", Math.max(0, parseInt(e.target.value) || 0))}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">{t("trafficUI.common.hint.zeroUnlimited")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-accent" />
            {t("trafficUI.campaigns.settings.schedule")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("trafficUI.campaigns.builder.labels.activeDays")}</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((d) => {
                const active = form.days.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDay(d.id)}
                    className={cn(
                      "h-9 w-12 rounded-md border text-xs font-mono transition-colors",
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {errors.days && <ErrorLine>{errors.days}</ErrorLine>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cs-start" className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {t("trafficUI.campaigns.builder.labels.startHour")}
              </Label>
              <Input
                id="cs-start"
                type="number"
                min={0}
                max={23}
                value={form.startHour}
                onChange={(e) => set("startHour", clamp(parseInt(e.target.value) || 0, 0, 23))}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-end" className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {t("trafficUI.campaigns.builder.labels.endHour")}
              </Label>
              <Input
                id="cs-end"
                type="number"
                min={1}
                max={24}
                value={form.endHour}
                onChange={(e) => set("endHour", clamp(parseInt(e.target.value) || 0, 1, 24))}
                className="font-mono"
                aria-invalid={!!errors.endHour}
              />
              {errors.endHour && <ErrorLine>{errors.endHour}</ErrorLine>}
            </div>
            <div className="space-y-2">
              <Label>{t("trafficUI.campaigns.builder.labels.timezone")}</Label>
              <Select
                value={form.timezone}
                onValueChange={(v) => set("timezone", v as FormState["timezone"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t("trafficUI.common.timezones.callerLocal")}</SelectItem>
                  <SelectItem value="America/New_York">{t("trafficUI.common.timezones.eastern")}</SelectItem>
                  <SelectItem value="America/Chicago">{t("trafficUI.common.timezones.central")}</SelectItem>
                  <SelectItem value="America/Denver">{t("trafficUI.common.timezones.mountain")}</SelectItem>
                  <SelectItem value="America/Los_Angeles">{t("trafficUI.common.timezones.pacific")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky footer */}
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

/* ---------- shared bits ---------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function validate(form: FormState, t: (key: string) => string): Record<string, string> {
  const errs: Record<string, string> = {};
  if (form.name.trim().length < 3) errs.name = t("trafficUI.campaigns.settings.errors.nameMin");
  if (form.payout < 0) errs.payout = t("trafficUI.campaigns.settings.errors.payoutNeg");
  if (form.days.length === 0) errs.days = t("trafficUI.campaigns.settings.errors.daysEmpty");
  if (form.endHour <= form.startHour) errs.endHour = t("trafficUI.campaigns.settings.errors.endAfterStart");
  return errs;
}

export function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1 text-[10px] text-destructive">
      <AlertCircle className="h-3 w-3" />
      {children}
    </p>
  );
}

export function SaveBar({
  dirty,
  submitting,
  hasErrors,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  submitting: boolean;
  hasErrors: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  if (!dirty) {
    return (
      <p className="px-2 text-[11px] font-mono text-muted-foreground">
        {t("trafficUI.campaigns.settings.savedBaseline")}
      </p>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="sticky bottom-3 z-10"
    >
      <div className="glass mx-auto flex w-full items-center justify-between gap-2 rounded-xl border-accent/40 p-3 shadow-xl shadow-accent/10">
        <p className="inline-flex items-center gap-1.5 text-xs">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span className="font-mono uppercase tracking-wider text-muted-foreground">{t("trafficUI.campaigns.settings.unsavedChanges")}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            <Undo2 className="h-3.5 w-3.5" /> {t("trafficUI.common.discard")}
          </Button>
          <Button size="sm" onClick={onSave} disabled={submitting || hasErrors}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("trafficUI.common.saving")}
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> {t("trafficUI.common.saveChanges")}
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

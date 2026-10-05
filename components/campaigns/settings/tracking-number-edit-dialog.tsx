"use client";

/**
 * Per-tracking-number edit drawer used by the Tracking Numbers section of
 * Campaign Settings. Surfaces every editable field on the TrackingNumber
 * type that the Vortyx model exposes:
 *
 *   • VENDOR             — publisher selection, payout type/amount, conversion
 *                          trigger, duplicate-revenue handling.
 *   • TRAFFIC SOURCE     — toggle + dropdown to label the channel that's
 *                          driving traffic to this TFN.
 *   • CAP SETTINGS       — daily / monthly cap caps.
 *   • CONCURRENCY        — max simultaneous live calls.
 *
 * Persists every change live to the numbers store. The dialog stays in sync
 * with the underlying TrackingNumber via the `numberId` prop — pass `null`
 * to keep it closed.
 */

import * as React from "react";
import { ChevronDown, Edit3, Flag, Gauge, Globe, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
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
import { useNumbersStore } from "@/lib/store/numbers-store";
import { usePublishersStore } from "@/lib/store/publishers-store";
import { toE164 } from "@/lib/format";
import type {
  DupeRevenue,
  PayoutOn,
  PayoutType,
  TrackingNumber,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface TrackingNumberEditDialogProps {
  /** When non-null, the dialog is open and editing that tracking number. */
  numberId: string | null;
  onOpenChange: (open: boolean) => void;
}

const TRAFFIC_SOURCE_OPTIONS = [
  { id: "google-ads", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.trafficSources.google" },
  { id: "meta-ads", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.trafficSources.meta" },
  { id: "tiktok-ads", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.trafficSources.tiktok" },
  { id: "organic", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.trafficSources.organic" },
  { id: "email", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.trafficSources.email" },
  { id: "affiliate", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.trafficSources.affiliate" },
] as const;

export function TrackingNumberEditDialog({
  numberId,
  onOpenChange,
}: TrackingNumberEditDialogProps) {
  const { t } = useTranslation();
  const number = useNumbersStore((s) =>
    numberId ? s.numbers.find((n) => n.id === numberId) ?? null : null,
  );
  const updateNumber = useNumbersStore((s) => s.updateNumber);
  const publishers = usePublishersStore((s) => s.publishers);

  // Pull the latest snapshot from the store; if it's gone (detached etc.) the
  // dialog stays open with stale data, which is fine because onOpenChange
  // closes it the moment the parent clears its editingId.
  const isOpen = numberId !== null;

  // Live patch helper — mutates the store on every keystroke / change so
  // values persist immediately. Coalesced toasts are intentional: every
  // setting change is small + obvious, so we save a single confirmation
  // toast for the "Done" button at the bottom.
  const patch = React.useCallback(
    (p: Partial<TrackingNumber>) => {
      if (!numberId) return;
      updateNumber(numberId, p);
    },
    [numberId, updateNumber],
  );

  if (!number) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("trafficUI.campaigns.settings.trackingNumbers.edit.missingTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("trafficUI.campaigns.settings.trackingNumbers.edit.missingBody")}
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  const vendorEnabled = number.vendorEnabled ?? true;
  const trafficEnabled = number.trafficSourceEnabled ?? false;
  const capEnabled = number.capEnabled ?? false;
  const ccEnabled = number.concurrencyEnabled ?? false;
  const payoutType = number.payoutType ?? "amount";
  const payoutOn = number.payoutOn ?? "converted";
  const dupeRevenue = number.dupeRevenue ?? "disabled";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="space-y-3">
          {/* Back link — clicking closes the dialog like a "back to campaign"
              breadcrumb on a detail page. */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← {t("trafficUI.campaigns.settings.trackingNumbers.edit.back")}
          </button>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("trafficUI.campaigns.settings.trackingNumbers.edit.typeNameLabel")}
              </div>
              <DialogTitle className="mt-1 text-2xl font-semibold tracking-tight">
                {number.label ?? t("trafficUI.campaigns.settings.trackingNumbers.edit.untitled")}
              </DialogTitle>
            </div>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 font-mono text-sm text-accent">
              <Flag className="h-3.5 w-3.5" />
              {toE164(number.number)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* ─── VENDOR (publisher) ────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wider">
                    {t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.title")}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.description")}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    vendorEnabled
                      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {vendorEnabled
                    ? t("trafficUI.campaigns.settings.trackingNumbers.edit.enabled")
                    : t("trafficUI.campaigns.settings.trackingNumbers.edit.disabled")}
                </span>
              </div>

              <FieldRow
                label={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.choose")}
                description={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.chooseHint")}
              >
                <div className="relative w-64">
                  <Input
                    value={number.vendor ?? ""}
                    onChange={(e) => patch({ vendor: e.target.value })}
                    placeholder={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.choosePlaceholder")}
                    className="pr-16"
                  />
                  <div className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 text-muted-foreground">
                    <Edit3 className="h-3.5 w-3.5" />
                    {/* Display the linked publisher count so the operator
                        sees they can also pick from the publishers list. */}
                    <span className="text-[10px]">{publishers.length}</span>
                  </div>
                </div>
              </FieldRow>

              <FieldRow
                label={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.payoutType")}
                description={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.payoutTypeHint")}
              >
                <SegmentedControl<PayoutType>
                  value={payoutType}
                  onChange={(v) => patch({ payoutType: v })}
                  options={[
                    { value: "amount", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.vendor.amount" },
                    { value: "percentage", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.vendor.percentage" },
                  ]}
                />
              </FieldRow>

              <FieldRow
                label={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.payout")}
                description={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.payoutHint")}
              >
                <div className="relative w-32">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {payoutType === "percentage" ? "%" : "$"}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={number.payoutPerCall ?? 0}
                    onChange={(e) =>
                      patch({ payoutPerCall: Number(e.target.value) || 0 })
                    }
                    className="pl-7 text-right font-mono tabular-nums"
                  />
                </div>
              </FieldRow>

              <FieldRow
                label={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.payoutOn")}
                description={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.payoutOnHint")}
              >
                <SegmentedControl<PayoutOn>
                  value={payoutOn}
                  onChange={(v) => patch({ payoutOn: v })}
                  options={[
                    { value: "converted", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.vendor.convertedCall" },
                    { value: "connected", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.vendor.callConnected" },
                    { value: "length", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.vendor.callLength" },
                  ]}
                />
              </FieldRow>

              <FieldRow
                label={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.dupeRevenue")}
                description={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.dupeRevenueHint")}
              >
                <SegmentedControl<DupeRevenue>
                  value={dupeRevenue}
                  onChange={(v) => patch({ dupeRevenue: v })}
                  options={[
                    { value: "disabled", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.vendor.dupeDisabled" },
                    { value: "enabled", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.vendor.dupeEnabled" },
                    { value: "timeLimit", labelKey: "trafficUI.campaigns.settings.trackingNumbers.edit.vendor.dupeTimeLimit" },
                  ]}
                />
              </FieldRow>

              {dupeRevenue === "timeLimit" && (
                <FieldRow
                  label={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.dupeDays")}
                  description={t("trafficUI.campaigns.settings.trackingNumbers.edit.vendor.dupeDaysHint")}
                >
                  <Input
                    type="number"
                    min={1}
                    value={number.dupeRevenueDays ?? 10}
                    onChange={(e) =>
                      patch({ dupeRevenueDays: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="w-24 text-center font-mono tabular-nums"
                  />
                </FieldRow>
              )}
            </CardContent>
          </Card>

          {/* ─── TRAFFIC SOURCE ────────────────────────────────── */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wider">
                    {t("trafficUI.campaigns.settings.trackingNumbers.edit.traffic.title")}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("trafficUI.campaigns.settings.trackingNumbers.edit.traffic.description")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      trafficEnabled
                        ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {trafficEnabled
                      ? t("trafficUI.campaigns.settings.trackingNumbers.edit.enabled")
                      : t("trafficUI.campaigns.settings.trackingNumbers.edit.disabled")}
                  </span>
                  <Switch className="data-[state=checked]:bg-accent"
                    checked={trafficEnabled}
                    onCheckedChange={(v) => patch({ trafficSourceEnabled: v })}
                    aria-label={t("trafficUI.campaigns.settings.trackingNumbers.edit.traffic.toggleAria")}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t("trafficUI.campaigns.settings.trackingNumbers.edit.traffic.longBlurb")}
                {" "}
                <span className="text-accent underline">
                  {t("trafficUI.campaigns.settings.trackingNumbers.edit.traffic.linkWord")}
                </span>
                .
              </p>

              <FieldRow
                label={t("trafficUI.campaigns.settings.trackingNumbers.edit.traffic.selectLabel")}
                description={t("trafficUI.campaigns.settings.trackingNumbers.edit.traffic.selectHint")}
              >
                <Select
                  value={number.trafficSourceId ?? ""}
                  onValueChange={(v) => patch({ trafficSourceId: v })}
                  disabled={!trafficEnabled}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue
                      placeholder={t("trafficUI.campaigns.settings.trackingNumbers.edit.traffic.selectPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAFFIC_SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {t(opt.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            </CardContent>
          </Card>

          {/* ─── ADVANCED SETTINGS header ─────────────────────── */}
          <div className="pt-1">
            <h3 className="text-[13px] font-semibold uppercase tracking-wider">
              {t("trafficUI.campaigns.settings.trackingNumbers.edit.advancedTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("trafficUI.campaigns.settings.trackingNumbers.edit.advancedDesc")}
            </p>
          </div>

          {/* ─── CAP SETTINGS ─────────────────────────────────── */}
          <CollapsibleCard
            icon={Gauge}
            title={t("trafficUI.campaigns.settings.trackingNumbers.edit.cap.title")}
            description={t("trafficUI.campaigns.settings.trackingNumbers.edit.cap.description")}
            enabled={capEnabled}
            onEnabledChange={(v) => patch({ capEnabled: v })}
            enabledLabel={t("trafficUI.campaigns.settings.trackingNumbers.edit.enabled")}
            disabledLabel={t("trafficUI.campaigns.settings.trackingNumbers.edit.disabled")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                label={t("trafficUI.campaigns.settings.trackingNumbers.edit.cap.dailyCap")}
                hint={t("trafficUI.campaigns.settings.trackingNumbers.edit.cap.dailyHint")}
                value={number.dailyCap ?? 0}
                onChange={(v) => patch({ dailyCap: v })}
              />
              <NumberField
                label={t("trafficUI.campaigns.settings.trackingNumbers.edit.cap.monthlyCap")}
                hint={t("trafficUI.campaigns.settings.trackingNumbers.edit.cap.monthlyHint")}
                value={number.monthlyCap ?? 0}
                onChange={(v) => patch({ monthlyCap: v })}
              />
            </div>
          </CollapsibleCard>

          {/* ─── CONCURRENCY SETTINGS ─────────────────────────── */}
          <CollapsibleCard
            icon={Zap}
            title={t("trafficUI.campaigns.settings.trackingNumbers.edit.concurrency.title")}
            description={t("trafficUI.campaigns.settings.trackingNumbers.edit.concurrency.description")}
            enabled={ccEnabled}
            onEnabledChange={(v) => patch({ concurrencyEnabled: v })}
            enabledLabel={t("trafficUI.campaigns.settings.trackingNumbers.edit.enabled")}
            disabledLabel={t("trafficUI.campaigns.settings.trackingNumbers.edit.disabled")}
          >
            <NumberField
              label={t("trafficUI.campaigns.settings.trackingNumbers.edit.concurrency.cap")}
              hint={t("trafficUI.campaigns.settings.trackingNumbers.edit.concurrency.hint")}
              value={number.concurrencyCap ?? 0}
              onChange={(v) => patch({ concurrencyCap: v })}
            />
          </CollapsibleCard>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("trafficUI.campaigns.settings.trackingNumbers.edit.close")}
          </Button>
          <Button
            onClick={() => {
              toast.success(
                t("trafficUI.campaigns.settings.trackingNumbers.edit.saved").replace(
                  "{number}",
                  toE164(number.number),
                ),
              );
              onOpenChange(false);
            }}
          >
            {t("trafficUI.campaigns.settings.trackingNumbers.edit.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                      */
/* ─────────────────────────────────────────────────────────────────── */

function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Label className="text-xs font-medium">{label}</Label>
        {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; labelKey: string }>;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(o.labelKey)}
        </button>
      ))}
    </div>
  );
}

interface CollapsibleCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
  onEnabledChange: (v: boolean) => void;
  children: React.ReactNode;
}

function CollapsibleCard({
  icon: Icon,
  title,
  description,
  enabled,
  enabledLabel,
  disabledLabel,
  onEnabledChange,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card className="overflow-hidden p-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted/40 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-wider">
                  {title}
                </div>
                <p className="text-[11px] text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  enabled
                    ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {enabled ? enabledLabel : disabledLabel}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 border-t border-border bg-background/40 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                {/* Inline toggle so the section can be turned on/off without
                    collapsing it again. */}
                <span className="inline-flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  {enabled ? enabledLabel : disabledLabel}
                </span>
              </Label>
              <Switch className="data-[state=checked]:bg-accent" checked={enabled} onCheckedChange={onEnabledChange} />
            </div>
            <div
              className={cn(
                "space-y-3",
                !enabled && "pointer-events-none opacity-50",
              )}
              aria-disabled={!enabled}
            >
              {children}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-40 text-center font-mono tabular-nums"
      />
    </div>
  );
}
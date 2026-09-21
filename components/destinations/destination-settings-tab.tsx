"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Clock,
  Filter as FilterIcon,
  Gauge,
  Globe2,
  Plus,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { TIMEZONES } from "@/lib/timezones";
import type {
  BusinessHourSlot,
  Destination,
  DestinationForwardType,
  FilterCondition,
  FilterGroup,
  Weekday,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface DestinationSettingsTabProps {
  destination: Destination;
  /** Kept for compatibility with the parent header's edit button. */
  onEdit: () => void;
}

const DEFAULT_TIMEZONE = "America/New_York";
const DEFAULT_RING_DURATION = 25;

const PARAMETERS = [
  "Caller ID",
  "Caller State",
  "Caller Area Code",
  "Call Duration",
  "Time of Day",
  "Day of Week",
  "Tag",
  "Custom Header",
] as const;

const OPERATORS = [
  "Equals",
  "Not Equals",
  "Contains",
  "Starts With",
  "Ends With",
  "Greater Than",
  "Less Than",
  "In List",
] as const;

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function DestinationSettingsTab({ destination }: DestinationSettingsTabProps) {
  const { t } = useTranslation();
  const buyers = useBuyersStore((s) => s.buyers);
  const update = useDestinationsStore((s) => s.update);

  // Local working copy of the persisted destination — the parent re-renders us
  // whenever the store changes, so syncing on prop change is enough.
  const [draft, setDraft] = useState<Destination>(destination);
  // Track which advanced sections are currently expanded.
  const [filterOpen, setFilterOpen] = useState(true);
  const [hoursOpen, setHoursOpen] = useState(true);
  const [capOpen, setCapOpen] = useState(false);
  const [ccOpen, setCcOpen] = useState(false);

  const patch = (p: Partial<Destination>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    // Fire-and-forget — the store rolls back on backend failure and surfaces
    // an error in its `error` field. This tab is a settings surface, not a
    // transactional save, so we don't await.
    void update(draft.id, p);
  };

  const forwardType = draft.forwardType ?? "number";
  const ringDuration = draft.ringDurationSec ?? DEFAULT_RING_DURATION;
  const timezone = draft.timezone ?? DEFAULT_TIMEZONE;
  const filterEnabled = draft.filterEnabled ?? false;
  const businessHoursEnabled = draft.businessHoursEnabled ?? false;
  const filterGroups = useMemo<FilterGroup[]>(
    () =>
      draft.filterGroups && draft.filterGroups.length > 0
        ? draft.filterGroups
        : [
            {
              id: uid("grp"),
              conditions: [{ id: uid("cnd"), parameter: "", operator: "", value: "" }],
            },
          ],
    [draft.filterGroups],
  );
  const businessSlots = useMemo<BusinessHourSlot[]>(
    () =>
      draft.businessHourSlots && draft.businessHourSlots.length > 0
        ? draft.businessHourSlots
        : [
            {
              id: uid("slot"),
              days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
              from: "09:00",
              to: "20:00",
            },
          ],
    [draft.businessHourSlots],
  );

  /* ─── Filter mutators ──────────────────────────────────────────────── */
  const updateGroups = (groups: FilterGroup[]) => patch({ filterGroups: groups });

  const addCondition = (groupId: string) =>
    updateGroups(
      filterGroups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              conditions: [
                ...g.conditions,
                { id: uid("cnd"), parameter: "", operator: "", value: "" },
              ],
            }
          : g,
      ),
    );

  const removeCondition = (groupId: string, condId: string) =>
    updateGroups(
      filterGroups.map((g) =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter((c) => c.id !== condId) }
          : g,
      ),
    );

  const updateCondition = (
    groupId: string,
    condId: string,
    patchCond: Partial<FilterCondition>,
  ) =>
    updateGroups(
      filterGroups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map((c) =>
                c.id === condId ? { ...c, ...patchCond } : c,
              ),
            }
          : g,
      ),
    );

  const addGroup = () =>
    updateGroups([
      ...filterGroups,
      {
        id: uid("grp"),
        conditions: [{ id: uid("cnd"), parameter: "", operator: "", value: "" }],
      },
    ]);

  const removeGroup = (groupId: string) =>
    updateGroups(filterGroups.filter((g) => g.id !== groupId));

  const clearAllFilters = () =>
    updateGroups([
      {
        id: uid("grp"),
        conditions: [{ id: uid("cnd"), parameter: "", operator: "", value: "" }],
      },
    ]);

  /* ─── Business-hours mutators ──────────────────────────────────────── */
  const updateSlots = (slots: BusinessHourSlot[]) =>
    patch({ businessHourSlots: slots });

  const addSlot = () =>
    updateSlots([
      ...businessSlots,
      {
        id: uid("slot"),
        days: ["mon", "tue", "wed", "thu", "fri"],
        from: "09:00",
        to: "17:00",
      },
    ]);

  const removeSlot = (slotId: string) =>
    updateSlots(businessSlots.filter((s) => s.id !== slotId));

  const updateSlot = (slotId: string, patchSlot: Partial<BusinessHourSlot>) =>
    updateSlots(
      businessSlots.map((s) => (s.id === slotId ? { ...s, ...patchSlot } : s)),
    );

  const toggleDay = (slotId: string, day: Weekday) => {
    const slot = businessSlots.find((s) => s.id === slotId);
    if (!slot) return;
    const has = slot.days.includes(day);
    updateSlot(slotId, {
      days: has ? slot.days.filter((d) => d !== day) : [...slot.days, day],
    });
  };

  return (
    <div className="space-y-4">
      {/* ─── Header: timezone selector on the right ─────────────────── */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{draft.name}</h2>
          <p className="text-xs text-muted-foreground">
            {t("networkUI.destinations.settings.manageSettings")}
          </p>
        </div>
        <Select value={timezone} onValueChange={(v) => patch({ timezone: v })}>
          <SelectTrigger className="w-72">
            <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {TIMEZONES.map((z) => (
              <SelectItem key={z.iana} value={z.iana}>
                {z.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Buyer assignment ───────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label className="inline-flex items-center gap-1.5 text-sm">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {t("networkUI.destinations.settings.buyer")}
            </Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("networkUI.destinations.settings.buyerHint")}
            </p>
          </div>
          {/* Existing rows can arrive with no buyer (created before the
              backend required one); PATCH buyer_id is how they get fixed. */}
          <Select
            value={draft.buyerId || undefined}
            onValueChange={(v) => patch({ buyerId: v })}
          >
            <SelectTrigger className={cn("w-64", !draft.buyerId && "border-destructive/60")}>
              <SelectValue placeholder={t("networkUI.destinations.builder.pickBuyer")} />
            </SelectTrigger>
            <SelectContent>
              {buyers.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* ─── Forward Calls To ───────────────────────────────────────── */}
      <Card className="space-y-5 p-5">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wider">
            {t("networkUI.destinations.settings.forwardCallsTo")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("networkUI.destinations.settings.forwardCallsToDesc")}
          </p>
        </div>

        <SettingsRow
          label={t("networkUI.destinations.settings.chooseType")}
          hint={t("networkUI.destinations.settings.chooseTypeHint")}
        >
          <SegmentedControl
            value={forwardType}
            onChange={(v) => patch({ forwardType: v as DestinationForwardType })}
            options={[
              { value: "number", label: t("networkUI.destinations.settings.typeNumber") },
              { value: "sip", label: t("networkUI.destinations.settings.typeSip") },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label={t("networkUI.destinations.settings.destinationNumber")}
          hint={t("networkUI.destinations.settings.destinationNumberHint")}
        >
          <Input
            value={draft.tfn}
            onChange={(e) => patch({ tfn: e.target.value })}
            className="w-64"
            placeholder="+15551234567"
          />
        </SettingsRow>

        <SettingsRow
          label={t("networkUI.destinations.settings.ringDuration")}
          hint={t("networkUI.destinations.settings.ringDurationHint")}
        >
          <div className="relative w-32">
            <Input
              type="number"
              min={10}
              max={120}
              value={ringDuration}
              onChange={(e) =>
                patch({ ringDurationSec: Math.max(10, Number(e.target.value) || 10) })
              }
              className="pr-10 text-center font-mono tabular-nums"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("networkUI.destinations.settings.sec")}
            </span>
          </div>
        </SettingsRow>
      </Card>

      {/* ─── Advanced Settings header ──────────────────────────────── */}
      <div className="pt-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider">
          {t("networkUI.destinations.settings.advancedTitle")}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("networkUI.destinations.settings.advancedDesc")}
        </p>
      </div>

      {/* ─── FILTER ────────────────────────────────────────────────── */}
      <AdvancedCard
        open={filterOpen}
        onOpenChange={setFilterOpen}
        icon={FilterIcon}
        title={t("networkUI.destinations.settings.filterTitle")}
        description={t("networkUI.destinations.settings.filterDesc")}
        statusBadge={
          filterEnabled
            ? t("networkUI.destinations.settings.enabled")
            : t("networkUI.destinations.settings.disabled")
        }
        statusTone={filterEnabled ? "success" : "muted"}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <Label className="text-sm">
              {t("networkUI.destinations.settings.enableFilter")}
            </Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("networkUI.destinations.settings.enableFilterHint")}
            </p>
          </div>
          <Switch
            checked={filterEnabled}
            onCheckedChange={(v) => patch({ filterEnabled: Boolean(v) })}
          />
        </div>

        <div
          className={cn(
            "space-y-3 pt-4",
            !filterEnabled && "pointer-events-none opacity-50",
          )}
          aria-disabled={!filterEnabled}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                {t("networkUI.destinations.settings.continueOnlyIf")}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("networkUI.destinations.settings.continueOnlyIfHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-accent hover:underline"
            >
              {t("networkUI.destinations.settings.clearAll")}
            </button>
          </div>

          {filterGroups.map((group, gi) => (
            <div key={group.id}>
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("networkUI.destinations.settings.groupOfConditions")}
                  </span>
                  {filterGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGroup(group.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={t("networkUI.destinations.settings.removeGroupAria")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {group.conditions.map((cond, ci) => (
                  <div key={cond.id}>
                    <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <FieldSelect
                        label={t("networkUI.destinations.settings.parameter")}
                        placeholder={t(
                          "networkUI.destinations.settings.selectParameter",
                        )}
                        value={cond.parameter}
                        options={PARAMETERS}
                        onChange={(v) =>
                          updateCondition(group.id, cond.id, { parameter: v })
                        }
                      />
                      <FieldSelect
                        label={t("networkUI.destinations.settings.operator")}
                        placeholder={t(
                          "networkUI.destinations.settings.selectOperator",
                        )}
                        value={cond.operator}
                        options={OPERATORS}
                        onChange={(v) =>
                          updateCondition(group.id, cond.id, { operator: v })
                        }
                      />
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("networkUI.destinations.settings.value")}
                        </Label>
                        <Input
                          value={cond.value}
                          placeholder={t("networkUI.destinations.settings.typeValue")}
                          onChange={(e) =>
                            updateCondition(group.id, cond.id, {
                              value: e.target.value,
                            })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCondition(group.id, cond.id)}
                        disabled={group.conditions.length === 1}
                        aria-label={t(
                          "networkUI.destinations.settings.removeConditionAria",
                        )}
                        className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {ci < group.conditions.length - 1 && (
                      <div className="my-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        <span>{t("networkUI.destinations.settings.or")}</span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addCondition(group.id)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("networkUI.destinations.settings.addCondition")}
                </button>
              </div>

              {gi < filterGroups.length - 1 && (
                <div className="my-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>{t("networkUI.destinations.settings.and")}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addGroup}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("networkUI.destinations.settings.addGroup")}
          </button>

          <div className="flex justify-end border-t border-border/60 pt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast.success(t("networkUI.destinations.settings.filterSaved"))
              }
            >
              {t("networkUI.destinations.settings.save")}
            </Button>
          </div>
        </div>
      </AdvancedCard>

      {/* ─── BUSINESS HOURS ────────────────────────────────────────── */}
      <AdvancedCard
        open={hoursOpen}
        onOpenChange={setHoursOpen}
        icon={Clock}
        title={t("networkUI.destinations.settings.businessHoursTitle")}
        description={t("networkUI.destinations.settings.businessHoursDesc")}
        statusBadge={
          businessHoursEnabled
            ? t("networkUI.destinations.settings.enabled")
            : t("networkUI.destinations.settings.disabled")
        }
        statusTone={businessHoursEnabled ? "success" : "muted"}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <Label className="text-sm">
              {t("networkUI.destinations.settings.enableBusinessHours")}
            </Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("networkUI.destinations.settings.enableBusinessHoursHint")}
            </p>
          </div>
          <Switch
            checked={businessHoursEnabled}
            onCheckedChange={(v) => patch({ businessHoursEnabled: Boolean(v) })}
          />
        </div>

        <div
          className={cn(
            "space-y-4 pt-4",
            !businessHoursEnabled && "pointer-events-none opacity-50",
          )}
          aria-disabled={!businessHoursEnabled}
        >
          <div>
            <div className="text-sm font-medium">
              {t("networkUI.destinations.settings.schedule")}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("networkUI.destinations.settings.scheduleHint")}
            </p>
          </div>

          {businessSlots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-lg border border-border bg-card/40 p-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("networkUI.destinations.settings.availableOn")}
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const active = slot.days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(slot.id, d)}
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold uppercase transition-colors",
                            active
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {t(`networkUI.destinations.settings.days.${d}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <TimeField
                  label={t("networkUI.destinations.settings.from")}
                  value={slot.from}
                  onChange={(v) => updateSlot(slot.id, { from: v })}
                />
                <TimeField
                  label={t("networkUI.destinations.settings.to")}
                  value={slot.to}
                  onChange={(v) => updateSlot(slot.id, { to: v })}
                />

                {businessSlots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t(
                      "networkUI.destinations.settings.removeSlotAria",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addSlot}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("networkUI.destinations.settings.addTimeSlot")}
          </button>
        </div>
      </AdvancedCard>

      {/* ─── CAP SETTINGS ──────────────────────────────────────────── */}
      <AdvancedCard
        open={capOpen}
        onOpenChange={setCapOpen}
        icon={Gauge}
        title={t("networkUI.destinations.settings.capSettingsTitle")}
        description={t("networkUI.destinations.settings.capSettingsDesc")}
        statusBadge={t("networkUI.destinations.settings.enabled")}
        statusTone="success"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label={t("networkUI.destinations.settings.dailyCap")}
            hint={t("networkUI.destinations.settings.dailyCapHint")}
            value={draft.dailyCap}
            onChange={(v) => patch({ dailyCap: v })}
          />
          <NumberField
            label={t("networkUI.destinations.settings.monthlyCap")}
            hint={t("networkUI.destinations.settings.monthlyCapHint")}
            value={draft.monthlyCap}
            onChange={(v) => patch({ monthlyCap: v })}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {t("networkUI.destinations.settings.zeroIsUnlimited")}
        </p>
      </AdvancedCard>

      {/* ─── CONCURRENCY SETTINGS ──────────────────────────────────── */}
      <AdvancedCard
        open={ccOpen}
        onOpenChange={setCcOpen}
        icon={Zap}
        title={t("networkUI.destinations.settings.concurrencyTitle")}
        description={t("networkUI.destinations.settings.concurrencyDesc")}
        statusBadge={t("networkUI.destinations.settings.enabled")}
        statusTone="success"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label={t("networkUI.destinations.settings.concurrencyCap")}
            hint={t("networkUI.destinations.settings.concurrencyCapHint")}
            value={draft.concurrencyCap}
            onChange={(v) => patch({ concurrencyCap: v })}
          />
        </div>
      </AdvancedCard>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                      */
/* ─────────────────────────────────────────────────────────────────── */

interface AdvancedCardProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  icon: React.ElementType;
  title: string;
  description: string;
  statusBadge: string;
  statusTone: "success" | "muted";
  children: React.ReactNode;
}

function AdvancedCard({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  statusBadge,
  statusTone,
  children,
}: AdvancedCardProps) {
  return (
    <Card className="overflow-hidden p-0">
      <Collapsible open={open} onOpenChange={onOpenChange}>
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
              <Badge
                variant={statusTone === "success" ? "success" : "outline"}
                className="text-[10px]"
              >
                {statusBadge}
              </Badge>
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
          <CardContent className="border-t border-border bg-background/40 p-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/40 pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Label className="text-sm">{label}</Label>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
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
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-3 py-1 text-xs transition-colors",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 font-mono tabular-nums"
      />
    </div>
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
      <Label className="text-sm">{label}</Label>
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

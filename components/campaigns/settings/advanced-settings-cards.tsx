"use client";

/**
 * The 12 collapsible advanced-setting cards rendered inside the General
 * sub-tab of a campaign's settings. Each card reuses the AdvancedSettingShell
 * for header/toggle/expand chrome and renders its own form body.
 */

import { useCallback } from "react";
import {
  ClockAlert,
  Disc,
  Filter as FilterIcon,
  Headphones,
  ListChecks,
  MessagesSquare,
  Plus,
  Shield,
  ShieldX,
  Sparkles,
  Speech,
  Timer,
  Trash2,
  Voicemail as VoicemailIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AdvancedSettingShell } from "./advanced-setting-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignSettingsStore } from "@/lib/store/campaign-settings-store";
import type {
  AutoRecordSettings,
  BusinessHoursSettings,
  CallQueueSettings,
  CampaignAdvancedSettings,
  CapSettings,
  ConcurrencySettings,
  FilterCondition,
  FilterGroup,
  FilterSettings,
  GreetingsMessageSettings,
  RevenueSaverSettings,
  SpamFilterSettings,
  VoicemailSettings,
  VoipShieldSettings,
  WhisperMessageSettings,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ─── tiny generic helpers ──────────────────────────────────────── */

const DAY_KEYS_LOCAL = [
  { id: 0, key: "trafficUI.common.days.sun" },
  { id: 1, key: "trafficUI.common.days.mon" },
  { id: 2, key: "trafficUI.common.days.tue" },
  { id: 3, key: "trafficUI.common.days.wed" },
  { id: 4, key: "trafficUI.common.days.thu" },
  { id: 5, key: "trafficUI.common.days.fri" },
  { id: 6, key: "trafficUI.common.days.sat" },
];

function NumField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className={suffix ? "pr-12" : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/* ─── single hook to bind a card to the store ──────────────────── */

function useSetting<K extends keyof CampaignAdvancedSettings>(
  campaignId: string,
  key: K,
): [CampaignAdvancedSettings[K], (v: CampaignAdvancedSettings[K]) => void] {
  const get = useCampaignSettingsStore((s) => s.get);
  const update = useCampaignSettingsStore((s) => s.update);
  const value = get(campaignId)[key];
  const setValue = useCallback(
    (v: CampaignAdvancedSettings[K]) => update(campaignId, key, v),
    [campaignId, key, update],
  );
  return [value, setValue];
}

/* ─── 1. Call Queue ─────────────────────────────────────────────── */

export function CallQueueCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "callQueue");
  const patch = (p: Partial<CallQueueSettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={Headphones}
      title={t("trafficUI.campaigns.settings.cards.callQueue.title")}
      description={t("trafficUI.campaigns.settings.cards.callQueue.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumField
          label={t("trafficUI.campaigns.settings.cards.callQueue.maxQueueSize")}
          value={s.maxQueueSize}
          onChange={(v) => patch({ maxQueueSize: v })}
        />
        <NumField
          label={t("trafficUI.campaigns.settings.cards.callQueue.maxWaitTime")}
          value={s.maxWaitSec}
          onChange={(v) => patch({ maxWaitSec: v })}
          suffix={t("trafficUI.common.sec")}
        />
        <div className="grid gap-1.5 sm:col-span-2">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.callQueue.holdMusic")}</Label>
          <Input
            placeholder={t("trafficUI.campaigns.settings.cards.callQueue.holdMusicPlaceholder")}
            value={s.musicUrl}
            onChange={(e) => patch({ musicUrl: e.target.value })}
          />
        </div>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 2. Auto Record Calls ─────────────────────────────────────── */

export function AutoRecordCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "autoRecord");
  const patch = (p: Partial<AutoRecordSettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={Disc}
      title={t("trafficUI.campaigns.settings.cards.autoRecord.title")}
      description={t("trafficUI.campaigns.settings.cards.autoRecord.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      {/* Retention (days) and Quality were removed at the client's request
          (2026-09-23): the platform they're migrating from exposes the
          recording toggle only, and neither field was acted on server-side.
          Recording length and codec are a platform-level concern. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ToggleRow
            label={t("trafficUI.campaigns.settings.cards.autoRecord.notifyBuyer")}
            checked={s.notifyBuyer}
            onChange={(notifyBuyer) => patch({ notifyBuyer })}
          />
        </div>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 3. Spam Filter ───────────────────────────────────────────── */

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export function SpamFilterCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "spamFilter");
  const patch = (p: Partial<SpamFilterSettings>) => setS({ ...s, ...p });
  const toggleState = (code: string) => {
    const has = s.blockedStates.includes(code);
    patch({
      blockedStates: has
        ? s.blockedStates.filter((c) => c !== code)
        : [...s.blockedStates, code],
    });
  };

  return (
    <AdvancedSettingShell
      icon={ShieldX}
      title={t("trafficUI.campaigns.settings.cards.spamFilter.title")}
      description={t("trafficUI.campaigns.settings.cards.spamFilter.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4">
        <ToggleRow
          label={t("trafficUI.campaigns.settings.cards.spamFilter.blockCarrier")}
          checked={s.blockCarrierSpam}
          onChange={(blockCarrierSpam) => patch({ blockCarrierSpam })}
        />
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.spamFilter.blockedNumbers")}</Label>
          <Textarea
            rows={3}
            placeholder={t("trafficUI.campaigns.settings.cards.spamFilter.blockedNumbersPlaceholder")}
            value={s.blockedNumbers}
            onChange={(e) => patch({ blockedNumbers: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.spamFilter.blockedStates").replace("{count}", String(s.blockedStates.length))}</Label>
          <div className="mt-1.5 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border border-border bg-card p-2">
            {US_STATES.map((st) => {
              const on = s.blockedStates.includes(st);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => toggleState(st)}
                  className={`rounded px-2 py-0.5 text-[10px] font-mono transition-colors ${
                    on
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 4. Filter ─────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────── */
/*  Filter rule-builder — group-of-conditions editor                    */
/* ─────────────────────────────────────────────────────────────────── */

/** Parameter dropdown — grouped by source (Call, Caller Profile, etc.). */
const FILTER_PARAMETERS: Array<{
  groupKey: string;
  items: Array<{ value: string; labelKey: string }>;
}> = [
  {
    groupKey: "trafficUI.campaigns.settings.cards.filter.groups.call",
    items: [
      { value: "call.duration", labelKey: "trafficUI.campaigns.settings.cards.filter.params.callDuration" },
      { value: "call.status", labelKey: "trafficUI.campaigns.settings.cards.filter.params.callStatus" },
      { value: "call.startedAtHour", labelKey: "trafficUI.campaigns.settings.cards.filter.params.callStartedAtHour" },
      { value: "call.callerNumber", labelKey: "trafficUI.campaigns.settings.cards.filter.params.callerNumber" },
      { value: "call.destinationNumber", labelKey: "trafficUI.campaigns.settings.cards.filter.params.destinationNumber" },
      { value: "call.publisherId", labelKey: "trafficUI.campaigns.settings.cards.filter.params.publisher" },
      { value: "call.campaignId", labelKey: "trafficUI.campaigns.settings.cards.filter.params.campaign" },
    ],
  },
  {
    groupKey: "trafficUI.campaigns.settings.cards.filter.groups.callerProfile",
    items: [
      { value: "caller.country", labelKey: "trafficUI.campaigns.settings.cards.filter.params.country" },
      { value: "caller.state", labelKey: "trafficUI.campaigns.settings.cards.filter.params.state" },
      { value: "caller.city", labelKey: "trafficUI.campaigns.settings.cards.filter.params.city" },
      { value: "caller.zipcode", labelKey: "trafficUI.campaigns.settings.cards.filter.params.zipcode" },
      { value: "caller.carrier", labelKey: "trafficUI.campaigns.settings.cards.filter.params.carrier" },
      { value: "caller.lineType", labelKey: "trafficUI.campaigns.settings.cards.filter.params.lineType" },
      { value: "caller.areaCode", labelKey: "trafficUI.campaigns.settings.cards.filter.params.areaCode" },
      { value: "caller.timezone", labelKey: "trafficUI.campaigns.settings.cards.filter.params.timezone" },
      { value: "caller.fraudScore", labelKey: "trafficUI.campaigns.settings.cards.filter.params.fraudScore" },
    ],
  },
  {
    groupKey: "trafficUI.campaigns.settings.cards.filter.groups.custom",
    items: [
      { value: "param.vertical", labelKey: "trafficUI.campaigns.settings.cards.filter.params.vertical" },
      { value: "param.trafficSource", labelKey: "trafficUI.campaigns.settings.cards.filter.params.trafficSource" },
      { value: "param.partnerId", labelKey: "trafficUI.campaigns.settings.cards.filter.params.partnerId" },
      { value: "param.leadId", labelKey: "trafficUI.campaigns.settings.cards.filter.params.leadId" },
      { value: "param.utmSource", labelKey: "trafficUI.campaigns.settings.cards.filter.params.utmSource" },
      { value: "param.utmMedium", labelKey: "trafficUI.campaigns.settings.cards.filter.params.utmMedium" },
      { value: "param.utmCampaign", labelKey: "trafficUI.campaigns.settings.cards.filter.params.utmCampaign" },
    ],
  },
  {
    groupKey: "trafficUI.campaigns.settings.cards.filter.groups.session",
    items: [
      { value: "session.id", labelKey: "trafficUI.campaigns.settings.cards.filter.params.sessionId" },
      { value: "session.referrer", labelKey: "trafficUI.campaigns.settings.cards.filter.params.referrer" },
      { value: "session.landingPage", labelKey: "trafficUI.campaigns.settings.cards.filter.params.landingPage" },
      { value: "session.userAgent", labelKey: "trafficUI.campaigns.settings.cards.filter.params.userAgent" },
      { value: "session.deviceType", labelKey: "trafficUI.campaigns.settings.cards.filter.params.deviceType" },
      { value: "session.pagesViewed", labelKey: "trafficUI.campaigns.settings.cards.filter.params.pagesViewed" },
      { value: "session.timeOnSite", labelKey: "trafficUI.campaigns.settings.cards.filter.params.timeOnSite" },
    ],
  },
  {
    groupKey: "trafficUI.campaigns.settings.cards.filter.groups.sip",
    items: [
      { value: "sip.fromHost", labelKey: "trafficUI.campaigns.settings.cards.filter.params.fromHost" },
      { value: "sip.toHost", labelKey: "trafficUI.campaigns.settings.cards.filter.params.toHost" },
      { value: "sip.contact", labelKey: "trafficUI.campaigns.settings.cards.filter.params.contact" },
      { value: "sip.userAgent", labelKey: "trafficUI.campaigns.settings.cards.filter.params.sipUserAgent" },
      { value: "sip.diversion", labelKey: "trafficUI.campaigns.settings.cards.filter.params.diversion" },
      { value: "sip.pAssertedIdentity", labelKey: "trafficUI.campaigns.settings.cards.filter.params.pAssertedIdentity" },
    ],
  },
];

const FILTER_OPERATORS: Array<{ value: string; labelKey: string }> = [
  { value: "equals", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.equals" },
  { value: "notEquals", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.notEquals" },
  { value: "contains", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.contains" },
  { value: "notContains", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.notContains" },
  { value: "startsWith", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.startsWith" },
  { value: "endsWith", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.endsWith" },
  { value: "in", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.in" },
  { value: "notIn", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.notIn" },
  { value: "greaterThan", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.greaterThan" },
  { value: "lessThan", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.lessThan" },
  { value: "greaterOrEqual", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.greaterOrEqual" },
  { value: "lessOrEqual", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.lessOrEqual" },
  { value: "exists", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.exists" },
  { value: "notExists", labelKey: "trafficUI.campaigns.settings.cards.filter.ops.notExists" },
];

const cid = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const gid = () =>
  `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function newCondition(): FilterCondition {
  return { id: cid(), parameter: "", operator: "", value: "" };
}
function newGroup(): FilterGroup {
  return { id: gid(), conditions: [newCondition()] };
}

export function FilterCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "filter");
  const patch = (p: Partial<FilterSettings>) => setS({ ...s, ...p });

  /* ── Group / condition mutators ─────────────────────────────────── */

  const updateGroup = (gIndex: number, next: FilterGroup) => {
    const groups = s.groups.map((g, i) => (i === gIndex ? next : g));
    patch({ groups });
  };
  const addGroup = () => patch({ groups: [...s.groups, newGroup()] });
  const removeGroup = (gIndex: number) => {
    const groups = s.groups.filter((_, i) => i !== gIndex);
    // Always keep at least one group in the tree so the UI stays meaningful.
    patch({ groups: groups.length > 0 ? groups : [newGroup()] });
  };
  const clearAll = () => patch({ groups: [newGroup()] });

  const addCondition = (gIndex: number) => {
    const g = s.groups[gIndex];
    updateGroup(gIndex, { ...g, conditions: [...g.conditions, newCondition()] });
  };
  const removeCondition = (gIndex: number, cIndex: number) => {
    const g = s.groups[gIndex];
    const conditions = g.conditions.filter((_, i) => i !== cIndex);
    // Each group needs at least one condition row to stay readable.
    updateGroup(gIndex, {
      ...g,
      conditions: conditions.length > 0 ? conditions : [newCondition()],
    });
  };
  const updateCondition = (
    gIndex: number,
    cIndex: number,
    patchCond: Partial<FilterCondition>,
  ) => {
    const g = s.groups[gIndex];
    const conditions = g.conditions.map((c, i) =>
      i === cIndex ? { ...c, ...patchCond } : c,
    );
    updateGroup(gIndex, { ...g, conditions });
  };

  const onSave = () => {
    // For demo purposes — in production this would also POST the settings
    // back to the server. We just toast a confirmation.
    toast.success(t("trafficUI.campaigns.settings.cards.filter.saved"));
  };

  return (
    <AdvancedSettingShell
      icon={FilterIcon}
      title={t("trafficUI.campaigns.settings.cards.filter.title")}
      description={t("trafficUI.campaigns.settings.cards.filter.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-5">
        {/* "Continue only if" — the header for the rule tree */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">
              {t("trafficUI.campaigns.settings.cards.filter.continueOnlyIf")}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("trafficUI.campaigns.settings.cards.filter.allGroupsMet")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={clearAll}
          >
            {t("trafficUI.campaigns.settings.cards.filter.clearAll")}
          </Button>
        </div>

        {/* Rule tree — groups separated by AND */}
        <div className="space-y-2">
          {s.groups.map((g, gIdx) => (
            <div key={g.id}>
              <FilterGroupBlock
                group={g}
                showDelete={s.groups.length > 1}
                onUpdateCondition={(cIdx, p) => updateCondition(gIdx, cIdx, p)}
                onAddCondition={() => addCondition(gIdx)}
                onRemoveCondition={(cIdx) => removeCondition(gIdx, cIdx)}
                onRemoveGroup={() => removeGroup(gIdx)}
              />
              {gIdx < s.groups.length - 1 && (
                <div className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("trafficUI.campaigns.settings.cards.filter.and")}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addGroup}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent/80"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("trafficUI.campaigns.settings.cards.filter.addGroup")}
        </button>

        {/* When the rule fails + Save */}
        <div className="border-t border-border pt-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.filter.whenFails")}</Label>
            <Select
              value={s.onFail}
              onValueChange={(v) =>
                patch({ onFail: v as FilterSettings["onFail"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reject">{t("trafficUI.campaigns.settings.cards.filter.failActions.reject")}</SelectItem>
                <SelectItem value="voicemail">{t("trafficUI.campaigns.settings.cards.filter.failActions.voicemail")}</SelectItem>
                <SelectItem value="deadEnd">{t("trafficUI.campaigns.settings.cards.filter.failActions.deadEnd")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={onSave}>
              {t("trafficUI.campaigns.settings.cards.filter.save")}
            </Button>
          </div>
        </div>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── Group of conditions block ────────────────────────────────── */

function FilterGroupBlock({
  group,
  showDelete,
  onUpdateCondition,
  onAddCondition,
  onRemoveCondition,
  onRemoveGroup,
}: {
  group: FilterGroup;
  showDelete: boolean;
  onUpdateCondition: (cIdx: number, patch: Partial<FilterCondition>) => void;
  onAddCondition: () => void;
  onRemoveCondition: (cIdx: number) => void;
  onRemoveGroup: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-secondary/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("trafficUI.campaigns.settings.cards.filter.groupOfConditions")}
        </div>
        {showDelete && (
          <button
            type="button"
            onClick={onRemoveGroup}
            aria-label={t("trafficUI.campaigns.settings.cards.filter.deleteGroup")}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.conditions.map((c, cIdx) => (
          <div key={c.id}>
            <ConditionRow
              condition={c}
              onUpdate={(patch) => onUpdateCondition(cIdx, patch)}
              onRemove={() => onRemoveCondition(cIdx)}
              showRemove={group.conditions.length > 1}
            />
            {cIdx < group.conditions.length - 1 && (
              <div className="my-1.5 ml-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("trafficUI.campaigns.settings.cards.filter.or")}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddCondition}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent/80"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("trafficUI.campaigns.settings.cards.filter.addCondition")}
      </button>
    </div>
  );
}

/* ─── Single PARAMETER · OPERATOR · VALUE row ──────────────────── */

function ConditionRow({
  condition,
  onUpdate,
  onRemove,
  showRemove,
}: {
  condition: FilterCondition;
  onUpdate: (patch: Partial<FilterCondition>) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const { t } = useTranslation();
  // Some operators don't need a right-hand value (exists / does not exist).
  // We grey-out the value cell in those cases.
  const valueDisabled =
    condition.operator === "exists" || condition.operator === "notExists";

  return (
    <div className="grid grid-cols-1 items-end gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
      <div className="grid gap-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("trafficUI.campaigns.settings.cards.filter.parameter")}
        </Label>
        <Select
          value={condition.parameter}
          onValueChange={(v) => onUpdate({ parameter: v })}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder={t("trafficUI.campaigns.settings.cards.filter.selectParameter")} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {FILTER_PARAMETERS.map((g) => (
              <SelectGroup key={g.groupKey}>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t(g.groupKey)}
                </SelectLabel>
                {g.items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("trafficUI.campaigns.settings.cards.filter.operator")}
        </Label>
        <Select
          value={condition.operator}
          onValueChange={(v) => onUpdate({ operator: v })}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder={t("trafficUI.campaigns.settings.cards.filter.selectOperator")} />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {t(op.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("trafficUI.campaigns.settings.cards.filter.value")}
        </Label>
        <Input
          value={condition.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder={valueDisabled ? "—" : t("trafficUI.campaigns.settings.cards.filter.typeValue")}
          disabled={valueDisabled}
          className={cn("h-9 text-xs", valueDisabled && "opacity-50")}
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={!showRemove}
        aria-label={t("trafficUI.campaigns.settings.cards.filter.removeCondition")}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors",
          showRemove
            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "cursor-not-allowed text-muted-foreground/30",
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── 5. VoIP Shield ───────────────────────────────────────────── */

export function VoipShieldCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "voipShield");
  const patch = (p: Partial<VoipShieldSettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={Shield}
      title={t("trafficUI.campaigns.settings.cards.voipShield.title")}
      description={t("trafficUI.campaigns.settings.cards.voipShield.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4">
        <ToggleRow
          label={t("trafficUI.campaigns.settings.cards.voipShield.blockAll")}
          checked={s.blockAllVoip}
          onChange={(blockAllVoip) => patch({ blockAllVoip })}
        />
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.voipShield.allowList")}</Label>
          <Input
            placeholder={t("trafficUI.campaigns.settings.cards.voipShield.allowListPlaceholder")}
            value={s.allowList}
            onChange={(e) => patch({ allowList: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.voipShield.blockedAction")}</Label>
          <Select value={s.action} onValueChange={(v) => patch({ action: v as VoipShieldSettings["action"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="drop">{t("trafficUI.campaigns.settings.cards.voipShield.actions.drop")}</SelectItem>
              <SelectItem value="voicemail">{t("trafficUI.campaigns.settings.cards.voipShield.actions.voicemail")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 6. Business Hours ────────────────────────────────────────── */

export function BusinessHoursCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "businessHours");
  const patch = (p: Partial<BusinessHoursSettings>) => setS({ ...s, ...p });
  const toggleDay = (d: number) => {
    const has = s.days.includes(d);
    patch({ days: has ? s.days.filter((x) => x !== d) : [...s.days, d].sort() });
  };
  const DAYS = DAY_KEYS_LOCAL.map((d) => ({ id: d.id, label: t(d.key) }));

  return (
    <AdvancedSettingShell
      icon={ClockAlert}
      title={t("trafficUI.campaigns.settings.cards.businessHours.title")}
      description={t("trafficUI.campaigns.settings.cards.businessHours.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4">
        <div>
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.businessHours.days")}</Label>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {DAYS.map((d) => {
              const on = s.days.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDay(d.id)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    on ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField label={t("trafficUI.campaigns.settings.cards.businessHours.startHour")} value={s.startHour} onChange={(v) => patch({ startHour: v })} min={0} suffix=":00" />
          <NumField label={t("trafficUI.campaigns.settings.cards.businessHours.endHour")} value={s.endHour} onChange={(v) => patch({ endHour: v })} min={0} suffix=":00" />
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.businessHours.timezone")}</Label>
            <Select value={s.timezone} onValueChange={(timezone) => patch({ timezone })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("trafficUI.common.timezones.callerLocal")}</SelectItem>
                <SelectItem value="America/New_York">{t("trafficUI.common.timezones.easternShort")}</SelectItem>
                <SelectItem value="America/Chicago">{t("trafficUI.common.timezones.centralShort")}</SelectItem>
                <SelectItem value="America/Denver">{t("trafficUI.common.timezones.mountainShort")}</SelectItem>
                <SelectItem value="America/Los_Angeles">{t("trafficUI.common.timezones.pacificShort")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.businessHours.outsideAction")}</Label>
          <Select
            value={s.outsideHoursAction}
            onValueChange={(v) =>
              patch({ outsideHoursAction: v as BusinessHoursSettings["outsideHoursAction"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="voicemail">{t("trafficUI.campaigns.settings.cards.businessHours.actions.voicemail")}</SelectItem>
              <SelectItem value="reject">{t("trafficUI.campaigns.settings.cards.businessHours.actions.reject")}</SelectItem>
              <SelectItem value="rollover">{t("trafficUI.campaigns.settings.cards.businessHours.actions.rollover")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 7. Greetings Message ─────────────────────────────────────── */

export function GreetingsMessageCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "greetingsMessage");
  const patch = (p: Partial<GreetingsMessageSettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={Speech}
      title={t("trafficUI.campaigns.settings.cards.greetings.title")}
      description={t("trafficUI.campaigns.settings.cards.greetings.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.greetings.message")}</Label>
          <Textarea
            rows={3}
            value={s.message}
            onChange={(e) => patch({ message: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.greetings.voice")}</Label>
            <Select value={s.voice} onValueChange={(v) => patch({ voice: v as GreetingsMessageSettings["voice"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">{t("trafficUI.campaigns.settings.cards.greetings.voiceFemale")}</SelectItem>
                <SelectItem value="male">{t("trafficUI.campaigns.settings.cards.greetings.voiceMale")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ToggleRow
            label={t("trafficUI.campaigns.settings.cards.greetings.playBefore")}
            checked={s.playBeforeConnect}
            onChange={(playBeforeConnect) => patch({ playBeforeConnect })}
          />
        </div>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 8. Voicemail ─────────────────────────────────────────────── */

export function VoicemailCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "voicemail");
  const patch = (p: Partial<VoicemailSettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={VoicemailIcon}
      title={t("trafficUI.campaigns.settings.cards.voicemail.title")}
      description={t("trafficUI.campaigns.settings.cards.voicemail.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.voicemail.greeting")}</Label>
          <Textarea
            rows={2}
            value={s.greeting}
            onChange={(e) => patch({ greeting: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            label={t("trafficUI.campaigns.settings.cards.voicemail.maxLength")}
            value={s.maxLengthSec}
            onChange={(v) => patch({ maxLengthSec: v })}
            suffix={t("trafficUI.common.sec")}
          />
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.voicemail.notifyEmail")}</Label>
            <Input
              type="email"
              placeholder={t("trafficUI.campaigns.settings.cards.voicemail.notifyEmailPlaceholder")}
              value={s.notificationEmail}
              onChange={(e) => patch({ notificationEmail: e.target.value })}
            />
          </div>
        </div>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 9. Whisper Message ───────────────────────────────────────── */

export function WhisperMessageCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "whisperMessage");
  const patch = (p: Partial<WhisperMessageSettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={MessagesSquare}
      title={t("trafficUI.campaigns.settings.cards.whisper.title")}
      description={t("trafficUI.campaigns.settings.cards.whisper.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-1.5">
        <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.whisper.text")}</Label>
        <Textarea
          rows={3}
          value={s.message}
          onChange={(e) => patch({ message: e.target.value })}
        />
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 10. Cap Settings ─────────────────────────────────────────── */

export function CapSettingsCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "capSettings");
  const patch = (p: Partial<CapSettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={ListChecks}
      title={t("trafficUI.campaigns.settings.cards.caps.title")}
      description={t("trafficUI.campaigns.settings.cards.caps.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField label={t("trafficUI.campaigns.settings.cards.caps.hourlyCap")} value={s.hourlyCap} onChange={(v) => patch({ hourlyCap: v })} />
          <NumField label={t("trafficUI.campaigns.settings.cards.caps.dailyCap")} value={s.dailyCap} onChange={(v) => patch({ dailyCap: v })} />
          <NumField label={t("trafficUI.campaigns.settings.cards.caps.monthlyCap")} value={s.monthlyCap} onChange={(v) => patch({ monthlyCap: v })} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.caps.scope")}</Label>
          <Select value={s.scope} onValueChange={(v) => patch({ scope: v as CapSettings["scope"] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="campaign">{t("trafficUI.campaigns.settings.cards.caps.scopeCampaign")}</SelectItem>
              <SelectItem value="destination">{t("trafficUI.campaigns.settings.cards.caps.scopeDestination")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">0</span> {t("trafficUI.campaigns.settings.cards.caps.unlimitedHint")}
        </p>
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 11. Revenue Saver ────────────────────────────────────────── */

export function RevenueSaverCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "revenueSaver");
  const patch = (p: Partial<RevenueSaverSettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={Sparkles}
      title={t("trafficUI.campaigns.settings.cards.revenueSaver.title")}
      description={t("trafficUI.campaigns.settings.cards.revenueSaver.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumField
          label={t("trafficUI.campaigns.settings.cards.revenueSaver.minRevenue")}
          value={s.minRevenue}
          onChange={(v) => patch({ minRevenue: v })}
          suffix="$"
        />
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.revenueSaver.fallback")}</Label>
          <Select
            value={s.fallback}
            onValueChange={(v) => patch({ fallback: v as RevenueSaverSettings["fallback"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deadEnd">{t("trafficUI.campaigns.settings.cards.revenueSaver.actions.deadEnd")}</SelectItem>
              <SelectItem value="voicemail">{t("trafficUI.campaigns.settings.cards.revenueSaver.actions.voicemail")}</SelectItem>
              <SelectItem value="reroute">{t("trafficUI.campaigns.settings.cards.revenueSaver.actions.reroute")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {s.fallback === "reroute" && (
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.cards.revenueSaver.rerouteId")}</Label>
            <Input
              placeholder="c_xxxxx"
              value={s.rerouteCampaignId}
              onChange={(e) => patch({ rerouteCampaignId: e.target.value })}
              className="font-mono"
            />
          </div>
        )}
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── 12. Concurrency Settings ─────────────────────────────────── */

export function ConcurrencyCard({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [s, setS] = useSetting(campaignId, "concurrency");
  const patch = (p: Partial<ConcurrencySettings>) => setS({ ...s, ...p });

  return (
    <AdvancedSettingShell
      icon={Timer}
      title={t("trafficUI.campaigns.settings.cards.concurrency.title")}
      description={t("trafficUI.campaigns.settings.cards.concurrency.description")}
      enabled={s.enabled}
      onEnabledChange={(enabled) => patch({ enabled })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumField
          label={t("trafficUI.campaigns.settings.cards.concurrency.maxConcurrent")}
          value={s.maxConcurrent}
          onChange={(v) => patch({ maxConcurrent: v })}
        />
        {/* The overflow action (queue / reject / voicemail) was removed at
            the client's request (2026-09-23) — overflow is handled by the
            Call Queue card above, and offering it twice invited conflicting
            answers. */}
      </div>
    </AdvancedSettingShell>
  );
}

/* ─── Aggregator ───────────────────────────────────────────────── */

export function AdvancedSettingsList({ campaignId }: { campaignId: string }) {
  return (
    <div className="space-y-2">
      <CallQueueCard campaignId={campaignId} />
      <AutoRecordCard campaignId={campaignId} />
      <SpamFilterCard campaignId={campaignId} />
      <FilterCard campaignId={campaignId} />
      <VoipShieldCard campaignId={campaignId} />
      <BusinessHoursCard campaignId={campaignId} />
      <GreetingsMessageCard campaignId={campaignId} />
      <VoicemailCard campaignId={campaignId} />
      <WhisperMessageCard campaignId={campaignId} />
      <CapSettingsCard campaignId={campaignId} />
      <RevenueSaverCard campaignId={campaignId} />
      <ConcurrencyCard campaignId={campaignId} />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  CalendarClock,
  Check,
  Clock,
  Coins,
  Loader2,
  Megaphone,
  PhoneOff,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { aiService, type AutopilotAction, type AutopilotConfig } from "@/lib/api/services/ai.service";
import { usePermissions } from "@/lib/my-permissions";
import { useAiInsightsStore } from "@/lib/store/ai-insights-store";
import { useUIStore } from "@/lib/store/ui-store";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

type Tone = "safe" | "caution" | "aggressive";

type NumberKey = {
  [K in keyof AutopilotConfig]: AutopilotConfig[K] extends number ? K : never;
}[keyof AutopilotConfig];
type SwitchKey = {
  [K in keyof AutopilotConfig]: AutopilotConfig[K] extends boolean ? K : never;
}[keyof AutopilotConfig];

type T = (key: string) => string;

interface Limit {
  field: NumberKey;
  unit: string;
  /** Translation key for a word unit (sec, calls…); symbols like % and $ have none. */
  unitKey?: string;
  min: number;
  max: number;
}

interface RuleDef {
  id: string;
  group: "act" | "alert" | "schedule";
  label: string;
  labelKey: string;
  tone: Tone;
  icon: LucideIcon;
  /** The on/off switch. A row without one is a setting that applies to the rules above it. */
  toggle?: SwitchKey;
  limit?: Limit;
  describe: (c: AutopilotConfig, t: T) => string;
}

/** Every option on the card. Each one is read by the server's rule engine. */
const RULES: RuleDef[] = [
  {
    id: "pauseOnHighNoAnswer",
    group: "act",
    label: "Pause on high no-answer rate",
    labelKey: "x5.autopilot.rules.pauseOnHighNoAnswer.label",
    tone: "caution",
    icon: ShieldAlert,
    toggle: "pauseOnHighNoAnswer",
    limit: { field: "noAnswerThreshold", unit: "%", min: 10, max: 100 },
    describe: (c, t) => t("x5.autopilot.rules.pauseOnHighNoAnswer.desc").replace("{n}", String(c.noAnswerThreshold)),
  },
  {
    id: "pauseOnShortCalls",
    group: "act",
    label: "Pause on very short calls",
    labelKey: "x5.autopilot.rules.pauseOnShortCalls.label",
    tone: "caution",
    icon: Timer,
    toggle: "pauseOnShortCalls",
    limit: { field: "shortCallSeconds", unit: "sec", unitKey: "x5.autopilot.units.sec", min: 1, max: 600 },
    describe: (c, t) => t("x5.autopilot.rules.pauseOnShortCalls.desc").replace("{n}", String(c.shortCallSeconds)),
  },
  {
    id: "minCallsToJudge",
    group: "act",
    label: "Minimum calls before judging a buyer",
    labelKey: "x5.autopilot.rules.minCallsToJudge.label",
    tone: "safe",
    icon: ShieldCheck,
    limit: { field: "minCallsToJudge", unit: "calls", unitKey: "x5.autopilot.units.calls", min: 3, max: 500 },
    describe: (c, t) => t("x5.autopilot.rules.minCallsToJudge.desc").replace("{n}", String(c.minCallsToJudge)),
  },
  {
    id: "resumeRecoveredBuyers",
    group: "act",
    label: "Resume buyers it paused",
    labelKey: "x5.autopilot.rules.resumeRecoveredBuyers.label",
    tone: "caution",
    icon: RotateCcw,
    toggle: "resumeRecoveredBuyers",
    limit: { field: "resumeAfterMinutes", unit: "min", unitKey: "x5.autopilot.units.min", min: 5, max: 1440 },
    describe: (c, t) => t("x5.autopilot.rules.resumeRecoveredBuyers.desc").replace("{n}", String(c.resumeAfterMinutes)),
  },
  {
    id: "alertOnVolumeDrop",
    group: "alert",
    label: "Alert on volume drop",
    labelKey: "x5.autopilot.rules.alertOnVolumeDrop.label",
    tone: "safe",
    icon: TrendingDown,
    toggle: "alertOnVolumeDrop",
    limit: { field: "volumeDropThreshold", unit: "%", min: 10, max: 95 },
    describe: (c, t) => t("x5.autopilot.rules.alertOnVolumeDrop.desc").replace("{n}", String(c.volumeDropThreshold)),
  },
  {
    id: "alertOnRevenueDrop",
    group: "alert",
    label: "Alert on revenue drop",
    labelKey: "x5.autopilot.rules.alertOnRevenueDrop.label",
    tone: "safe",
    icon: Coins,
    toggle: "alertOnRevenueDrop",
    limit: { field: "revenueDropThreshold", unit: "%", min: 10, max: 95 },
    describe: (c, t) => t("x5.autopilot.rules.alertOnRevenueDrop.desc").replace("{n}", String(c.revenueDropThreshold)),
  },
  {
    id: "alertOnLowBalance",
    group: "alert",
    label: "Alert on low balance",
    labelKey: "x5.autopilot.rules.alertOnLowBalance.label",
    tone: "safe",
    icon: Wallet,
    toggle: "alertOnLowBalance",
    limit: { field: "lowBalanceAmount", unit: "$", min: 1, max: 100000 },
    describe: (c, t) => t("x5.autopilot.rules.alertOnLowBalance.desc").replace("{n}", String(c.lowBalanceAmount)),
  },
  {
    id: "alertOnNoCalls",
    group: "alert",
    label: "Alert when calls go quiet",
    labelKey: "x5.autopilot.rules.alertOnNoCalls.label",
    tone: "safe",
    icon: PhoneOff,
    toggle: "alertOnNoCalls",
    limit: { field: "noCallsHours", unit: "hours", unitKey: "x5.autopilot.units.hours", min: 1, max: 12 },
    describe: (c, t) =>
      t(c.noCallsHours === 1 ? "x5.autopilot.rules.alertOnNoCalls.descOne" : "x5.autopilot.rules.alertOnNoCalls.desc").replace(
        "{n}",
        String(c.noCallsHours),
      ),
  },
  {
    id: "alertOnHighSpam",
    group: "alert",
    label: "Alert on high spam rate",
    labelKey: "x5.autopilot.rules.alertOnHighSpam.label",
    tone: "safe",
    icon: ShieldAlert,
    toggle: "alertOnHighSpam",
    limit: { field: "spamRateThreshold", unit: "%", min: 5, max: 100 },
    describe: (c, t) => t("x5.autopilot.rules.alertOnHighSpam.desc").replace("{n}", String(c.spamRateThreshold)),
  },
  {
    id: "alertOnCampaignWithoutBuyers",
    group: "alert",
    label: "Alert on campaign with no buyer",
    labelKey: "x5.autopilot.rules.alertOnCampaignWithoutBuyers.label",
    tone: "safe",
    icon: Megaphone,
    toggle: "alertOnCampaignWithoutBuyers",
    describe: (_c, t) => t("x5.autopilot.rules.alertOnCampaignWithoutBuyers.desc"),
  },
  {
    id: "autoRun",
    group: "schedule",
    label: "Run automatically",
    labelKey: "x5.autopilot.rules.autoRun.label",
    tone: "aggressive",
    icon: CalendarClock,
    toggle: "autoRun",
    limit: { field: "runEveryMinutes", unit: "min", unitKey: "x5.autopilot.units.min", min: 5, max: 1440 },
    describe: (c, t) => t("x5.autopilot.rules.autoRun.desc").replace("{n}", String(c.runEveryMinutes)),
  },
];

const GROUPS: { id: RuleDef["group"]; title: string; titleKey: string }[] = [
  { id: "act", title: "Take action", titleKey: "x5.autopilot.groups.act" },
  { id: "alert", title: "Send alerts", titleKey: "x5.autopilot.groups.alert" },
  { id: "schedule", title: "Schedule", titleKey: "x5.autopilot.groups.schedule" },
];

const TONE: Record<Tone, { icon: LucideIcon; chip: string; iconBg: string }> = {
  safe: {
    icon: ShieldCheck,
    chip: "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]",
    iconBg: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
  },
  caution: {
    icon: ShieldAlert,
    chip: "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 text-[color:var(--warning)]",
    iconBg: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  },
  aggressive: {
    icon: Sparkles,
    chip: "border-destructive/30 bg-destructive/10 text-destructive",
    iconBg: "bg-destructive/15 text-destructive",
  },
};

const ACTION_LABEL: Record<string, string> = {
  paused_buyer: "x5.autopilot.actions.pausedBuyer",
  resumed_buyer: "x5.autopilot.actions.resumedBuyer",
  alert_sent: "x5.autopilot.actions.alertSent",
  still_active: "x5.autopilot.actions.stillActive",
};

const TONE_LABEL: Record<Tone, string> = {
  safe: "x5.autopilot.tone.safe",
  caution: "x5.autopilot.tone.caution",
  aggressive: "x5.autopilot.tone.aggressive",
};

/** A number that saves when you leave the box or press Enter, and snaps back if it is out of range. */
function LimitInput({
  limit,
  label,
  value,
  disabled,
  onSave,
}: {
  limit: Limit;
  label: string;
  value: number;
  disabled: boolean;
  onSave: (field: NumberKey, value: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const unit = limit.unitKey ? t(limit.unitKey) : limit.unit;
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = async () => {
    const n = Number(text);
    if (!Number.isFinite(n) || n < limit.min || n > limit.max) {
      setText(String(value));
      if (text !== String(value)) toast.error(t("x5.autopilot.enterRange").replace("{min}", String(limit.min)).replace("{max}", String(limit.max)));
      return;
    }
    if (n === value) return;
    await onSave(limit.field, Math.round(n));
  };

  return (
    <label className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <input
        type="number"
        inputMode="numeric"
        min={limit.min}
        max={limit.max}
        value={text}
        disabled={disabled}
        aria-label={`${label} (${unit})`}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-8 w-16 rounded-md border border-input bg-transparent px-2 text-right text-sm tabular-nums text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="w-8">{unit}</span>
    </label>
  );
}

export function AutopilotCard() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const editable = can("campaigns", "edit-advanced");
  const timeZone = useUIStore((s) => s.reportTimezone);
  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const runAutopilot = useAiInsightsStore((s) => s.runAutopilot);
  const lastActions = useAiInsightsStore((s) => s.autopilotActions);
  const [running, setRunning] = useState(false);

  const enabledCount = config ? RULES.filter((r) => r.toggle && config[r.toggle]).length : 0;

  const load = useCallback(async () => {
    try {
      setConfig(await aiService.getAutopilotConfig());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const when = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("en-US", {
          timeZone,
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : "";

  // One change at a time: only the field that changed is sent, so saving one
  // switch can no longer put the others back to their defaults.
  const save = async (patch: Partial<AutopilotConfig>) => {
    if (!config) return;
    const prev = config;
    setConfig({ ...config, ...patch }); // optimistic
    try {
      const saved = await aiService.updateAutopilotConfig(patch);
      setConfig(saved);
    } catch (e) {
      setConfig(prev);
      toast.error(e instanceof Error ? e.message : t("x5.autopilot.updateFailed"));
      throw e;
    }
  };

  const toggle = async (rule: RuleDef) => {
    if (!config || !rule.toggle) return;
    const next = !config[rule.toggle];
    try {
      await save({ [rule.toggle]: next } as Partial<AutopilotConfig>);
      toast.success(
        next ? t("toolsUI.insights.autopilot.toastEnabled") : t("toolsUI.insights.autopilot.toastDisabled"),
        { description: t(rule.labelKey) },
      );
    } catch {
      /* save() already told the user */
    }
  };

  const saveNumber = async (field: NumberKey, value: number) => {
    try {
      await save({ [field]: value } as Partial<AutopilotConfig>);
      toast.success(t("trafficUI.common.saved"));
    } catch {
      /* save() already told the user */
    }
  };

  const onRunPass = async () => {
    setRunning(true);
    try {
      const actions = await runAutopilot();
      const done = actions.filter((a) => a.action !== "still_active");
      if (actions.length === 0) {
        toast.success(t("toolsUI.insights.autopilot.title"), {
          description: t("x5.autopilot.noActions"),
        });
      } else if (done.length === 0) {
        toast.success(t("toolsUI.insights.autopilot.title"), {
          description: t("x5.autopilot.nothingNew"),
        });
      } else {
        toast.success(t("toolsUI.insights.autopilot.title"), {
          description:
            done.length === 1
              ? t("x5.autopilot.executedOne")
              : t("x5.autopilot.executedMany").replace("{count}", String(done.length)),
        });
      }
      void load(); // pulls the new "last run" and history
    } catch {
      toast.error(t("x5.autopilot.passFailed"));
    } finally {
      setRunning(false);
    }
  };

  const shown: { key: string; item: AutopilotAction & { at?: string; source?: string } }[] =
    lastActions.length > 0
      ? lastActions.slice(0, 6).map((a, i) => ({ key: `${a.entity}:${i}`, item: a }))
      : (config?.history ?? []).slice(0, 6).map((h, i) => ({ key: `${h.entity}:${h.at}:${i}`, item: h }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Bot className="h-3.5 w-3.5" />
          </span>
          {t("toolsUI.insights.autopilot.title")}
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">
            <Check className="h-3 w-3" />
            {t("toolsUI.insights.autopilot.active").replace("{count}", String(enabledCount))}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("toolsUI.insights.autopilot.description")}</p>
        {!editable && (
          <p className="text-xs text-muted-foreground">{t("x5.autopilot.viewOnly")}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {loadFailed && !config && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs">
            <span>{t("x5.autopilot.loadFailed")}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              {t("marketplace.tryAgain")}
            </Button>
          </div>
        )}

        {GROUPS.map((group) => (
          <section key={group.id} className="space-y-1">
            <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(group.titleKey)}
            </h3>
            {RULES.filter((r) => r.group === group.id).map((r, i) => {
              const tone = TONE[r.tone];
              const Icon = r.icon;
              const on = config && r.toggle ? config[r.toggle] : true;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.22 }}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 px-3 py-2.5 transition-colors hover:bg-secondary/20 sm:flex-nowrap"
                >
                  <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md", tone.iconBg)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t(r.labelKey)}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", tone.chip)}>
                        {t(TONE_LABEL[r.tone])}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {config ? r.describe(config, t) : t("common.loading")}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    {config && r.limit && (
                      <LimitInput
                        limit={r.limit}
                        label={t(r.labelKey)}
                        value={config[r.limit.field]}
                        disabled={!editable || (!!r.toggle && !on)}
                        onSave={saveNumber}
                      />
                    )}
                    {!r.toggle && <span aria-hidden className="w-9 shrink-0" />}
                    {r.toggle && (
                      <Switch
                        checked={!!on}
                        disabled={!config || !editable}
                        onCheckedChange={() => void toggle(r)}
                        aria-label={t(r.labelKey)}
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </section>
        ))}

        {/* Run-now: the server runs every switched-on rule once, right away,
            and returns what it did. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
          <div className="min-w-0 flex-1 basis-48">
            <div className="text-sm font-medium">{t("x5.autopilot.runPassTitle")}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {config?.lastRunAt
                ? t("x5.autopilot.lastRun").replace("{when}", when(config.lastRunAt))
                : t("x5.autopilot.runsEveryRule")}
            </p>
          </div>
          <Button size="sm" onClick={onRunPass} disabled={running || !config || !editable} className="shrink-0">
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("x5.autopilot.running")}
              </>
            ) : (
              <>
                <PlayCircle className="h-3.5 w-3.5" /> {t("x5.autopilot.runNow")}
              </>
            )}
          </Button>
        </div>

        {shown.length > 0 && (
          <div className="space-y-1">
            <h3 className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" />
              {lastActions.length > 0 ? t("x5.autopilot.lastPass") : t("x5.autopilot.recentActivity")}
            </h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {shown.map(({ key, item }) => (
                <li key={key} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--success)]" />
                  <span>
                    <span className="font-medium text-foreground">{ACTION_LABEL[item.action] ? t(ACTION_LABEL[item.action]) : item.action}</span>{" "}
                    <span className="font-mono">{item.entity}</span>
                    {item.reason && <span>. {item.reason}</span>}
                    {item.at && (
                      <span className="text-muted-foreground/70">
                        {" "}
                        ({when(item.at)}
                        {item.source === "auto" ? t("x5.autopilot.automatic") : ""})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

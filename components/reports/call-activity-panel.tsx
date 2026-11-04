"use client";

/**
 * Call activity — the "X-ray" on a single call, opened from the Call Log's
 * row expander.
 *
 * CH-565 (Sir, 5 Nov): laid out as his design - header, Caller -> TFN ->
 * Campaign -> Buyer, figures, ring / talk bar, recording, and the tabs
 * Activity / Caller / Technical / History. Stored facts only; generic names
 * for our servers and carriers. The pieces are in call-panel-parts.tsx.
 *
 * Everything comes from GET /api/analytics/calls/{id}/detail. Two rules
 * from that contract shape this component:
 *
 *   1. `timeline` carries only the events that actually happened, so the
 *      panel renders what comes back instead of laying out a fixed six.
 *   2. Several profile fields are null by design (the lookup provider
 *      doesn't supply city / zip / timezone / fraud score) and others only
 *      populate on recent calls. A null field is omitted, never shown as a
 *      blank row or a zero.
 *
 * The routing trace distinguishes *rejected* destinations from ones that
 * were simply **not reached** — routing stops at the first destination
 * that passes, so everything after the winner was never examined. Showing
 * those as rejected would be wrong.
 */

import * as React from "react";
import {
  ChevronRight,
  CircleDollarSign,
  ContactRound,
  GitBranch,
  Globe,
  Link2,
  ListTree,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOff,
  PhoneOutgoing,
  Repeat2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "@/hooks/use-translation";
import { localizeFailReason } from "@/lib/fail-reason";
import {
  callsService,
  hasRoutingTrace,
  type CallActivity,
  type CallerProfile,
  type CallLeg,
  type CallPanel,
  type RoutingTrace,
  type TraceDestination,
} from "@/lib/api/services/calls.service";
import { formatCallerId, formatCurrency, formatLocalDate, uiLocaleTag } from "@/lib/format";
import {
  Figures,
  FlowCard,
  HistoryList,
  PanelHeader,
  RecordingPlayer,
  TechnicalTab,
  fill,
  legName,
  offsetOf,
  prettyPhone,
  type HistoryItem,
} from "@/components/reports/call-panel-parts";
import { useUIStore } from "@/lib/store/ui-store";
import type { Call } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LocalName } from "@/lib/i18n/local-name";

interface Props {
  call: Call | null;
  onOpenChange: (open: boolean) => void;
}

/** Icon + tint per timeline event. Unknown events still render, with the
 *  neutral icon — the backend can add events without a frontend release. */
const EVENT_META: Record<string, { icon: React.ElementType; tint: string }> = {
  call_received: { icon: PhoneIncoming, tint: "bg-accent/15 text-accent" },
  caller_lookup: { icon: ContactRound, tint: "bg-accent/15 text-accent" },
  destination_dialed: { icon: PhoneForwarded, tint: "bg-accent/15 text-accent" },
  connected: { icon: Repeat2, tint: "bg-[color:var(--success)]/15 text-[color:var(--success)]" },
  converted: { icon: PhoneCall, tint: "bg-[color:var(--success)]/15 text-[color:var(--success)]" },
  ended: { icon: PhoneOff, tint: "bg-muted text-muted-foreground" },
};

function timeOf(iso: string | undefined, timeZone: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString(uiLocaleTag(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  });
}

function dayOf(iso: string | undefined, timeZone: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return formatLocalDate(ms, {
    month: "long",
    day: "numeric",
    timeZone,
  });
}

/** Translation keys for the event detail keys, status words, routing check
 *  names and line types the backend is known to send. Outside English these
 *  are shown translated; anything else is shown as sent. */
const DETAIL_LABEL_KEYS: Record<string, string> = {
  from: "x6.activity.detail.from",
  destination: "toolsUI.reports.activity.destination",
  buyer: "toolsUI.reports.activity.buyer",
  conversionAmount: "x6.activity.detail.conversionAmount",
  duration: "toolsUI.callLogs.detail.duration",
  status: "common.status",
};
const STATUS_KEYS: Record<string, string> = {
  completed: "toolsUI.reports.callLog.statusLabel.completed",
  failed: "toolsUI.callLogs.statusBadge.failed",
  no_answer: "toolsUI.reports.callLog.failReasons.noAnswer",
  "in-progress": "toolsUI.reports.filter.statusOptions.inProgress",
  in_progress: "toolsUI.reports.filter.statusOptions.inProgress",
  busy: "toolsUI.reports.callLog.statusLabel.busy",
  ringing: "toolsUI.reports.callLog.statusLabel.ringing",
};
const STEP_KEYS: Record<string, string> = {
  blacklist: "x6.activity.step.blacklist",
  duplicate: "x6.activity.step.duplicate",
  campaign_cap: "x6.activity.step.campaignCap",
  balance: "x6.activity.step.balance",
};
const LINE_TYPE_KEYS: Record<string, string> = {
  mobile: "toolsUI.reports.summary.value.mobile",
  landline: "toolsUI.reports.summary.value.landline",
  voip: "toolsUI.reports.summary.value.voip",
};

/** Turn an event's free-form `detail` object into label/value rows. Keys
 *  arrive camelCased by the HTTP layer; they're de-camelised for display so
 *  a new backend key needs no frontend change to read properly. */
function detailRows(
  detail: Record<string, unknown> | null | undefined,
  t: (key: string) => string,
  locale: string,
): Array<[string, string]> {
  if (!detail) return [];
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") continue;
    const label =
      locale !== "en" && DETAIL_LABEL_KEYS[k]
        ? t(DETAIL_LABEL_KEYS[k])
        : k
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (c) => c.toUpperCase())
            .trim();
    // Status words arrive raw ("failed", "no_answer"): show them as
    // "Failed", "No answer". Other values are shown as sent.
    const value =
      k === "status"
        ? locale !== "en" && STATUS_KEYS[String(v).toLowerCase()]
          ? t(STATUS_KEYS[String(v).toLowerCase()])
          : capitalizeFirst(String(v).replace(/_/g, " ")) ?? ""
        : String(v);
    out.push([label, value]);
  }
  return out;
}

export function CallActivityPanel({ call, onOpenChange }: Props) {
  const { t, locale } = useTranslation();
  const timeZone = useUIStore((s) => s.reportTimezone);
  const [tab, setTab] = React.useState<PanelTab>("activity");
  const [data, setData] = React.useState<CallActivity | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!call) {
      setData(null);
      setError(null);
      return;
    }
    setTab("activity");
    let cancelled = false;
    setLoading(true);
    callsService
      .activity(call.id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [call]);

  const caller = call ? formatCallerId(call.callerNumber) : "";
  const panel = data?.panel;
  const profile = data?.callerProfile;
  const lineTypeKey = profile?.lineType ? LINE_TYPE_KEYS[profile.lineType.toLowerCase()] : undefined;
  const lineType = locale !== "en" && lineTypeKey ? t(lineTypeKey) : capitalizeFirst(profile?.lineType ?? undefined);
  const recordingUrl = data?.recording?.url || call?.recordingUrl || "";
  const eligible = data?.routingTrace?.summary?.eligible;
  const activity = call && data ? buildActivity(call, data, t, locale) : [];
  const history = call && panel ? buildHistory(call, panel, t, ruleText(call, panel, t)) : [];

  return (
    <Sheet open={!!call} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // `[&>button]:hidden` drops the Sheet's built-in X: the header has
        // its own close button beside the copy button (CH-565).
        className="w-full gap-0 overflow-y-auto p-0 [&>button]:hidden sm:max-w-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="space-y-0 p-0">
          <SheetTitle className="sr-only">
            {t("toolsUI.reports.activity.title").replace("{caller}", caller)}
          </SheetTitle>
        </SheetHeader>
        {call && (
          <PanelHeader
            call={call}
            panel={panel}
            carrier={profile?.carrier}
            lineType={lineType}
            timeZone={timeZone}
            onClose={() => onOpenChange(false)}
          />
        )}

        {loading && !data ? (
          <p className="p-6 text-sm text-muted-foreground">{t("toolsUI.reports.activity.loading")}</p>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !data || !call ? null : (
          <>
            <FlowCard call={call} panel={panel} eligible={eligible} />
            <Figures call={call} panel={panel} />
            {recordingUrl && <RecordingPlayer url={recordingUrl} />}

            <div className="mt-5 flex gap-6 border-b border-border/60 px-5">
              {(["activity", "caller", "technical", "history"] as const).map((id) => {
                const count = id === "activity" ? activity.length : id === "history" ? history.length : undefined;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={cn(
                      "-mb-px border-b-2 pb-3 text-sm font-medium transition-colors",
                      tab === id
                        ? "border-accent text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`x565.tab.${id}`)}
                    {count ? <span className="ml-1.5 text-xs text-muted-foreground">{count}</span> : null}
                  </button>
                );
              })}
            </div>

            {tab === "activity" ? (
              panel ? (
                <ActivityList items={activity} timeZone={timeZone} start={panel.startedAt} />
              ) : (
                <div>
                  <p className="py-4 text-center text-xs font-medium text-muted-foreground">
                    {dayOf(data.timeline?.[0]?.at ?? new Date(call.startedAt).toISOString(), timeZone)}
                  </p>
                  <Timeline data={data} timeZone={timeZone} />
                </div>
              )
            ) : tab === "caller" ? (
              <div className="p-5">
                <div className="rounded-xl border border-border/70 bg-secondary/20 p-4">
                  <ProfileFields profile={profile} />
                </div>
              </div>
            ) : tab === "technical" ? (
              <TechnicalTab
                call={call}
                panel={panel}
                hasRecording={Boolean(recordingUrl)}
                routingRows={routingRows(data, t, locale)}
              />
            ) : (
              <HistoryList items={history} timeZone={timeZone} />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type PanelTab = "activity" | "caller" | "technical" | "history";
type T = (key: string) => string;

/* ─── Activity (CH-565) ─────────────────────────────────────────────── */

interface ActivityItem {
  key: string;
  icon: React.ElementType;
  tint: string;
  title: string;
  /** Shown with its "+x s" offset from the start; checks and routing have no
   *  sub-second time of their own, so they show the clock time only. */
  at?: string | null;
  offset?: boolean;
  body?: React.ReactNode;
}

const TINT = {
  info: "border-accent/40 text-accent",
  good: "border-[color:var(--success)]/40 text-[color:var(--success)]",
  bad: "border-destructive/40 text-destructive",
  plain: "border-border text-muted-foreground",
};

function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "good" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
        tone === "good"
          ? "border-[color:var(--success)]/30 text-[color:var(--success)]"
          : tone === "bad"
            ? "border-destructive/30 text-destructive"
            : "border-border/70 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function ruleText(call: Call, panel: CallPanel, t: T): string {
  const rule = panel.convertRule;
  const buyer = call.buyerName || panel.destinationName || "";
  if (!rule?.on || !buyer) return "";
  if (rule.on === "incoming") return fill(t("x565.rule.incoming"), { buyer });
  if (rule.on === "length" && rule.seconds) return fill(t("x565.rule.length"), { buyer, n: rule.seconds });
  return fill(t("x565.rule.connected"), { buyer });
}

function legChip(leg: CallLeg, t: T): { text: string; tone: "good" | "bad" } {
  if (leg.result === "answered") return { text: fill(t("x565.leg.answered"), { n: leg.ringSeconds ?? 0 }), tone: "good" };
  if (leg.result === "busy") return { text: fill(t("x565.leg.busy"), { n: leg.ringSeconds ?? 0 }), tone: "bad" };
  if (leg.reason === "Not Connected") return { text: fill(t("x565.leg.callerLeft"), { n: leg.ringSeconds ?? 0 }), tone: "bad" };
  return { text: fill(t("x565.leg.noAnswer"), { n: leg.ringSeconds ?? 0 }), tone: "bad" };
}

function stepName(step: string, t: T, locale: string): string {
  return locale !== "en" && STEP_KEYS[step] ? t(STEP_KEYS[step]) : capitalizeFirst(step.replace(/_/g, " ")) ?? step;
}

function buildActivity(call: Call, data: CallActivity, t: T, locale: string): ActivityItem[] {
  const panel = data.panel;
  if (!panel) return [];
  const items: ActivityItem[] = [];
  const start = panel.startedAt;
  const trace = data.routingTrace;
  const legs = panel.legs ?? [];
  const last = legs[legs.length - 1];
  const answered = Boolean(panel.answeredAt);

  items.push({
    key: "received",
    icon: PhoneIncoming,
    tint: TINT.info,
    title: t("x565.ev.received"),
    at: start,
    offset: true,
    body: (
      <div className="space-y-2">
        <p className="text-[13px] text-muted-foreground">
          {fill(t("x565.ev.receivedBody"), { caller: prettyPhone(call.callerNumber), tfn: prettyPhone(call.calledNumber) })}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip>{panel.repeat ? t("x565.ev.repeatChip") : t("x565.ev.firstCallChip")}</Chip>
          {(panel.senderTries ?? 1) > 1 && <Chip>{fill(t("x565.ev.senderTries"), { n: panel.senderTries ?? 1 })}</Chip>}
        </div>
      </div>
    ),
  });

  const steps = trace?.steps ?? [];
  if (steps.length) {
    const failed = steps.filter((s) => !s.passed).length;
    items.push({
      key: "checks",
      icon: failed ? ShieldAlert : ShieldCheck,
      tint: failed ? TINT.bad : TINT.good,
      title: failed
        ? fill(t("x565.ev.checksFailed"), { n: failed, total: steps.length })
        : fill(t("x565.ev.checksPassed"), { n: steps.length }),
      at: start,
      body: (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {steps.map((s) => (
            <span
              key={s.step}
              className={cn("inline-flex items-center gap-1 text-[13px]", s.passed ? "text-muted-foreground" : "text-destructive")}
              title={s.detail || undefined}
            >
              {s.passed ? <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--success)]" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {stepName(s.step, t, locale)}
            </span>
          ))}
        </div>
      ),
    });
  }

  if (hasRoutingTrace(trace)) {
    const s = trace.summary ?? {};
    const breakdown = (trace.filteringBreakdown ?? []).slice(0, 5);
    items.push({
      key: "routing",
      icon: GitBranch,
      tint: TINT.info,
      title: t("x565.ev.routing"),
      at: start,
      body: (
        <div className="space-y-2.5">
          {s.totalDestinations != null && (
            <p className="text-[13px] text-muted-foreground">
              {fill(t("x565.ev.routingBody"), {
                eligible: s.eligible ?? trace.eligibleDestinations?.length ?? 0,
                total: s.totalDestinations,
                campaign: call.campaignName || "",
              })}
            </p>
          )}
          {breakdown.length > 0 && (
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border/70 sm:grid-cols-5">
              {breakdown.map((b) => (
                <div key={b.reason} className="min-w-0 border-border/60 px-3 py-2 [&:not(:first-child)]:border-l">
                  <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground" title={b.reason}>
                    {capitalizeFirst(b.reason)}
                  </p>
                  <p className="mt-0.5 font-mono text-sm tabular-nums">{b.count}</p>
                </div>
              ))}
            </div>
          )}
          <MoreDetails label={t("x565.ev.details")}>
            <CallPlanBody trace={trace} />
          </MoreDetails>
        </div>
      ),
    });
  }

  // A website visit (CH-452) or any other event the backend adds.
  for (const [i, e] of (data.timeline ?? []).entries()) {
    if (STANDARD_EVENTS.has(e.event)) continue;
    items.push({
      key: `${e.event}-${i}`,
      icon: Globe,
      tint: TINT.plain,
      title: e.label ?? capitalizeFirst(e.event.replace(/_/g, " ")) ?? e.event,
      at: e.at,
      offset: true,
      body: <FieldList rows={detailRows(e.detail, t, locale)} />,
    });
  }

  if (legs.length) {
    items.push({
      key: "ringing",
      icon: PhoneOutgoing,
      tint: TINT.info,
      title:
        legs.length === 1
          ? fill(t("x565.ev.ringingOne"), { buyer: legs[0].buyer || legName(legs[0]) })
          : fill(t("x565.ev.ringingMany"), { n: legs.length }),
      at: legs[0].startedAt,
      offset: true,
      body: (
        <ol className="space-y-1.5">
          {legs.map((leg, i) => {
            const chip = legChip(leg, t);
            return (
              <li key={`${leg.destination}-${i}`} className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2">
                <span className="w-4 shrink-0 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px]">{legName(leg)}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{prettyPhone(leg.destination)}</p>
                </div>
                <Chip tone={chip.tone}>{chip.text}</Chip>
              </li>
            );
          })}
        </ol>
      ),
    });
  }

  if (answered) {
    items.push({
      key: "connected",
      icon: Link2,
      tint: TINT.good,
      title: t("x565.ev.connected"),
      at: panel.answeredAt,
      offset: true,
      body: <p className="text-[13px] text-muted-foreground">{t("x565.ev.connectedBody")}</p>,
    });
  }

  if (call.isConverted) {
    const rule = ruleText(call, panel, t);
    items.push({
      key: "converted",
      icon: CircleDollarSign,
      tint: TINT.good,
      title: t("x565.ev.converted"),
      at: panel.endedAt,
      offset: true,
      body: (
        <p className="text-[13px]">
          <span className="font-mono text-[color:var(--success)]">+{formatCurrency(call.revenue ?? 0, true)}</span>
          {rule && <span className="ml-3 text-muted-foreground">{rule}</span>}
        </p>
      ),
    });
  }

  if (panel.endedAt) {
    const reason = last?.reason ?? call.failReason;
    items.push({
      key: "ended",
      icon: PhoneOff,
      tint: TINT.plain,
      title: t("x565.ev.ended"),
      at: panel.endedAt,
      offset: true,
      body: (
        <p className="text-[13px] text-muted-foreground">
          {answered
            ? fill(t("x565.ev.endedTalk"), { n: panel.talkSeconds ?? 0 })
            : reason === "Not Connected"
              ? t("x565.ev.endedBefore")
              : reason
                ? locale === "en"
                  ? reason
                  : localizeFailReason(reason, locale, t)
                : t("x565.notAnswered")}
        </p>
      ),
    });
  }
  return items;
}

function MoreDetails({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent/80"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        {label}
      </button>
      {open && <div className="mt-2 pl-4">{children}</div>}
    </div>
  );
}

const STANDARD_EVENTS = new Set(["call_received", "caller_lookup", "destination_dialed", "connected", "converted", "ended"]);

function ActivityList({ items, timeZone, start }: { items: ActivityItem[]; timeZone: string; start?: string | null }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("toolsUI.reports.activity.noEvents")}</p>;
  }
  return (
    <div className="px-5 py-2">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="flex gap-4 py-3">
            <div className="relative w-9 shrink-0">
              <span className={cn("relative z-10 flex h-9 w-9 items-center justify-center rounded-lg border bg-background", item.tint)}>
                <Icon className="h-4 w-4" />
              </span>
              {i < items.length - 1 && (
                <span aria-hidden className="absolute -bottom-3 left-1/2 top-9 w-px -translate-x-1/2 bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {item.offset && offsetOf(item.at, start)}
                  <span className="ml-3">{timeOf(item.at ?? undefined, timeZone)}</span>
                </span>
              </div>
              {item.body && <div className="mt-2">{item.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── History (CH-565) ──────────────────────────────────────────────── */

function buildHistory(call: Call, panel: CallPanel, t: T, rule: string): HistoryItem[] {
  const legs = panel.legs ?? [];
  const last = legs[legs.length - 1];
  const timed: HistoryItem[] = [];
  const parts = [call.campaignName, call.publisherName, prettyPhone(call.calledNumber), panel.destinationName || call.buyerName]
    .filter(Boolean)
    .join(" · ");
  timed.push({ key: "created", title: t("x565.hist.created"), body: fill(t("x565.hist.createdBody"), { parts }), at: panel.startedAt, tone: "plain" });
  legs.forEach((leg, i) => {
    if (leg.result === "answered" || i === legs.length - 1) return;
    timed.push({
      key: `moved-${i}`,
      title: t("x565.hist.moved"),
      body: fill(t("x565.hist.movedBody"), { name: legName(leg), n: leg.ringSeconds ?? 0 }),
      at: legs[i + 1]?.startedAt,
      tone: "info",
    });
  });
  if (panel.answeredAt && last) {
    timed.push({
      key: "answered",
      title: t("x565.hist.answered"),
      body: fill(t("x565.hist.answeredBody"), { name: legName(last), n: last.ringSeconds ?? 0 }),
      at: panel.answeredAt,
      tone: "good",
    });
  }
  if (call.isConverted && panel.endedAt) {
    timed.push({
      key: "conversion",
      title: t("x565.hist.conversion"),
      body: fill(t("x565.hist.conversionBody"), {
        buyer: call.buyerName || panel.destinationName || "",
        amount: formatCurrency(call.revenue ?? 0, true),
        rule,
      }).replace(/ · $/, ""),
      at: panel.endedAt,
      tone: "info",
    });
  }
  if (panel.endedAt) {
    timed.push({ key: "ended", title: t("x565.hist.ended"), at: panel.endedAt, tone: "plain" });
  }
  timed.sort((a, b) => Date.parse(b.at ?? "") - Date.parse(a.at ?? ""));

  const untimed: HistoryItem[] = [];
  if (panel.answerConfirmedLater) untimed.push({ key: "confirmed", title: t("x565.hist.confirmed"), tone: "good" });
  if ((panel.senderTries ?? 1) > 1) {
    untimed.push({ key: "grouped", title: fill(t("x565.hist.grouped"), { n: panel.senderTries ?? 1 }), tone: "plain" });
  }
  return [...untimed, ...timed];
}

/* ─── Technical: routing rows (the old Parameters tab) ───────────────── */

function routingRows(data: CallActivity, t: T, locale: string): Array<[string, string | undefined | null]> {
  // The backend sends campaign_name / rule_name / ... (camelCased on the way
  // in); the older names are read too.
  const r = (data.routing ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = r[k];
      if (v !== null && v !== undefined && v !== "") return String(v);
    }
    return undefined;
  };
  const block = pick("blockReason");
  return [
    [t("toolsUI.reports.activity.campaign"), pick("campaignName", "campaign")],
    [t("toolsUI.reports.activity.rule"), pick("ruleName")],
    [t("toolsUI.reports.activity.ruleType"), capitalizeFirst(pick("ruleType"))],
    [t("toolsUI.reports.activity.destination"), prettyPhone(pick("destinationNumber", "destination")) || undefined],
    [t("toolsUI.reports.activity.buyer"), pick("buyerName", "buyer")],
    [t("toolsUI.reports.activity.publisher"), pick("publisherName", "publisher")],
    [t("toolsUI.reports.activity.blockReason"), block && (locale === "en" ? block : localizeFailReason(block, locale, t))],
  ];
}

/* ─── Activity timeline ─────────────────────────────────────────────── */

interface TimelineItem {
  key: string;
  icon: React.ElementType;
  tint: string;
  title: string;
  at?: string;
  body: React.ReactNode;
}

/** Before CH-565 (a backend without `panel`): the timeline as it was. */
function Timeline({ data, timeZone }: { data: CallActivity; timeZone: string }) {
  const { t, locale } = useTranslation();
  const trace = data.routingTrace;
  // The routing decision happens before the dial, so the call-plan block is
  // slotted in immediately above the first `destination_dialed` event and
  // borrows its timestamp. If the call never got as far as dialling, it
  // goes last so the trace is still visible on a blocked call.
  const dialIndex = data.timeline.findIndex((e) => e.event === "destination_dialed");

  const items: TimelineItem[] = [];
  const planItem = (at?: string): TimelineItem => ({
    key: "plan",
    icon: ListTree,
    tint: "bg-accent/15 text-accent",
    title: t("toolsUI.reports.activity.callPlan"),
    at,
    body: <CallPlanBody trace={trace} />,
  });

  data.timeline.forEach((event, i) => {
    if (i === dialIndex) items.push(planItem(event.at));
    const meta = EVENT_META[event.event] ?? { icon: PhoneIncoming, tint: "bg-muted text-muted-foreground" };
    // The backend's own label wins in English (it is English); in other
    // languages a known event is shown translated. The fallback keeps
    // unknown events readable so a new event type needs no frontend release.
    const fallbackKey = `toolsUI.reports.activity.events.${event.event}`;
    const translated = t(fallbackKey);
    items.push({
      key: `${event.event}-${i}`,
      icon: meta.icon,
      tint: meta.tint,
      title:
        (locale !== "en" && translated !== fallbackKey ? translated : undefined) ??
        event.label ??
        (translated === fallbackKey
          ? event.event.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
          : translated),
      at: event.at,
      body:
        event.event === "caller_lookup" ? (
          <ProfileFields profile={data.callerProfile} />
        ) : (
          <FieldList rows={detailRows(event.detail, t, locale)} />
        ),
    });
  });
  if (dialIndex === -1) items.push(planItem());

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("toolsUI.reports.activity.noEvents")}</p>;
  }

  return (
    <div>
      {items.map((item, i) => (
        <Row
          key={item.key}
          item={item}
          timeZone={timeZone}
          first={i === 0}
          last={i === items.length - 1}
          striped={i % 2 === 1}
        />
      ))}
    </div>
  );
}

/**
 * One timeline entry: a rail segment, the event icon, then the title with
 * its timestamp and whatever body the event carries.
 *
 * The rail is drawn per row rather than as one line behind everything —
 * the segment above the icon and the segment below it meet exactly at the
 * row boundary, so no piece of line has to be masked out from under an
 * icon that sits on a tinted background.
 */
function Row({
  item,
  timeZone,
  first,
  last,
  striped,
}: {
  item: TimelineItem;
  timeZone: string;
  first: boolean;
  last: boolean;
  striped: boolean;
}) {
  const Icon = item.icon;
  return (
    <div className={cn("flex gap-4 px-5 py-4", striped && "bg-secondary/20")}>
      <div className="relative w-8 shrink-0">
        {!first && (
          <span aria-hidden className="absolute -top-4 left-1/2 h-4 w-px -translate-x-1/2 bg-border" />
        )}
        <span className={cn("relative flex h-8 w-8 items-center justify-center rounded-lg", item.tint)}>
          <Icon className="h-4 w-4" />
        </span>
        {!last && (
          <span aria-hidden className="absolute -bottom-4 left-1/2 top-8 w-px -translate-x-1/2 bg-border" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">{item.title}</h3>
          <span className="shrink-0 text-[9.5px] font-medium tabular-nums text-muted-foreground">
            {timeOf(item.at, timeZone)}
          </span>
        </div>
        {item.body && <div className="mt-2">{item.body}</div>}
      </div>
    </div>
  );
}

function FieldList({ rows }: { rows: Array<[string, string]> }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      {rows.map(([label, value]) => (
        <Field key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[9.5px] font-medium tabular-nums">
      <span className="w-24 shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  );
}

/** Caller profile. Every field is dropped when null — the backend flags
 *  city / zip / timezone / fraud score as "null by design", and blank rows
 *  read as missing data rather than data that was never offered. */
/** First letter in capitals for values the backend sends in lower case
 *  (e.g. rule type "priority" → "Priority", line type "mobile" → "Mobile"). */
function capitalizeFirst(v: string | null | undefined): string | undefined {
  if (!v) return v ?? undefined;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function ProfileFields({ profile }: { profile: CallerProfile | undefined }) {
  const { t, locale } = useTranslation();
  if (!profile) return null;
  const rows: Array<[string, string]> = [];
  const add = (key: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return;
    rows.push([t(`toolsUI.reports.activity.profile.${key}`), String(v)]);
  };
  add("city", profile.city);
  add("region", profile.region);
  add("carrier", profile.carrier);
  add("country", profile.country);
  add("timezone", profile.timezone);
  add("zipCode", profile.zipCode);
  const lineTypeKey = profile.lineType ? LINE_TYPE_KEYS[profile.lineType.toLowerCase()] : undefined;
  add("lineType", locale !== "en" && lineTypeKey ? t(lineTypeKey) : capitalizeFirst(profile.lineType));
  if (profile.isVoip !== null && profile.isVoip !== undefined) {
    add("voip", profile.isVoip ? t("common.yes") : t("common.no"));
  }
  add("fraudScore", profile.fraudScore);
  add("areaCode", profile.areaCode);
  add("localFormat", profile.localFormat);
  add("originalFormat", profile.number);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("toolsUI.reports.activity.noProfile")}</p>;
  }
  return (
    <div className="space-y-1">
      {rows.map(([label, value]) => (
        <Field key={label} label={label} value={value} />
      ))}
    </div>
  );
}

/* ─── Call plan / routing trace ─────────────────────────────────────── */

function CallPlanBody({ trace }: { trace: RoutingTrace | undefined }) {
  const { t, locale } = useTranslation();
  const present = hasRoutingTrace(trace);
  const s = trace?.summary ?? {};

  // Calls placed before the trace was recorded come back as `{}`.
  if (!present) {
    return <p className="text-xs text-muted-foreground">{t("toolsUI.reports.activity.traceNotRecorded")}</p>;
  }

  return (
    <div className="space-y-1.5">
      <Disclosure label={t("toolsUI.reports.activity.totalDestinations")} count={s.totalDestinations} plain />
      <Disclosure
        label={t("toolsUI.reports.activity.eligibleDestinations")}
        count={s.eligible ?? trace?.eligibleDestinations?.length}
      >
        <DestinationList items={trace?.eligibleDestinations} numbered />
      </Disclosure>
      <Disclosure
        label={t("toolsUI.reports.activity.ineligibleDestinations")}
        count={s.rejected ?? trace?.rejectedDestinations?.length}
      >
        <DestinationList items={trace?.rejectedDestinations} showReason />
      </Disclosure>
      {/* Not the same as rejected: routing stops at the first destination
          that passes, so these were never examined. */}
      {s.notReached !== undefined && s.notReached > 0 && (
        <Disclosure label={t("toolsUI.reports.activity.notReached")} count={s.notReached} plain />
      )}
      <Disclosure
        label={t("toolsUI.reports.activity.filteringBreakdown")}
        count={trace?.filteringBreakdown?.reduce((a, b) => a + (b.count ?? 0), 0)}
      >
        <ul className="space-y-1 pt-1">
          {(trace?.filteringBreakdown ?? []).map((b) => (
            <li key={b.reason} className="flex justify-between gap-3 text-[9.5px] font-medium">
              <span className="text-muted-foreground">{b.reason}</span>
              <span className="tabular-nums">{b.count}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
      {(trace?.steps?.length ?? 0) > 0 && (
        <Disclosure label={t("toolsUI.reports.activity.checks")} count={trace?.steps?.length}>
          <ul className="space-y-1 pt-1">
            {(trace?.steps ?? []).map((step) => (
              <li key={step.step} className="flex items-center justify-between gap-3 text-[9.5px] font-medium">
                <span className="text-muted-foreground">
                  {locale !== "en" && STEP_KEYS[step.step] ? t(STEP_KEYS[step.step]) : capitalizeFirst(step.step.replace(/_/g, " "))}
                </span>
                <span className={step.passed ? "text-[color:var(--success)]" : "text-destructive"}>
                  {capitalizeFirst(
                    step.passed
                      ? t("toolsUI.reports.activity.passed")
                      : step.detail || t("toolsUI.reports.activity.failed"),
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

function Disclosure({
  label,
  count,
  plain = false,
  children,
}: {
  label: string;
  count?: number;
  /** No expandable body — just the heading and its count. */
  plain?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const heading = `${label}${count === undefined ? "" : ` (${count})`}`;
  if (plain || !count) {
    return <div className="py-0.5 pl-4 text-[9.5px] font-medium text-muted-foreground">{heading}</div>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 py-0.5 text-left text-[9.5px] font-medium text-accent transition-colors hover:text-accent/80"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        {heading}
      </button>
      {open && <div className="pl-4">{children}</div>}
    </div>
  );
}

function DestinationList({
  items,
  numbered = false,
  showReason = false,
}: {
  items: TraceDestination[] | undefined;
  numbered?: boolean;
  showReason?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <ol className="space-y-0.5 pt-1">
      {items.map((d, i) => (
        <li key={`${d.name}-${i}`} className="flex gap-2 text-[9.5px] font-medium tabular-nums">
          {numbered && <span className="w-6 shrink-0 text-right text-muted-foreground">{i + 1}.</span>}
          <span className="min-w-0 break-all"><LocalName name={d.name} /></span>
          {showReason && d.reason && (
            <span className="ml-auto shrink-0 text-[9.5px] text-muted-foreground">{d.reason}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

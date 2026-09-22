"use client";

/**
 * Call activity — the "X-ray" on a single call, opened from the Call Log's
 * row expander.
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
  ArrowLeft,
  ChevronRight,
  ContactRound,
  ListTree,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOff,
  Repeat2,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "@/hooks/use-translation";
import {
  callsService,
  hasRoutingTrace,
  type CallActivity,
  type CallActivityEvent,
  type CallerProfile,
  type RoutingTrace,
  type TraceDestination,
} from "@/lib/api/services/calls.service";
import { formatCallerId, formatCurrency } from "@/lib/format";
import { useUIStore } from "@/lib/store/ui-store";
import type { Call } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  return new Date(ms).toLocaleTimeString(undefined, {
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
  return new Date(ms).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone,
  });
}

/** Turn an event's free-form `detail` object into label/value rows. Keys
 *  arrive camelCased by the HTTP layer; they're de-camelised for display so
 *  a new backend key needs no frontend change to read properly. */
function detailRows(detail: Record<string, unknown> | null | undefined): Array<[string, string]> {
  if (!detail) return [];
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") continue;
    const label = k
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();
    out.push([label, String(v)]);
  }
  return out;
}

export function CallActivityPanel({ call, onOpenChange }: Props) {
  const { t } = useTranslation();
  const timeZone = useUIStore((s) => s.reportTimezone);
  const [tab, setTab] = React.useState<"activity" | "parameters">("activity");
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
  const header = data?.timeline?.[0]?.at ?? (call ? new Date(call.startedAt).toISOString() : undefined);

  return (
    <Sheet open={!!call} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl"
      >
        <SheetHeader className="space-y-0 border-b border-border/60 p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("toolsUI.reports.activity.close")}
            </button>
            <span className="rounded-md bg-accent/15 px-2.5 py-1 font-mono text-xs text-accent">
              {data?.callerProfile?.number ?? caller}
            </span>
          </div>
          <SheetTitle className="sr-only">
            {t("toolsUI.reports.activity.title").replace("{caller}", caller)}
          </SheetTitle>
          <div className="flex gap-5 px-5">
            {(["activity", "parameters"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px border-b-2 py-3 text-xs font-semibold uppercase tracking-wider transition-colors",
                  tab === id
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`toolsUI.reports.activity.tabs.${id}`)}
              </button>
            ))}
          </div>
        </SheetHeader>

        {loading && !data ? (
          <p className="p-6 text-sm text-muted-foreground">{t("toolsUI.reports.activity.loading")}</p>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !data ? null : tab === "activity" ? (
          <div className="p-5">
            {header && (
              <p className="pb-4 text-center text-xs font-medium text-muted-foreground">
                {dayOf(header, timeZone)}
              </p>
            )}
            <Timeline data={data} timeZone={timeZone} />
          </div>
        ) : (
          <ParametersTab data={data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Activity timeline ─────────────────────────────────────────────── */

function Timeline({ data, timeZone }: { data: CallActivity; timeZone: string }) {
  const { t } = useTranslation();
  const trace = data.routingTrace;
  // The routing decision happens before the dial, so the call-plan block is
  // slotted in immediately above the first `destination_dialed` event and
  // borrows its timestamp. If the call never got as far as dialling, it
  // goes last so the trace is still visible on a blocked call.
  const dialIndex = data.timeline.findIndex((e) => e.event === "destination_dialed");

  const blocks: React.ReactNode[] = [];
  data.timeline.forEach((event, i) => {
    if (i === dialIndex) {
      blocks.push(
        <CallPlanBlock key="plan" trace={trace} at={event.at} timeZone={timeZone} />,
      );
    }
    blocks.push(
      <EventBlock key={`${event.event}-${i}`} event={event} data={data} timeZone={timeZone} />,
    );
  });
  if (dialIndex === -1) {
    blocks.push(<CallPlanBlock key="plan" trace={trace} timeZone={timeZone} />);
  }

  if (blocks.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("toolsUI.reports.activity.noEvents")}</p>;
  }
  return <div className="space-y-2">{blocks}</div>;
}

/** One timeline row: icon rail, title, timestamp, and whatever body the
 *  event carries. */
function Row({
  icon: Icon,
  tint,
  title,
  at,
  timeZone,
  children,
}: {
  icon: React.ElementType;
  tint: string;
  title: string;
  at?: string;
  timeZone: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-secondary/25 p-4">
      <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tint)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {timeOf(at, timeZone)}
          </span>
        </div>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}

function EventBlock({
  event,
  data,
  timeZone,
}: {
  event: CallActivityEvent;
  data: CallActivity;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const meta = EVENT_META[event.event] ?? { icon: PhoneIncoming, tint: "bg-muted text-muted-foreground" };
  // Backend's own label wins; the fallback keeps unknown events readable.
  const fallback = t(`toolsUI.reports.activity.events.${event.event}`);
  const title =
    event.label ??
    (fallback === `toolsUI.reports.activity.events.${event.event}`
      ? event.event.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
      : fallback);

  const body =
    event.event === "caller_lookup" ? (
      <ProfileFields profile={data.callerProfile} />
    ) : (
      <div className="space-y-1">
        {detailRows(event.detail).map(([label, value]) => (
          <Field key={label} label={label} value={value} />
        ))}
      </div>
    );

  return (
    <Row icon={meta.icon} tint={meta.tint} title={title} at={event.at} timeZone={timeZone}>
      {body}
    </Row>
  );
}

/** Caller profile. Every field is dropped when null — the backend flags
 *  city / zip / timezone / fraud score as "null by design", and blank rows
 *  read as missing data rather than data that was never offered. */
function ProfileFields({ profile }: { profile: CallerProfile | undefined }) {
  const { t } = useTranslation();
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
  add("lineType", profile.lineType);
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

function CallPlanBlock({
  trace,
  at,
  timeZone,
}: {
  trace: RoutingTrace | undefined;
  at?: string;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const present = hasRoutingTrace(trace);
  const s = trace?.summary ?? {};

  return (
    <Row
      icon={ListTree}
      tint="bg-accent/15 text-accent"
      title={t("toolsUI.reports.activity.callPlan")}
      at={at}
      timeZone={timeZone}
    >
      {!present ? (
        // Calls placed before the trace was recorded come back as `{}`.
        <p className="text-xs text-muted-foreground">{t("toolsUI.reports.activity.traceNotRecorded")}</p>
      ) : (
        <div className="space-y-1.5">
          <Disclosure
            label={t("toolsUI.reports.activity.totalDestinations")}
            count={s.totalDestinations}
            plain
          />
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
          {/* Not the same as rejected: routing stops at the first
              destination that passes, so these were never examined. */}
          {s.notReached !== undefined && s.notReached > 0 && (
            <Disclosure label={t("toolsUI.reports.activity.notReached")} count={s.notReached} plain />
          )}
          <Disclosure
            label={t("toolsUI.reports.activity.filteringBreakdown")}
            count={trace?.filteringBreakdown?.reduce((a, b) => a + (b.count ?? 0), 0)}
          >
            <ul className="space-y-1 pt-1">
              {(trace?.filteringBreakdown ?? []).map((b) => (
                <li key={b.reason} className="flex justify-between gap-3 text-xs">
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
                  <li key={step.step} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{step.step.replace(/_/g, " ")}</span>
                    <span className={step.passed ? "text-[color:var(--success)]" : "text-destructive"}>
                      {step.passed
                        ? t("toolsUI.reports.activity.passed")
                        : step.detail || t("toolsUI.reports.activity.failed")}
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>
      )}
    </Row>
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
    return <div className="py-0.5 pl-4 text-xs text-muted-foreground">{heading}</div>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 py-0.5 text-left text-xs text-accent transition-colors hover:text-accent/80"
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
        <li key={`${d.name}-${i}`} className="flex gap-2 font-mono text-xs">
          {numbered && <span className="w-6 shrink-0 text-right text-muted-foreground">{i + 1}.</span>}
          <span className="min-w-0 break-all">{d.name}</span>
          {showReason && d.reason && (
            <span className="ml-auto shrink-0 font-sans text-[11px] text-muted-foreground">{d.reason}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/* ─── Parameters tab ────────────────────────────────────────────────── */

/** Routing, money and recording — the sections of the payload that aren't
 *  timeline events. */
function ParametersTab({ data }: { data: CallActivity }) {
  const { t } = useTranslation();
  const money = (v: number | string | null | undefined) =>
    v === null || v === undefined ? undefined : formatCurrency(Number(v), true);

  const groups: Array<{ title: string; rows: Array<[string, string | undefined]> }> = [
    {
      title: t("toolsUI.reports.activity.routing"),
      rows: [
        [t("toolsUI.reports.activity.campaign"), data.routing?.campaign ?? undefined],
        [t("toolsUI.reports.activity.rule"), data.routing?.ruleName ?? undefined],
        [t("toolsUI.reports.activity.ruleType"), data.routing?.ruleType ?? undefined],
        [t("toolsUI.reports.activity.destination"), data.routing?.destination ?? undefined],
        [t("toolsUI.reports.activity.buyer"), data.routing?.buyer ?? undefined],
        [t("toolsUI.reports.activity.publisher"), data.routing?.publisher ?? undefined],
        [t("toolsUI.reports.activity.blockReason"), data.routing?.blockReason ?? undefined],
      ],
    },
    {
      title: t("toolsUI.reports.activity.financials"),
      rows: [
        [t("toolsUI.reports.activity.revenue"), money(data.financials?.revenue)],
        [t("toolsUI.reports.activity.payout"), money(data.financials?.payout)],
        [t("toolsUI.reports.activity.profit"), money(data.financials?.profit)],
        [
          t("toolsUI.reports.activity.minDuration"),
          data.financials?.minCallDuration == null ? undefined : `${data.financials.minCallDuration}s`,
        ],
      ],
    },
    {
      title: t("toolsUI.reports.activity.recording"),
      rows: [
        [t("toolsUI.reports.activity.sentiment"), data.recording?.sentiment ?? undefined],
        [t("toolsUI.reports.activity.transcription"), data.recording?.transcription ?? undefined],
      ],
    },
  ];

  return (
    <div className="space-y-5 p-5">
      {groups.map((g) => {
        const rows = g.rows.filter(([, v]) => v !== undefined && v !== "");
        if (rows.length === 0) return null;
        return (
          <section key={g.title}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.title}
            </h3>
            <div className="space-y-1 rounded-lg bg-secondary/25 p-4">
              {rows.map(([label, value]) => (
                <Field key={label} label={label} value={value} />
              ))}
            </div>
          </section>
        );
      })}
      {data.recording?.url && (
        <audio controls src={data.recording.url} className="w-full">
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}

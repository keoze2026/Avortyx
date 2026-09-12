"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Flag,
  Hash,
  MapPin,
  MessageSquareText,
  Phone,
  PhoneIncoming,
  PlayCircle,
  Radio,
  Signal,
  Tag,
  Users,
} from "lucide-react";

import { CallStatusBadge } from "./call-status-badge";
import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { callsService, type CallDetail } from "@/lib/api/services/calls.service";
import { ROUTES } from "@/lib/constants";
import { formatCallerId, formatCurrency, formatDuration, formatRelativeTime, toE164 } from "@/lib/format";
import type { Call } from "@/lib/types";

interface Props {
  call: Call | null;
  onOpenChange: (open: boolean) => void;
}

/* ─── Deterministic per-call synthetic enrichment ───────────────────────
 * The Call record doesn't store carrier / line-type / country (those come
 * from a CNAM / number-intelligence lookup in production). For the demo
 * surface we derive them from `call.id` via a stable hash so the same call
 * always shows the same values across renders. */

const CARRIERS = ["AT&T", "Verizon", "T-Mobile", "Sprint", "US Cellular", "Cricket"];
const LINE_TYPES = ["Mobile", "Landline", "VoIP", "Toll-free"] as const;
const COUNTRIES: Array<{ name: string; flag: string }> = [
  { name: "United States", flag: "🇺🇸" },
  { name: "Canada", flag: "🇨🇦" },
  { name: "Mexico", flag: "🇲🇽" },
  { name: "United Kingdom", flag: "🇬🇧" },
  { name: "Australia", flag: "🇦🇺" },
];

function hash(s: string, salt: number): number {
  let h = salt | 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface CallEnrichment {
  country: { name: string; flag: string };
  carrier: string;
  lineType: (typeof LINE_TYPES)[number];
}

function enrich(call: Call): CallEnrichment {
  return {
    // US-formatted callers always resolve to United States; anything else
    // gets a stable bucket. (All mock data is US right now, but keeping the
    // branch makes the field meaningful when international traffic arrives.)
    country: call.callerNumber.startsWith("+1")
      ? COUNTRIES[0]
      : COUNTRIES[hash(call.id, 101) % COUNTRIES.length],
    carrier: CARRIERS[hash(call.id, 203) % CARRIERS.length],
    lineType: LINE_TYPES[hash(call.id, 307) % LINE_TYPES.length],
  };
}

export function CallDetailSheet({ call, onOpenChange }: Props) {
  const { t } = useTranslation();
  const open = !!call;
  const enrichment = call ? enrich(call) : null;

  // Fetch transcription + sentiment when the sheet opens on a call. Silent
  // on failure — the sheet still works with just the data passed in.
  const [detail, setDetail] = useState<CallDetail | null>(null);
  useEffect(() => {
    if (!call) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const full = await callsService.get(call.id);
        if (!cancelled) setDetail(full);
      } catch {
        // Backend may not have this call or transcription isn't ready.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {call && (
          <>
            <SheetHeader className="border-b border-border/60 p-6">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>{call.id}</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{formatRelativeTime(call.startedAt)}</span>
                <span className="text-muted-foreground/40">·</span>
                <span>{new Date(call.startedAt).toLocaleString()}</span>
              </div>
              <SheetTitle className="font-mono text-lg">{formatCallerId(call.callerNumber)}</SheetTitle>
              <SheetDescription>
                <CallStatusBadge status={call.status} />
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Headline KPIs */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label={t("toolsUI.callLogs.detail.duration")} value={call.durationSec > 0 ? formatDuration(call.durationSec) : "—"} />
                <Stat
                  label={t("toolsUI.callLogs.detail.payout")}
                  value={call.payout > 0 ? formatCurrency(call.payout, true) : "—"}
                  highlight={call.payout > 0}
                />
                <Stat
                  label={t("toolsUI.callLogs.detail.revenue")}
                  value={call.revenue > 0 ? formatCurrency(call.revenue, true) : "—"}
                />
              </div>

              {/* Routing timeline */}
              <section className="mt-6">
                <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("toolsUI.callLogs.detail.routingPath")}
                </h3>
                <ol className="mt-3 space-y-3">
                  <Step
                    icon={PhoneIncoming}
                    label={t("toolsUI.callLogs.detail.caller")}
                    value={formatCallerId(call.callerNumber)}
                    sub={call.geo.state ? `${call.geo.city}, ${call.geo.state}` : t("toolsUI.callLogs.detail.unknownGeo")}
                  />
                  <Step
                    icon={Users}
                    label={t("toolsUI.callLogs.detail.publisher")}
                    value={call.publisherName ?? "—"}
                    sub={call.publisherId}
                    href={call.publisherId ? `${ROUTES.publishers}/${call.publisherId}` : undefined}
                  />
                  <Step
                    icon={Hash}
                    label={t("toolsUI.callLogs.detail.trackingNumber")}
                    value={toE164(call.destinationNumber)}
                  />
                  <Step
                    icon={Tag}
                    label={t("toolsUI.callLogs.detail.campaign")}
                    value={call.campaignName}
                    sub={call.campaignId}
                    href={`${ROUTES.campaigns}/${call.campaignId}`}
                  />
                  <Step
                    icon={Building2}
                    label={t("toolsUI.callLogs.detail.buyer")}
                    value={call.buyerName ?? t("toolsUI.callLogs.detail.unmatched")}
                    sub={call.buyerId}
                    href={call.buyerId ? `${ROUTES.buyers}/${call.buyerId}` : undefined}
                    final
                    won={call.status === "completed"}
                  />
                </ol>
              </section>

              {/* Geo + caller meta */}
              <section className="mt-6 grid grid-cols-2 gap-3">
                <MetaCell icon={MapPin} label={t("toolsUI.callLogs.detail.location")}>
                  {call.geo.state ? `${call.geo.city}, ${call.geo.state}` : "—"}
                </MetaCell>
                <MetaCell icon={Phone} label={t("toolsUI.callLogs.detail.destination")}>
                  <span className="font-mono">{toE164(call.destinationNumber)}</span>
                </MetaCell>
                <MetaCell icon={CheckCircle2} label={t("toolsUI.callLogs.detail.outcome")}>
                  {call.status === "completed" ? t("toolsUI.callLogs.detail.outcomeQualified") : call.status}
                </MetaCell>
                <MetaCell icon={DollarSign} label={t("toolsUI.callLogs.detail.revenuePayout")}>
                  <span className="font-mono">
                    {call.revenue > 0 ? formatCurrency(call.revenue, true) : "—"} /{" "}
                    {call.payout > 0 ? formatCurrency(call.payout, true) : "—"}
                  </span>
                </MetaCell>
                {/* Caller intelligence — country, carrier, line-type. Derived
                    from a CNAM/number-lookup in production; here it's a stable
                    per-call hash so the same call always shows the same data. */}
                {enrichment && (
                  <>
                    <MetaCell icon={Flag} label={t("toolsUI.callLogs.detail.country")}>
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden>{enrichment.country.flag}</span>
                        {enrichment.country.name}
                      </span>
                    </MetaCell>
                    <MetaCell icon={Radio} label={t("toolsUI.callLogs.detail.carrier")}>
                      {enrichment.carrier}
                    </MetaCell>
                    <MetaCell icon={Signal} label={t("toolsUI.callLogs.detail.lineType")}>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className={
                            enrichment.lineType === "Mobile"
                              ? "h-1.5 w-1.5 rounded-full bg-[oklch(0.65_0.18_155)]"
                              : enrichment.lineType === "VoIP"
                                ? "h-1.5 w-1.5 rounded-full bg-[color:var(--warning)]"
                                : enrichment.lineType === "Landline"
                                  ? "h-1.5 w-1.5 rounded-full bg-accent"
                                  : "h-1.5 w-1.5 rounded-full bg-muted-foreground"
                          }
                        />
                        {enrichment.lineType}
                      </span>
                    </MetaCell>
                  </>
                )}
              </section>

              {/* Transcription + sentiment — populated lazily from
                  /api/routing/calls/{id} once the sheet opens. */}
              {detail?.transcription && detail.transcription.text && (
                <section className="mt-6 rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="inline-flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                      <MessageSquareText className="h-3.5 w-3.5" />
                      Transcription
                    </h3>
                    {detail.sentiment && (
                      <SentimentChip
                        label={detail.sentiment.label}
                        score={detail.sentiment.score}
                      />
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {detail.transcription.text}
                  </p>
                  {detail.transcription.status && detail.transcription.status !== "done" && (
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Status · {detail.transcription.status}
                    </p>
                  )}
                </section>
              )}

              {/* Recording — render the player when the backend exposes a URL,
                  otherwise show the legacy placeholder. */}
              {(detail?.recordingUrl || call.recordingUrl) ? (
                <section className="mt-6 rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    <PlayCircle className="h-3.5 w-3.5 text-accent" />
                    Recording
                  </div>
                  <audio
                    src={detail?.recordingUrl ?? call.recordingUrl}
                    controls
                    preload="none"
                    className="w-full"
                  />
                </section>
              ) : (
                <section className="mt-6 rounded-lg border border-dashed border-border/60 bg-secondary/30 p-4 text-center">
                  <PlayCircle className="mx-auto h-6 w-6 text-accent" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("toolsUI.callLogs.detail.recordingNote")}
                  </p>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SentimentChip({
  label,
  score,
}: {
  label: "positive" | "neutral" | "negative" | "mixed" | "unknown";
  score: number | null;
}) {
  const tone =
    label === "positive"
      ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]"
      : label === "negative"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : label === "mixed"
          ? "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
          : "border-border bg-secondary/40 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
      {typeof score === "number" && (
        <span className="font-mono tabular-nums opacity-70">
          {score >= 0 ? "+" : ""}
          {score.toFixed(2)}
        </span>
      )}
    </span>
  );
}

/* ----- helpers ----- */

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-accent/40 bg-accent/5" : "border-border bg-secondary/30"
      }`}
    >
      <div className="font-mono text-base font-bold">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Step({
  icon: Icon,
  label,
  value,
  sub,
  href,
  final,
  won,
}: {
  icon: typeof PhoneIncoming;
  label: string;
  value: string;
  sub?: string | undefined;
  href?: string;
  final?: boolean;
  won?: boolean;
}) {
  const tone =
    final && won
      ? "border-[color:var(--success)]/40 text-[color:var(--success)] bg-[color:var(--success)]/10"
      : final
        ? "border-border text-muted-foreground bg-secondary/30"
        : "border-accent/40 text-accent bg-accent/10";

  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3"
    >
      <span className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 truncate text-sm font-medium transition-colors hover:text-accent"
          >
            {value}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <div className="truncate text-sm font-medium">{value}</div>
        )}
        {sub && <div className="truncate text-[10px] font-mono text-muted-foreground/70">{sub}</div>}
      </div>
    </motion.li>
  );
}

function MetaCell({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-xs">{children}</div>
    </div>
  );
}

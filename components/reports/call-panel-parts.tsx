"use client";

/**
 * CH-565: the pieces of Sir's call panel - header, flow card, figures,
 * ring / talk bar, recording player, and the Technical and History tabs.
 *
 * Rules, as for the rest of the panel:
 *   - Only what the call stored is shown. A value that is not there is left
 *     out, never drawn as 0 or a guess. Audio quality, sub-second connection
 *     steps and who hung up an answered call are not measured, so they have
 *     no row here.
 *   - No real server, carrier, provider or tool name: "Server 1", "Carrier 1"
 *     (Sir, 5 Nov). The caller's own phone company stays, as in his design.
 *   - Nothing from the AI audit (CH-548 keeps it to its own logins).
 */

import * as React from "react";
import {
  Building2,
  Check,
  Copy,
  Download,
  Hash,
  Megaphone,
  Pause,
  Phone,
  Play,
  X,
} from "lucide-react";

import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { usePartnerHiddenColumns } from "@/hooks/use-partner-report-columns";
import { useTranslation } from "@/hooks/use-translation";
import type { CallLeg, CallPanel } from "@/lib/api/services/calls.service";
import { failReasonLabel, localizeFailReason } from "@/lib/fail-reason";
import { formatCurrency, formatLocalDateTime, uiLocaleTag } from "@/lib/format";
import { useAuthStore } from "@/lib/store/auth-store";
import type { Call } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ─── Who is looking (CH-566) ────────────────────────────────────────── */

/**
 * What this login may see, by the same rules as the Call Log row it opened
 * the panel from: a buyer never sees time to answer (CH-325), our campaign,
 * publisher, tracking number or routing (CH-375), or payout; a publisher
 * never sees revenue; columns the admin switched off for a partner stay off;
 * the recording only with the Audio Recording permission.
 */
export interface Viewer {
  buyer: boolean;
  showRevenue: boolean;
  showPayout: boolean;
  showTtc: boolean;
  showTfn: boolean;
  showCampaign: boolean;
  showPublisher: boolean;
  /** Routing, checks and the other destinations tried - our side. */
  showRouting: boolean;
  canListen: boolean;
}

export function useViewer(): Viewer {
  const role = useAuthStore((s) => s.user?.role);
  const hidden = usePartnerHiddenColumns().log;
  const can = usePartnerPermissions().can;
  const buyer = role === "buyer";
  const publisher = role === "publisher";
  return {
    buyer,
    showRevenue: !publisher && !hidden.has("revenue"),
    showPayout: !buyer && !hidden.has("payout"),
    showTtc: !buyer && !hidden.has("ttc"),
    showTfn: !buyer && !hidden.has("dialed"),
    showCampaign: !buyer && !hidden.has("campaign"),
    showPublisher: !buyer && !hidden.has("publisher"),
    showRouting: !buyer,
    canListen: can("audio_recording") && !hidden.has("recording"),
  };
}

/** The Payout the Call Log shows (its `customerPayout`): revenue minus the
 *  publisher's share. The raw `payout` field is the publisher's cut. */
export function customerPayout(c: Call): number {
  return Math.max(0, (c.revenue ?? 0) - (c.payout ?? 0));
}

/** A fail reason as the Call Log words it - never a raw internal code or a
 *  reason that names one of our servers. */
export function reasonText(reason: string | null | undefined, locale: string, t: (k: string) => string): string {
  const raw = (reason ?? "").trim();
  if (!raw) return "";
  if (/\bserver\s*[ab]\b/i.test(raw) || (/asterisk/i.test(raw) && !/^asterisk_gone$/i.test(raw))) return "";
  return locale === "en" ? failReasonLabel(raw) : localizeFailReason(raw, locale, t);
}

/** Answered, from the call itself - works with a backend without `panel`. */
export function isAnswered(call: Call): boolean {
  return call.status === "completed";
}

/** "{n} s" style placeholders. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), text);
}

/** +18552026099 -> "+1 855 202 6099"; anything else as sent. */
export function prettyPhone(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `+1 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return raw;
}

/** 33 -> "0:33", 2987 -> "49:47". */
export function clock(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export function timeOf(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString(uiLocaleTag(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  });
}

export function dateTimeOf(ms: number, timeZone: string): string {
  return formatLocalDateTime(ms, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
}

/** "+6.0 s" from the call's start. */
export function offsetOf(iso: string | null | undefined, start: string | null | undefined): string {
  if (!iso || !start) return "";
  const d = (Date.parse(iso) - Date.parse(start)) / 1000;
  if (!Number.isFinite(d)) return "";
  return `+${Math.max(0, d).toFixed(d >= 100 ? 0 : 1)} s`;
}

/** The name a destination is known by: its Destinations-page name, else buyer, else number. */
export function legName(leg: CallLeg | undefined): string {
  if (!leg) return "";
  return leg.name || leg.buyer || prettyPhone(leg.destination);
}

type Tone = "good" | "bad" | "live" | "plain";

export function statusOf(call: Call): { key: string; tone: Tone } {
  switch (call.status) {
    case "completed":
      return { key: "x565.status.completed", tone: "good" };
    case "in-progress":
      return { key: "x565.status.in_progress", tone: "live" };
    case "ringing":
      return { key: "x565.status.ringing", tone: "live" };
    case "missed":
      return call.statusRaw === "busy"
        ? { key: "x565.status.busy", tone: "bad" }
        : { key: "x565.status.no_answer", tone: "bad" };
    default:
      return { key: "x565.status.failed", tone: "bad" };
  }
}

const TONE: Record<Tone, string> = {
  good: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
  live: "border-accent/40 bg-accent/10 text-accent",
  plain: "border-border bg-secondary/40 text-muted-foreground",
};

export function Pill({ tone, children, dot = false }: { tone: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", TONE[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────── */

export function PanelHeader({
  call,
  panel,
  carrier,
  lineType,
  timeZone,
  onClose,
}: {
  call: Call;
  panel: CallPanel | undefined;
  carrier?: string | null;
  lineType?: string | null;
  timeZone: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);
  const status = statusOf(call);
  const id = panel?.displayId;
  const place = [call.geo?.city, call.geo?.state].filter(Boolean).join(", ");
  const facts = [place, carrier, lineType, dateTimeOf(call.startedAt, timeZone)].filter(Boolean);

  const copy = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused: nothing to do */
    }
  };

  return (
    <div className="px-5 pb-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("x565.call")}
          {id && <span className="ml-2 font-mono tracking-wide">· {id}</span>}
        </p>
        <div className="flex gap-1.5">
          {id && (
            <button
              type="button"
              onClick={copy}
              title={copied ? t("x565.copied") : t("x565.copyId")}
              aria-label={t("x565.copyId")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? <Check className="h-4 w-4 text-[color:var(--success)]" /> : <Copy className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("x565.close")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <h2 className="mt-3 font-mono text-2xl font-semibold tracking-wide tabular-nums">{prettyPhone(call.callerNumber)}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Pill tone={status.tone} dot>
          {t(status.key)}
        </Pill>
        <span className="text-sm text-muted-foreground">{facts.join(" · ")}</span>
      </div>
    </div>
  );
}

/* ─── Caller -> TFN -> Campaign -> Buyer ─────────────────────────────── */

export function FlowCard({
  call,
  panel,
  eligible,
  viewer,
}: {
  call: Call;
  panel: CallPanel | undefined;
  eligible?: number;
  viewer: Viewer;
}) {
  const { t } = useTranslation();
  const answered = isAnswered(call);
  const answeredIn = panel ? panel.answeredIn : call.ttc;
  const buyerName = panel?.destinationName || call.buyerName || "";
  const all: Array<{ icon: React.ElementType; label: string; value: string; sub: string; good?: boolean; show: boolean }> = [
    {
      icon: Phone,
      label: t("x565.caller"),
      value: prettyPhone(call.callerNumber).replace(/^\+1 /, ""),
      sub: panel?.repeat ?? call.isDuplicate ? t("x565.repeatCaller") : t("x565.firstCall"),
      show: true,
    },
    {
      icon: Hash,
      label: t("x565.tfn"),
      value: prettyPhone(call.calledNumber).replace(/^\+1 /, ""),
      sub: viewer.showPublisher ? call.publisherName ?? "" : "",
      show: viewer.showTfn,
    },
    {
      icon: Megaphone,
      label: t("x565.campaign"),
      value: call.campaignName || "—",
      sub: eligible != null ? fill(t("x565.eligible"), { n: eligible }) : "",
      show: viewer.showCampaign,
    },
    {
      icon: Building2,
      label: t("x565.buyer"),
      value: buyerName || "—",
      sub: answered
        ? viewer.showTtc && answeredIn != null
          ? fill(t("x565.answeredAfter"), { n: answeredIn })
          : t("x565.res.answered")
        : call.destinationNumber
          ? t("x565.notAnswered")
          : t("x565.notForwarded"),
      good: answered,
      show: true,
    },
  ];
  const cells = all.filter((c) => c.show);
  return (
    <div className={cn("mx-5 grid grid-cols-2 gap-4 rounded-xl border border-border/70 bg-secondary/20 p-4", SM_COLS[cells.length])}>
      {cells.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="min-w-0">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border border-border/70",
                c.good ? "text-[color:var(--success)]" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="mt-0.5 truncate font-mono text-[13px] tabular-nums" title={c.value}>
              {c.value}
            </p>
            {c.sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Figures and the ring / talk bar ────────────────────────────────── */

const SM_COLS: Record<number, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

export function Figures({ call, panel, viewer }: { call: Call; panel: CallPanel | undefined; viewer: Viewer }) {
  const { t } = useTranslation();
  const answered = isAnswered(call);
  // A backend without `panel` (before CH-565): the Call Log row's own figures.
  const total = panel ? panel.totalSeconds ?? null : null;
  const answeredIn = panel ? panel.answeredIn ?? null : answered ? call.ttc ?? null : null;
  const talk = panel ? panel.talkSeconds ?? 0 : answered ? call.durationSec ?? 0 : 0;
  const items: Array<[string, string]> = [];
  if (viewer.showTtc) items.push([t("x565.totalTime"), total == null ? "—" : clock(total)]);
  if (viewer.showRevenue) items.push([t("x565.revenue"), formatCurrency(call.revenue ?? 0, true)]);
  if (viewer.showPayout) items.push([t("x565.payout"), formatCurrency(customerPayout(call), true)]);
  if (viewer.showTtc) items.push([t("x565.answeredIn"), answeredIn == null ? "—" : `${answeredIn} s`]);
  else items.push([t("x566.talk"), answered ? clock(talk) : "—"]);
  const ring = viewer.showTtc ? answeredIn ?? panel?.waitSeconds ?? 0 : 0;
  const whole = Math.max(1, ring + talk);
  const bar = viewer.showTtc ? total != null || talk > 0 : talk > 0;
  return (
    <div className="px-5 pt-4">
      <div className={cn("grid grid-cols-2 gap-3", SM_COLS[items.length])}>
        {items.map(([label, value], i) => (
          <div key={label} className={cn("min-w-0", i > 0 && "sm:border-l sm:border-border/60 sm:pl-4")}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      {bar && (
        <div className="mt-4">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary">
            <span className="bg-muted-foreground/40" style={{ width: `${(ring / whole) * 100}%` }} />
            {talk > 0 && <span className="bg-accent" style={{ width: `${(talk / whole) * 100}%` }} />}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{viewer.showTtc ? fill(t("x565.ringing"), { n: ring }) : ""}</span>
            {talk > 0 && <span>{fill(t("x565.talkTime"), { n: talk })}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Recording player ───────────────────────────────────────────────── */

const BARS = 96;
// A long call is not decoded in the browser just to draw bars; it plays with
// a plain progress line instead.
const MAX_WAVE_BYTES = 12 * 1024 * 1024;

async function loadPeaks(url: string, signal: AbortSignal): Promise<number[] | null> {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const size = Number(res.headers.get("content-length") ?? 0);
  if (size > MAX_WAVE_BYTES) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_WAVE_BYTES) return null;
  const Ctx =
    typeof window !== "undefined"
      ? (window.OfflineAudioContext ??
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext)
      : undefined;
  if (!Ctx) return null;
  const audio = await new Ctx(1, 1, 8000).decodeAudioData(buf);
  const data = audio.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / BARS));
  const peaks: number[] = [];
  for (let b = 0; b < BARS; b++) {
    let max = 0;
    for (let i = b * step, end = Math.min(data.length, (b + 1) * step); i < end; i++) {
      const v = Math.abs(data[i]);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  const top = Math.max(...peaks, 0.0001);
  return peaks.map((p) => p / top);
}

export function RecordingPlayer({ url }: { url: string }) {
  const { t } = useTranslation();
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [now, setNow] = React.useState(0);
  const [length, setLength] = React.useState(0);
  const [rate, setRate] = React.useState(1);
  const [peaks, setPeaks] = React.useState<number[] | null>(null);

  React.useEffect(() => {
    const ctl = new AbortController();
    setPeaks(null);
    loadPeaks(url, ctl.signal)
      .then((p) => setPeaks(p))
      .catch(() => setPeaks(null));
    return () => ctl.abort();
  }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !length) return;
    const box = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.min(length, Math.max(0, ((e.clientX - box.left) / box.width) * length));
  };
  const nextRate = () => {
    const r = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };
  const done = length ? now / length : 0;

  return (
    <div className="mx-5 mt-4 rounded-xl border border-border/70 bg-secondary/20 p-4">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLength(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
      >
        <track kind="captions" />
      </audio>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t("x565.pause") : t("x565.play")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-90"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <div className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-px overflow-hidden sm:gap-[2px]" onClick={seek} role="presentation">
          {peaks ? (
            peaks.map((p, i) => (
              <span
                key={i}
                className={cn("min-w-0 flex-1 rounded-full", i / BARS < done ? "bg-accent" : "bg-muted-foreground/35")}
                style={{ height: `${Math.max(8, p * 100)}%` }}
              />
            ))
          ) : (
            <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-accent" style={{ width: `${done * 100}%` }} />
            </div>
          )}
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {clock(now)} / {clock(length)}
        </span>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={nextRate}
          aria-label={t("x565.speed")}
          className="rounded-md border border-border/70 px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          {rate}×
        </button>
        <a
          href={url}
          download
          target="_blank"
          rel="noreferrer"
          aria-label={t("x565.download")}
          title={t("x565.download")}
          className="flex items-center rounded-md px-1 text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

/* ─── Technical tab ──────────────────────────────────────────────────── */

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/70">
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/20 px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function KeyValue({ rows }: { rows: Array<[string, string | undefined | null]> }) {
  const shown = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  return (
    <div className="divide-y divide-border/50">
      {shown.map(([k, v]) => (
        <div key={k} className="flex gap-4 px-4 py-2.5 text-sm">
          <span className="w-36 shrink-0 text-muted-foreground">{k}</span>
          <span className="min-w-0 break-words font-mono text-[13px]">{v}</span>
        </div>
      ))}
    </div>
  );
}

function legResult(leg: CallLeg, t: (k: string) => string): { text: string; good: boolean } {
  if (leg.result === "answered") return { text: t("x565.res.answered"), good: true };
  if (leg.result === "busy") return { text: t("x565.res.busy"), good: false };
  return { text: t("x565.res.notAnswered"), good: false };
}

export function TechnicalTab({
  call,
  panel,
  routingRows,
  hasRecording,
  viewer,
}: {
  call: Call;
  panel: CallPanel | undefined;
  routingRows: Array<[string, string | undefined | null]>;
  hasRecording: boolean;
  viewer: Viewer;
}) {
  const { t } = useTranslation();
  const legs = panel?.legs ?? [];
  const answered = isAnswered(call);
  const recording = !hasRecording
    ? t("x565.tech.recNone")
    : panel?.recordingSides === "separate"
      ? t("x565.tech.recSeparate")
      : panel?.recordingSides === "mixed"
        ? t("x565.tech.recMixed")
        : t("x565.tech.recSaved");

  return (
    <div className="space-y-4 p-5">
      <Card title={t("x565.tech.call")}>
        <KeyValue
          rows={[
            [t("x565.tech.callId"), panel?.displayId],
            [t("x565.tech.session"), panel?.session],
            [t("x565.tech.server"), t("x565.tech.serverValue")],
            [t("x565.tech.carrier"), t("x565.tech.carrierValue")],
            [t("x565.tech.recording"), recording],
          ]}
        />
      </Card>

      <Card title={t("x565.tech.legs")} aside={<span className="text-xs text-muted-foreground">{legs.length + 1}</span>}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-semibold">{t("x565.tech.leg")}</th>
              <th className="px-2 py-2 font-semibold">{t("x565.tech.fromTo")}</th>
              <th className="px-2 py-2 font-semibold">{t("x565.tech.result")}</th>
              <th className="px-4 py-2 text-right font-semibold">{t("x565.tech.time")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <tr>
              <td className="px-4 py-2.5">{t("x565.tech.inbound")}</td>
              <td className="px-2 py-2.5 text-muted-foreground">{t("x565.tech.inboundPath")}</td>
              <td className={cn("px-2 py-2.5", answered ? "text-[color:var(--success)]" : "text-destructive")}>
                {answered ? t("x565.res.answered") : t("x565.res.notAnswered")}
              </td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                {panel?.totalSeconds == null ? "—" : clock(panel.totalSeconds)}
              </td>
            </tr>
            {legs.map((leg, i) => {
              const r = legResult(leg, t);
              const secs = leg.result === "answered" ? leg.talkSeconds : viewer.showTtc ? leg.ringSeconds : null;
              return (
                <tr key={`${leg.destination}-${i}`}>
                  <td className="px-4 py-2.5">{fill(t("x565.tech.outbound"), { n: i + 1 })}</td>
                  <td className="px-2 py-2.5 text-muted-foreground">
                    {fill(t("x565.tech.outboundPath"), { buyer: leg.buyer || legName(leg) })}
                  </td>
                  <td className={cn("px-2 py-2.5", r.good ? "text-[color:var(--success)]" : "text-destructive")}>{r.text}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{secs == null ? "—" : clock(secs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {viewer.showRouting && routingRows.some(([, v]) => v) && (
        <Card title={t("x565.tech.routing")}>
          <KeyValue rows={routingRows} />
        </Card>
      )}
    </div>
  );
}

/* ─── History tab ────────────────────────────────────────────────────── */

export interface HistoryItem {
  key: string;
  title: string;
  body?: string;
  at?: string | null;
  tone: "good" | "info" | "plain";
}

export function HistoryList({ items, timeZone }: { items: HistoryItem[]; timeZone: string }) {
  const { t } = useTranslation();
  return (
    <ul className="divide-y divide-border/50 px-5 py-2">
      {items.map((h) => (
        <li key={h.key} className="flex gap-4 py-4">
          <span
            className={cn(
              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
              h.tone === "good" ? "bg-[color:var(--success)]" : h.tone === "info" ? "bg-accent" : "bg-muted-foreground/50",
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{h.title}</p>
            {h.body && <p className="mt-0.5 break-words text-[13px] text-muted-foreground">{h.body}</p>}
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            {h.at && <p className="font-mono tabular-nums">{timeOf(h.at, timeZone)}</p>}
            <p>{t("x565.hist.system")}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

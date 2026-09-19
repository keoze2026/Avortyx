"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, MapPin, Phone, PhoneIncoming, PhoneMissed, PhoneOff, XCircle } from "lucide-react";
import { toast } from "sonner";

import { CallWaveform } from "@/components/live/call-waveform";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { formatCallerId, formatTimer } from "@/lib/format";
import type { Call, CallStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const STATUS_META: Record<
  CallStatus,
  { icon: typeof Phone; bg: string; ring: string; labelKey: string }
> = {
  ringing: {
    icon: PhoneIncoming,
    bg: "bg-accent/15 text-accent",
    ring: "ring-accent/40",
    labelKey: "liveUI.card.status.ringing",
  },
  "in-progress": {
    icon: Phone,
    bg: "bg-accent/15 text-accent",
    ring: "ring-accent/40",
    labelKey: "liveUI.card.status.inProgress",
  },
  completed: {
    icon: CheckCircle2,
    bg: "bg-[oklch(0.74_0.18_155)]/15 text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]",
    ring: "ring-[oklch(0.74_0.18_155)]/30",
    labelKey: "liveUI.card.status.won",
  },
  missed: {
    icon: PhoneMissed,
    bg: "bg-[oklch(0.78_0.16_75)]/15 text-[oklch(0.6_0.16_75)] dark:text-[oklch(0.82_0.16_75)]",
    ring: "ring-[oklch(0.78_0.16_75)]/30",
    labelKey: "liveUI.card.status.missed",
  },
  rejected: {
    icon: XCircle,
    bg: "bg-destructive/15 text-destructive",
    ring: "ring-destructive/30",
    labelKey: "liveUI.card.status.rejected",
  },
  failed: {
    icon: XCircle,
    bg: "bg-destructive/15 text-destructive",
    ring: "ring-destructive/30",
    labelKey: "liveUI.card.status.failed",
  },
};

interface LiveCallCardProps {
  call: Call;
  isLive: boolean;
  /** When given, live cards get a hang-up control (POST …/hangup). */
  onHangup?: (id: string) => Promise<string | undefined>;
}

export function LiveCallCard({ call, isLive, onHangup }: LiveCallCardProps) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const hangupControl = isLive && onHangup ? <HangupButton callId={call.id} onHangup={onHangup} /> : null;
  const live = isLive ? Math.max(0, Math.floor((now - call.startedAt) / 1000)) : call.durationSec;
  const meta = STATUS_META[call.status];
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-3 transition-colors",
        isLive && "ring-1 ring-accent/30",
      )}
    >
      {/* Pulsing left rail for live calls */}
      {isLive && (
        <div className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-transparent via-accent to-transparent animate-vortyx-pulse" />
      )}

      <div className="flex items-center gap-3">
        <div className={cn("relative inline-flex h-10 w-10 items-center justify-center rounded-lg", meta.bg)}>
          <Icon className="h-4 w-4" />
          {isLive && (
            <span className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm">{formatCallerId(call.callerNumber)}</span>
            <Badge variant="outline" className="text-[10px]">
              <MapPin className="h-2.5 w-2.5" /> {call.geo.state}
            </Badge>
            {call.publisherName && (
              <span className="hidden text-[10px] font-mono text-muted-foreground sm:inline">
                {t("liveUI.card.via")} {call.publisherName}
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">{call.campaignName}</div>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            {/* In-progress calls show a full waveform; ringing shows a paused
                low-amplitude waveform as a "audio not yet established" cue. */}
            {isLive && (call.status === "in-progress" || call.status === "ringing") && (
              <CallWaveform
                size="sm"
                active={call.status === "in-progress"}
                className="text-accent"
                label={
                  call.status === "in-progress"
                    ? t("liveUI.card.audioActive")
                    : t("liveUI.card.audioPending")
                }
              />
            )}
            <span className={cn("font-mono text-base font-semibold tabular-nums", isLive && "text-accent")}>
              {formatTimer(live)}
            </span>
            {hangupControl}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t(meta.labelKey)}</span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Two-step hang-up: first click arms it ("Confirm?"), second click within
 * 4 s sends the request. A stray click on a live card never ends a call.
 */
function HangupButton({
  callId,
  onHangup,
}: {
  callId: string;
  onHangup: (id: string) => Promise<string | undefined>;
}) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);

  const onClick = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      const message = await onHangup(callId);
      toast.success(t("liveUI.card.hangup.done"), { description: message });
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("liveUI.card.hangup.failed")));
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={t("liveUI.card.hangup.label")}
      title={t("liveUI.card.hangup.label")}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors disabled:opacity-60",
        armed
          ? "border-destructive bg-destructive text-destructive-foreground"
          : "border-border text-muted-foreground hover:border-destructive/60 hover:text-destructive",
      )}
    >
      <PhoneOff className="h-3.5 w-3.5" />
      {armed ? t("liveUI.card.hangup.confirm") : t("liveUI.card.hangup.label")}
    </button>
  );
}

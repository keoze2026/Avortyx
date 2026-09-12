"use client";

import { ArrowUpRight, CheckCircle2, Phone, PhoneMissed, XCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

import { CallWaveform } from "@/components/live/call-waveform";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { useCallsStore } from "@/lib/store/calls-store";
import { ROUTES } from "@/lib/constants";
import { formatCallerId, formatCurrency, formatDuration, formatRelativeTime } from "@/lib/format";
import type { CallStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<CallStatus, { icon: typeof Phone; color: string; label: string }> = {
  ringing: { icon: Phone, color: "text-accent", label: "Ringing" },
  "in-progress": { icon: Phone, color: "text-accent", label: "Live" },
  completed: { icon: CheckCircle2, color: "text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]", label: "Won" },
  missed: { icon: PhoneMissed, color: "text-[oklch(0.6_0.16_75)] dark:text-[oklch(0.82_0.16_75)]", label: "Missed" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Rejected" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
};

export function RecentCallsFeed() {
  const { t } = useTranslation();
  // IMPORTANT: subscribe to `s.recent` directly. Returning `s.recent.slice(0, 8)`
  // from inside the selector creates a NEW array reference on every call —
  // useSyncExternalStore invokes the selector twice during render to detect
  // tearing, sees the two new refs, and throws React error #185
  // (max update depth / "result of getSnapshot should be cached"). Slicing
  // *outside* the selector keeps the subscription tied to the stable
  // `s.recent` reference, then we render the visible window from the
  // local-scoped slice.
  const recent = useCallsStore((s) => s.recent);
  const calls = recent.slice(0, 8);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t("dashboard.recentCalls")}</CardTitle>
        <Link
          href={ROUTES.calls}
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("common.viewAll")} <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {calls.map((c, i) => {
          const meta = STATUS_META[c.status];
          const Icon = meta.icon;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.28 }}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/60"
            >
              <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md bg-secondary/60", meta.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs">{formatCallerId(c.callerNumber)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {c.geo.state}
                  </Badge>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">{c.campaignName}</div>
              </div>
              <div className="flex items-center justify-end gap-2 text-right">
                {/* Audio waveform when the call is live; ringing shows a
                    paused low-amplitude wave as an "audio pending" cue. */}
                {(c.status === "in-progress" || c.status === "ringing") && (
                  <CallWaveform
                    size="sm"
                    bars={5}
                    active={c.status === "in-progress"}
                    className="text-accent"
                    label={
                      c.status === "in-progress"
                        ? "Call audio active"
                        : "Call ringing, audio pending"
                    }
                  />
                )}
                <div>
                  <div className="font-mono text-xs">{formatDuration(c.durationSec)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.payout ? formatCurrency(c.payout, true) : meta.label}
                  </div>
                </div>
              </div>
              <div className="hidden w-16 text-right text-[10px] font-mono text-muted-foreground sm:block">
                {formatRelativeTime(c.startedAt)}
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}

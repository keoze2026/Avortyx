"use client";

import { motion } from "framer-motion";
import { Building2, GitFork, Hash, PhoneIncoming, Sparkles, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { formatCallerId } from "@/lib/format";
import type { Call } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoutingVisualizerProps {
  /** Featured call to visualize. If null, renders a placeholder. */
  call: Call | null;
}

const STEPS = [
  { key: "caller", labelKey: "liveUI.routing.steps.caller", icon: PhoneIncoming },
  { key: "publisher", labelKey: "liveUI.routing.steps.publisher", icon: Users },
  { key: "number", labelKey: "liveUI.routing.steps.number", icon: Hash },
  { key: "routing", labelKey: "liveUI.routing.steps.routing", icon: GitFork },
  { key: "buyer", labelKey: "liveUI.routing.steps.buyer", icon: Building2 },
] as const;

export function RoutingVisualizer({ call }: RoutingVisualizerProps) {
  const { t } = useTranslation();
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-accent" />
          {t("liveUI.routing.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {call
            ? `${t("liveUI.routing.watchingPrefix")} ${formatCallerId(call.callerNumber)}`
            : t("liveUI.routing.pickToFollow")}
        </p>
      </CardHeader>
      <CardContent>
        {!call ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
            {t("liveUI.routing.waitingInFlight")}
          </div>
        ) : (
          <div className="relative">
            {/* Connecting line */}
            <div
              aria-hidden
              className="absolute left-4 right-4 top-5 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
            />
            <ol className="relative grid grid-cols-5">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const value =
                  s.key === "caller"
                    ? call.callerNumber.slice(-7)
                    : s.key === "publisher"
                      ? call.publisherName ?? "—"
                      : s.key === "number"
                        ? call.destinationNumber.slice(-7)
                        : s.key === "routing"
                          ? call.campaignName.split(" ")[0]
                          : call.buyerName ?? t("liveUI.routing.state.pending");

                return (
                  <li key={s.key} className="flex flex-col items-center text-center">
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.08 * i, duration: 0.3 }}
                      className={cn(
                        "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-card",
                        s.key === "buyer" && call.status === "completed"
                          ? "border-[oklch(0.74_0.18_155)]/40 text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]"
                          : "border-accent/40 text-accent",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {(s.key === "caller" || (s.key === "buyer" && call.status === "in-progress")) && (
                        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent/20" />
                      )}
                    </motion.div>
                    <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {t(s.labelKey)}
                    </p>
                    <p className="truncate text-[11px] font-medium">{value}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

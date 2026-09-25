"use client";

/**
 * Account usage — calls / tracking-numbers / publishers counts. Every figure
 * is real: calls from the dashboard KPIs, the rest from the live entity
 * stores. There is no plan on the backend, so no limits, percentages or
 * warning states are shown.
 */

import { motion } from "framer-motion";
import { Building2, Gauge, Hash, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCallsStore } from "@/lib/store/calls-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { usePublishersStore } from "@/lib/store/publishers-store";
import { formatCompact } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

interface UsageMetric {
  key: string;
  label: string;
  icon: LucideIcon;
  used: number;
}

export function UsageGrid() {
  const { t } = useTranslation();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const kpis = useCallsStore((s) => s.kpis);
  const numbers = useNumbersStore((s) => s.numbers);
  const publishers = usePublishersStore((s) => s.publishers);

  const activePublishers = publishers.filter((p) => p.status === "active").length;
  const metrics: UsageMetric[] = [
    {
      key: "calls",
      label: tr("billing.usageMetrics.calls", "Calls routed"),
      icon: Gauge,
      used: kpis?.totalCalls ?? 0,
    },
    {
      key: "numbers",
      label: tr("billing.usageMetrics.numbers", "Tracking numbers"),
      icon: Hash,
      used: numbers.length,
    },
    {
      key: "publishers",
      label: tr("billing.usageMetrics.publishers", "Active publishers"),
      icon: Building2,
      used: activePublishers,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{tr("toolsUI.billing.usage.accountTitle", "Account usage")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {tr("toolsUI.billing.usage.accountDescription", "Current totals on your account")}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                className="rounded-lg border border-border bg-secondary/30 p-3"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="mt-3 font-mono text-lg font-semibold">{formatCompact(m.used)}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
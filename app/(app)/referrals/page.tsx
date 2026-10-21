"use client";

/**
 * Referrals page — live data, no mocks.
 *
 * Wires the four GET endpoints exposed by the Referral Program backend on
 * mount:
 *   GET /api/referrals/                  → program (code, link, rate, earnings)
 *   GET /api/referrals/stats             → summary stats
 *   GET /api/referrals/referred-clients  → list of all referred clients
 *
 * The 4th endpoint (`/spending-tracker`) is consumed inside `ReferralSpendChart`
 * because the range selector lives there. The 5th endpoint (`/invite`) is
 * fired from `InviteReferralDialog` when the partner sends an invite.
 */

import * as React from "react";
import { AlertTriangle, Check, Copy, Gift, Loader2, Mail, Users } from "lucide-react";
import { toast } from "sonner";

import { InviteReferralDialog } from "@/components/referrals/invite-referral-dialog";
import { ReferralSpendChart } from "@/components/referrals/referral-spend-chart";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { useTranslation } from "@/hooks/use-translation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  referralsService,
  type ReferralProgram,
  type ReferralStats,
  type ReferredClient,
} from "@/lib/api/services/referrals.service";
import { formatCurrency, formatNumber, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ReferralsPage() {
  const { t } = useTranslation();

  // ── Live data state ──────────────────────────────────────────────────
  const [program, setProgram] = React.useState<ReferralProgram | null>(null);
  const [stats, setStats] = React.useState<ReferralStats | null>(null);
  const [clients, setClients] = React.useState<ReferredClient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────────────
  const [copied, setCopied] = React.useState(false);
  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(0);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(0);
  }, [pageSize]);

  // Fire all three top-of-page fetches in parallel on mount.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      referralsService.getProgram(),
      referralsService.getStats(),
      referralsService.getReferredClients(),
    ])
      .then(([p, s, c]) => {
        if (cancelled) return;
        setProgram(p);
        setStats(s);
        setClients(c);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(friendlyErrorMessage(e, t("y.err.referralLoad")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleClients = React.useMemo(
    () => clients.slice(page * pageSize, page * pageSize + pageSize),
    [clients, page, pageSize],
  );

  // Prefer stats endpoint for the commission rate (it's authoritative);
  // fall back to the program endpoint if the stats call failed.
  const commissionRate = stats?.commissionRate ?? program?.commissionRate ?? 0;
  const commissionPct = `${(commissionRate * 100).toFixed(0)}%`;

  const onCopy = async () => {
    if (!program?.link) return;
    try {
      await navigator.clipboard.writeText(program.link);
      setCopied(true);
      toast.success(t("toolsUI.referrals.toastCopied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("toolsUI.referrals.toastCopyError"));
    }
  };

  return (
    <>
      <PageHeader
        title={t("toolsUI.referrals.pageTitle")}
        description={t("toolsUI.referrals.pageDescription").replace("{pct}", commissionPct)}
      />

      {error && !loading && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Hero — referral link + share CTA + lifetime earnings */}
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_320px]">
          <CardContent className="space-y-3 p-6">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/45 bg-accent/12 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
              <Gift className="h-3 w-3" />
              {t("toolsUI.referrals.partnerBadge")}
            </div>
            <h2 className="text-lg font-semibold leading-tight">
              {t("toolsUI.referrals.heroTitleBefore")}
              <span className="text-accent">{commissionPct}</span>
              {t("toolsUI.referrals.heroTitleAfter")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("toolsUI.referrals.heroBody").replace("{pct}", commissionPct)}
            </p>

            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("toolsUI.referrals.yourLink")}
              </span>
              <span className="flex-1 truncate font-mono text-xs text-foreground">
                {loading && !program ? "—" : (program?.link ?? "—")}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={onCopy}
                disabled={!program?.link}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> {t("toolsUI.referrals.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> {t("toolsUI.referrals.copy")}
                  </>
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("toolsUI.referrals.codeLabel")}
              </span>
              <span className="font-mono text-xs text-foreground">
                {loading && !program ? "—" : (program?.code ?? "—")}
              </span>
              <span className="mx-2 h-3 w-px self-center bg-border" />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setInviteOpen(true)}
              >
                <Mail className="h-3.5 w-3.5" /> {t("toolsUI.referrals.emailContact")}
              </Button>
            </div>
          </CardContent>

          {/* Lifetime earnings hero number */}
          <div className="flex flex-col justify-center gap-1 border-l border-border bg-secondary/20 p-6">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("toolsUI.referrals.lifetimeEarnings")}
            </span>
            <span className="text-3xl font-semibold tabular-nums text-foreground">
              {loading && !program ? "—" : formatCurrency(program?.lifetimeEarnings ?? 0)}
            </span>
            <span className="text-[11px] text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]">
              {t("toolsUI.referrals.earnedThisMonth").replace(
                "{amount}",
                formatCurrency(program?.thisMonthEarnings ?? stats?.thisMonthEarnings ?? 0),
              )}
            </span>
          </div>
        </div>
      </Card>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Users}
          label={t("toolsUI.referrals.stats.totalReferrals")}
          value={loading && !stats ? "—" : formatNumber(stats?.totalReferrals ?? 0)}
        />
        <StatCard
          icon={Users}
          label={t("toolsUI.referrals.stats.activeReferrals")}
          value={loading && !stats ? "—" : formatNumber(stats?.activeReferrals ?? 0)}
        />
        <StatCard
          icon={Gift}
          label={t("toolsUI.referrals.stats.commissionRate")}
          value={commissionPct}
        />
        <StatCard
          icon={Gift}
          label={t("toolsUI.referrals.stats.thisMonth")}
          value={
            loading && !stats
              ? "—"
              : formatCurrency(stats?.thisMonthEarnings ?? program?.thisMonthEarnings ?? 0)
          }
        />
      </div>

      {/* Referred clients table */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-base font-semibold">{t("toolsUI.referrals.table.title")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("toolsUI.referrals.table.description").replace("{pct}", commissionPct)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 text-left">{t("toolsUI.referrals.table.columns.client")}</TableHead>
                <TableHead className="text-left">{t("toolsUI.referrals.table.columns.vertical")}</TableHead>
                <TableHead className="text-left">{t("toolsUI.referrals.table.columns.joined")}</TableHead>
                <TableHead>{t("toolsUI.referrals.table.columns.status")}</TableHead>
                <TableHead>{t("toolsUI.referrals.table.columns.monthSpend")}</TableHead>
                <TableHead>{t("toolsUI.referrals.table.columns.lifetimeSpend")}</TableHead>
                <TableHead className="pr-6">{t("toolsUI.referrals.table.columns.yourCommission")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && clients.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2 text-xs">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("y.refp.loading")}
                    </span>
                  </TableCell>
                </TableRow>
              ) : visibleClients.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    {t("y.refp.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                visibleClients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6 text-left font-medium">{c.name}</TableCell>
                    <TableCell className="text-left text-muted-foreground">{c.vertical}</TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">
                      {formatRelativeTime(c.joinedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === "active" ? "success" : "outline"}
                        className="capitalize"
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(c.monthSpend)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(c.lifetimeSpend)}</TableCell>
                    <TableCell
                      className={cn(
                        "pr-6 font-medium tabular-nums",
                        "text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]",
                      )}
                    >
                      {formatCurrency(c.commission)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {clients.length > pageSize && (
          <div className="border-t border-border px-6 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={clients.length}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </div>
        )}
      </Card>

      {/* Spending tracker — fetches its own time series based on range. */}
      <ReferralSpendChart />

      <InviteReferralDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent/12 text-accent">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-3 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </Card>
  );
}

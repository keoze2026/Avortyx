"use client";

/**
 * Automated Reports (CH-261, Sir 25 Oct): every report the platform sends by
 * itself, in one place, after Reports in the menu.
 *
 *   Automated Report
 *   Automate your reporting with Avortyx. Get timely reports delivered
 *   straight to you, automatically.  (Sir's own line, 25 Oct)
 *
 * Feature cards, then the live list of buyers and their Telegram report
 * status (Active / Waiting for approval / Off / Not set up), each with a link
 * to its setup under Buyer > Settings. Workspace admins only; the backend
 * (/api/buyers/telegram-reports) refuses everyone else.
 */

import Link from "next/link";
import * as React from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  Mail,
  SlidersHorizontal,
} from "lucide-react";

import { TeamReportCard } from "@/components/automated-reports/team-report-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import { ROUTES } from "@/lib/constants";
import { formatLocalDateTime, uiLocaleTag } from "@/lib/format";
import { reportResultText } from "@/lib/i18n/server-text";

type State = "active" | "waiting_approval" | "off" | "not_set_up";

interface Item {
  buyerId: string;
  buyerName: string;
  state: State;
  sendTime: string | null;
  lastSentAt: string | null;
  lastResult: string;
}

interface Payload {
  items: Item[];
  counts: Record<State, number>;
}

const FEATURES = [
  { icon: FileSpreadsheet, key: "autoReports.feature.excel" },
  { icon: SlidersHorizontal, key: "autoReports.feature.options" },
  { icon: CheckCircle2, key: "autoReports.feature.approval" },
  { icon: CalendarClock, key: "autoReports.feature.eod" },
  { icon: Mail, key: "autoReports.feature.email", href: `${ROUTES.settings}?section=scheduled-reports` },
] as const;

const STATE_VARIANT: Record<State, React.ComponentProps<typeof Badge>["variant"]> = {
  active: "success",
  waiting_approval: "warning",
  off: "secondary",
  not_set_up: "outline",
};

/** "9:00 AM EST" / "9:00 EST" / "午前9:00 EST", in the chosen language (CH-302). */
function time12(hhmm: string | null): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const at = new Date(Date.UTC(2000, 0, 1, h, Number.isFinite(m) ? m : 0));
  return `${at.toLocaleTimeString(uiLocaleTag(), { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} EST`;
}

export default function AutomatedReportsPage() {
  const { t, locale } = useTranslation();
  const [data, setData] = React.useState<Payload | null>(null);
  const [denied, setDenied] = React.useState(false);

  React.useEffect(() => {
    http
      .get<Payload>("/api/buyers/telegram-reports")
      .then(setData)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) setDenied(true);
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* The same header as Reports and the other pages (Sir, 25 Oct): title
          and one line, no icon. */}
      <PageHeader title={t("autoReports.headline")} description={t("autoReports.subline")} className="pb-0" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const body = (
            <Card className="h-full transition-colors hover:border-accent/40">
              <CardContent className="flex h-full flex-col gap-2 p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium leading-snug">{t(f.key)}</span>
              </CardContent>
            </Card>
          );
          return "href" in f ? (
            <Link key={f.key} href={f.href} className="block">
              {body}
            </Link>
          ) : (
            <div key={f.key}>{body}</div>
          );
        })}
      </div>

      {/* The team report from our own reports bot (CH-347). */}
      <TeamReportCard />

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <span className="text-base font-semibold">{t("autoReports.buyers.title")}</span>
            {data && (
              <span className="text-xs text-muted-foreground">
                {t("autoReports.buyers.counts")
                  .replace("{active}", String(data.counts.active))
                  .replace("{waiting}", String(data.counts.waiting_approval))}
              </span>
            )}
          </div>
          {denied ? (
            <p className="border-t border-border px-5 py-6 text-sm text-muted-foreground">
              {t("autoReports.buyers.adminOnly")}
            </p>
          ) : !data ? (
            <div className="space-y-2 border-t border-border p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("autoReports.col.buyer")}</TableHead>
                    <TableHead className="text-center">{t("autoReports.col.status")}</TableHead>
                    <TableHead className="text-center">{t("autoReports.col.time")}</TableHead>
                    <TableHead className="text-center">{t("autoReports.col.lastSent")}</TableHead>
                    <TableHead className="text-right">{t("autoReports.col.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((i) => (
                    <TableRow key={i.buyerId}>
                      <TableCell className="font-medium">{i.buyerName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={STATE_VARIANT[i.state]}>{t(`autoReports.state.${i.state}`)}</Badge>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {i.state === "not_set_up" ? "—" : time12(i.sendTime)}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground" title={reportResultText(t, locale, i.lastResult)}>
                        {i.lastSentAt ? formatLocalDateTime(i.lastSentAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`${ROUTES.buyers}/${i.buyerId}?tab=settings`}
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          {i.state === "not_set_up" ? t("autoReports.setUp") : t("autoReports.manage")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        {t("autoReports.buyers.none")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

/**
 * Publishers (CH-423, Sir's design): who sends calls, and how many pay.
 *
 * All the figures come from the server in payable calls - the calls Reports
 * counts as Paid - for today (Eastern), this month and all time, with the last
 * 60 minutes as Hourly. Nothing is estimated in the browser: before the
 * server sends the counts the cards and cells show "—".
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  Columns3,
  PhoneIncoming,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { InvitePublisherDialog } from "@/components/publishers/invite-publisher-dialog";
import { PublishersTable } from "@/components/publishers/publishers-table";
import {
  ALL_PUBLISHER_COLUMNS,
  PUBLISHER_COLUMNS,
  type PublisherColumnKey,
} from "@/components/publishers/publishers-table-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { useLocalName } from "@/lib/i18n/local-name";
import { formatCurrency, formatNumber } from "@/lib/format";
import { usePublishersStore } from "@/lib/store/publishers-store";
import { usePermissions } from "@/lib/my-permissions";
import type { Publisher } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "all" | "active" | "paused" | "idle";
type Sort = "default" | "hourly" | "monthly" | "name";

const TABS: Array<{ id: Tab; key: string }> = [
  { id: "all", key: "x423.tabAll" },
  { id: "active", key: "x423.tabActive" },
  { id: "paused", key: "x423.tabPaused" },
  { id: "idle", key: "x423.tabIdle" },
];

const SORTS: Array<{ id: Sort; key: string }> = [
  { id: "default", key: "x423.sortDefault" },
  { id: "hourly", key: "x423.sortHourly" },
  { id: "monthly", key: "x423.sortMonthly" },
  { id: "name", key: "x423.sortName" },
];

const daily = (p: Publisher) => p.usage?.payableToday ?? -1;

function inTab(p: Publisher, tab: Tab) {
  if (tab === "active") return p.status === "active";
  if (tab === "paused") return p.status !== "active";
  // "No calls today": only when the server said so - unknown is not zero.
  if (tab === "idle") return p.usage !== undefined && p.usage.sentToday === 0;
  return true;
}

export default function PublishersPage() {
  const { t } = useTranslation();
  const localName = useLocalName();
  const { can } = usePermissions();
  const publishers = usePublishersStore((s) => s.publishers);
  const summary = usePublishersStore((s) => s.summary);
  const loading = usePublishersStore((s) => s.loading);
  const fetchPublishers = usePublishersStore((s) => s.fetch);
  const setPublisherStatus = usePublishersStore((s) => s.setStatus);
  const remove = usePublishersStore((s) => s.remove);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("default");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [columns, setColumns] = useState<Record<PublisherColumnKey, boolean>>(ALL_PUBLISHER_COLUMNS);

  // Fresh counts every time the page opens (the store may hold older ones).
  useEffect(() => {
    void fetchPublishers();
  }, [fetchPublishers]);

  useEffect(() => {
    setPage(0);
  }, [query, tab, sort, pageSize]);

  const hasUsage = publishers.some((p) => p.usage);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, active: 0, paused: 0, idle: 0 };
    for (const p of publishers) for (const { id } of TABS) if (inTab(p, id)) c[id] += 1;
    return c;
  }, [publishers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = publishers.filter((p) => {
      if (!inTab(p, tab)) return false;
      if (!q) return true;
      const campaigns = (p.usage?.campaigns ?? []).map((c) => c.name).join(" ");
      return `${p.name} ${localName(p.name)} ${p.organization} ${p.contactName ?? ""} ${p.email ?? ""} ${campaigns}`
        .toLowerCase()
        .includes(q);
    });
    const byName = (a: Publisher, b: Publisher) => localName(a.name).localeCompare(localName(b.name));
    return [...list].sort((a, b) => {
      if (sort === "name") return byName(a, b);
      if (sort === "hourly") return (b.usage?.callsHour ?? -1) - (a.usage?.callsHour ?? -1) || byName(a, b);
      if (sort === "monthly") return (b.usage?.payableMonth ?? -1) - (a.usage?.payableMonth ?? -1) || byName(a, b);
      // Sir's order: active first, then the most payable calls today.
      const active = Number(b.status === "active") - Number(a.status === "active");
      return active || daily(b) - daily(a) || byName(a, b);
    });
  }, [publishers, query, tab, sort, localName]);

  const start = page * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const maxDaily = useMemo(() => Math.max(0, ...publishers.map((p) => p.usage?.payableToday ?? 0)), [publishers]);

  const sentToday = publishers.filter((p) => (p.usage?.sentToday ?? 0) > 0).length;
  const active = publishers.filter((p) => p.status === "active").length;

  const onToggle = async (id: string) => {
    const p = publishers.find((x) => x.id === id);
    if (!p) return;
    const next = p.status === "active" ? "paused" : "active";
    try {
      await setPublisherStatus(id, next);
      toast.success(
        (next === "active"
          ? t("networkUI.publishers.toast.activated")
          : t("networkUI.publishers.toast.paused")
        ).replace("{name}", localName(p.name)),
      );
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    }
  };

  const onArchive = async (id: string) => {
    const p = publishers.find((x) => x.id === id);
    if (!p) return;
    try {
      await remove(id);
      toast.success(t("networkUI.publishers.toast.removed").replace("{name}", localName(p.name)));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    }
  };

  const refresh = async () => {
    await fetchPublishers();
    const err = usePublishersStore.getState().error;
    if (err) toast.error(err);
    else toast.success(t("networkUI.publishers.toast.refreshed"));
  };

  return (
    <>
      <PageHeader
        title={t("networkUI.publishers.page.title")}
        description={t("networkUI.publishers.page.description")}
        actions={
          can("traffic-sources", "edit") ? (
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setInviteOpen(true)}>
              {t("x423.invite")}
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("x423.kpiTotal")}
          icon={Users}
          value={formatNumber(publishers.length)}
          foot={hasUsage ? t("x423.sentToday").replace("{n}", formatNumber(sentToday)) : "—"}
        />
        <KpiCard
          label={t("x423.kpiActive")}
          icon={UserCheck}
          value={formatNumber(active)}
          foot={<SegmentBar value={active} total={publishers.length} />}
        />
        <KpiCard
          label={t("x423.kpiPayable")}
          icon={PhoneIncoming}
          value={summary ? formatNumber(summary.payableToday) : "—"}
          foot={summary ? <HourBars hours={summary.payableByHour} /> : t("x423.sinceMidnight")}
        />
        <KpiCard
          label={t("x423.kpiPending")}
          icon={Wallet}
          value={summary ? formatCurrency(summary.pendingPayoutAmount) : "—"}
          foot={
            !summary
              ? "—"
              : summary.pendingPayouts === 0
                ? t("x423.allSettled")
                : (summary.pendingPayouts === 1 ? t("x423.onePayout") : t("x423.nPayouts")).replace(
                    "{n}",
                    formatNumber(summary.pendingPayouts),
                  )
          }
          tone={summary && summary.pendingPayouts > 0 ? "warn" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5" role="tablist">
          {TABS.map(({ id, key }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === id ? "bg-accent/15 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(key)}
              <span className="tabular-nums text-muted-foreground">
                {id === "idle" && !hasUsage ? "—" : formatNumber(counts[id])}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("x423.find")}
              aria-label={t("x423.find")}
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t("x423.sort")} title={t("x423.sort")}>
                <ArrowUpDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("x423.sort")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
                {SORTS.map((s) => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    {t(s.key)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label={t("x423.refresh")}
            title={t("x423.refresh")}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t("x423.columns")} title={t("x423.columns")}>
                <Columns3 className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("x423.columns")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PUBLISHER_COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={columns[c.id]}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(v) => setColumns((s) => ({ ...s, [c.id]: Boolean(v) }))}
                >
                  {t(c.labelKey)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          tone="violet"
          title={t("networkUI.publishers.empty.title")}
          description={t("networkUI.publishers.empty.description")}
        />
      ) : (
        <>
          <PublishersTable
            publishers={visible}
            columns={columns}
            maxDaily={maxDaily}
            onToggle={(id) => void onToggle(id)}
            onArchive={(id) => void onArchive(id)}
          />
          <p className="-mt-2 text-[11px] text-muted-foreground">{t("x423.legend")}</p>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </>
      )}

      <InvitePublisherDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function KpiCard({
  label,
  icon: Icon,
  value,
  foot,
  tone,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  foot: ReactNode;
  tone?: "warn";
}) {
  const warn = tone === "warn";
  return (
    <div className={cn("rounded-2xl border bg-card p-5", warn ? "border-[color:var(--warning)]/40" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            warn ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]" : "bg-accent/10 text-accent",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className={cn("-mt-1 text-3xl font-semibold tabular-nums tracking-tight", warn && "text-[color:var(--warning)]")}>
        {value}
      </div>
      <div className="mt-3 flex h-5 min-w-0 items-center text-xs text-muted-foreground">{foot}</div>
    </div>
  );
}

function SegmentBar({ value, total }: { value: number; total: number }) {
  const n = 20;
  const on = total > 0 ? Math.round((value / total) * n) : 0;
  return (
    <span className="flex w-full gap-1" role="img" aria-label={`${value} / ${total}`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={cn("h-1 flex-1 rounded-full", i < on ? "bg-accent" : "bg-muted/60")} />
      ))}
    </span>
  );
}

/** Payable calls per Eastern hour today, midnight to now, as 24 small bars. */
function HourBars({ hours }: { hours: number[] }) {
  const max = Math.max(0, ...hours);
  return (
    <span className="flex h-5 w-full items-end gap-[3px]" role="img" aria-label={hours.join(", ")}>
      {Array.from({ length: 24 }, (_, h) => {
        const v = hours[h] ?? 0;
        return (
          <span
            key={h}
            title={`${String(h).padStart(2, "0")}:00 · ${v}`}
            className={cn("flex-1 rounded-sm", v > 0 ? "bg-accent" : "bg-muted/60")}
            style={{ height: `${max > 0 && v > 0 ? Math.max(15, (v / max) * 100) : 15}%` }}
          />
        );
      })}
    </span>
  );
}

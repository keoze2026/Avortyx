"use client";

/**
 * Routing - the simple way: for each campaign, the TFN(s) its calls ring and
 * an on/off switch. Add a TFN, switch the campaign on, calls start.
 *
 * The rule-based editor (time / location / caller / tag conditions) moved to
 * Settings -> Advanced Routing. Both edit the same backend routing rules.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Megaphone, PhoneForwarded, Radio, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";

import { SimpleRoutingRow } from "@/components/routing/simple-routing-row";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ADVANCED_ROUTING_HREF,
  campaignRouting,
  type RoutedDestination,
  type RuleSummary,
} from "@/lib/api/services/campaign-routing";
import { ROUTES } from "@/lib/constants";
import { formatNumber, toE164 } from "@/lib/format";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { cn } from "@/lib/utils";

type Filter = "all" | "live" | "off" | "setup";
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "off", label: "Off" },
  { id: "setup", label: "Needs a TFN" },
];

/** Run `fn` over `items`, at most `limit` at a time (keeps the API calm). */
async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export default function RoutingPage() {
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const campaignsReady = useCampaignsStore((s) => s.hydrated);
  const numbers = useNumbersStore((s) => s.numbers);
  const buyers = useBuyersStore((s) => s.buyers);
  const destinations = useDestinationsStore((s) => s.destinations);

  const [rules, setRules] = useState<RuleSummary[] | null>(null);
  const [routed, setRouted] = useState<Record<string, RoutedDestination[]>>({});
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const all = await campaignRouting.listAllRules();
      const byCampaign = new Map<string, RuleSummary[]>();
      for (const r of all) {
        if (!r.campaignId) continue;
        byCampaign.set(r.campaignId, [...(byCampaign.get(r.campaignId) ?? []), r]);
      }
      const simples = [...byCampaign.values()]
        .map((list) => campaignRouting.pickSimple(list))
        .filter((r): r is RuleSummary => !!r);
      const lists: Record<string, RoutedDestination[]> = {};
      await eachLimited(simples, 4, async (r) => {
        lists[r.id] = r.destinationCount > 0 ? await campaignRouting.listDestinations(r.id) : [];
      });
      setRouted(lists);
      setRules(all);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Per campaign: its Simple setup rule, how many advanced rules, its TFNs. */
  const rows = useMemo(() => {
    const byCampaign = new Map<string, RuleSummary[]>();
    for (const r of rules ?? []) {
      if (r.campaignId) byCampaign.set(r.campaignId, [...(byCampaign.get(r.campaignId) ?? []), r]);
    }
    return campaigns
      .filter((c) => c.status !== "archived")
      .map((c) => {
        const list = byCampaign.get(c.id) ?? [];
        const simple = campaignRouting.pickSimple(list);
        return {
          campaign: c,
          rule: simple,
          campaignRules: list,
          advancedCount: list.filter((r) => r.id !== simple?.id).length,
          routed: simple ? routed[simple.id] ?? [] : [],
          trackingNumbers: numbers.filter((n) => n.campaignId === c.id),
        };
      })
      .sort(
        (a, b) =>
          Number(b.campaign.status === "active") - Number(a.campaign.status === "active") ||
          a.campaign.name.localeCompare(b.campaign.name),
      );
  }, [campaigns, rules, routed, numbers]);

  const needsTfn = (r: (typeof rows)[number]) => r.routed.length === 0 && r.advancedCount === 0;

  const stats = useMemo(() => {
    const live = rows.filter((r) => r.campaign.status === "active" && !needsTfn(r)).length;
    const tfns = new Set(rows.flatMap((r) => r.routed.map((d) => toE164(d.number)))).size;
    const setup = rows.filter(needsTfn).length;
    return { live, tfns, setup };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (filter === "live" && r.campaign.status !== "active") return false;
      if (filter === "off" && r.campaign.status === "active") return false;
      if (filter === "setup" && !needsTfn(r)) return false;
      if (!q) return true;
      if (r.campaign.name.toLowerCase().includes(q)) return true;
      if (!qDigits) return false;
      return (
        r.routed.some((d) => d.number.replace(/\D/g, "").includes(qDigits)) ||
        r.trackingNumbers.some((n) => n.number.replace(/\D/g, "").includes(qDigits))
      );
    });
  }, [rows, query, filter]);

  const setRule = (rule: RuleSummary) =>
    setRules((prev) => {
      const list = prev ?? [];
      return list.some((r) => r.id === rule.id) ? list.map((r) => (r.id === rule.id ? rule : r)) : [...list, rule];
    });

  const loading = rules === null || !campaignsReady;

  return (
    <>
      <PageHeader
        title="Routing"
        description="Choose the TFN each campaign's calls ring. Add the number, switch the campaign on, and calls start."
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={ADVANCED_ROUTING_HREF}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> Advanced routing
            </Link>
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={Radio}
          value={loading ? "—" : formatNumber(stats.live)}
          label="Campaigns live"
          accentClass="bg-[color:var(--success)]/10 text-[color:var(--success)]"
        />
        <StatTile icon={PhoneForwarded} value={loading ? "—" : formatNumber(stats.tfns)} label="TFNs taking calls" />
        <StatTile
          icon={AlertTriangle}
          value={loading ? "—" : formatNumber(stats.setup)}
          label="Campaigns without a TFN"
          accentClass={
            stats.setup > 0 && !loading
              ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
              : "bg-secondary/60 text-muted-foreground"
          }
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaign or number"
            className="h-9 w-full pl-8 text-xs sm:w-72"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex w-fit gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-7 rounded px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                f.id === filter ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:ml-auto">
          {formatNumber(filtered.length)} of {formatNumber(rows.length)} campaigns
        </span>
      </div>

      {failed ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load where calls go.</p>
          <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          tone="amber"
          title="No campaigns yet"
          description="Create a campaign and attach a tracking number, then come back here to choose where its calls ring."
          actions={
            <Button asChild size="sm">
              <Link href={ROUTES.campaigns}>Go to Campaigns</Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <Card className="px-6 py-10 text-center text-xs text-muted-foreground">No campaign matches.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <SimpleRoutingRow
              key={r.campaign.id}
              campaign={r.campaign}
              rule={r.rule}
              campaignRules={r.campaignRules}
              advancedCount={r.advancedCount}
              routed={r.routed}
              trackingNumbers={r.trackingNumbers}
              buyers={buyers}
              destinations={destinations ?? []}
              open={openId === r.campaign.id}
              onToggleOpen={() => setOpenId((id) => (id === r.campaign.id ? null : r.campaign.id))}
              onRuleChange={setRule}
              onRoutedChange={(ruleId, list) => setRouted((prev) => ({ ...prev, [ruleId]: list }))}
              onReload={() => void load()}
            />
          ))}
        </div>
      )}
    </>
  );
}

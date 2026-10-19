"use client";

/**
 * Settings -> Advanced Routing: the full routing-plan editor that used to be
 * the Routing page (plans with time, location, caller and tag conditions).
 * The Routing page in the menu is now the simple per-campaign setup; both
 * edit the same backend routing rules. Opening a plan still goes to
 * /routing/{id}, and its "All plans" button comes back here.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitFork, Plus, Search, X } from "lucide-react";

import { NewPlanDialog } from "@/components/routing/new-plan-dialog";
import { RoutingPlanCard } from "@/components/routing/routing-plan-card";
import { TopologyOverview } from "@/components/routing/topology-overview";
import { SectionShell } from "@/components/settings/profile-section";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { useRoutingStore } from "@/lib/store/routing-store";
import type { RoutingPlanStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Can } from "@/components/shared/can";

type StatusFilter = "all" | RoutingPlanStatus;

const STATUS_KEYS: Array<{ id: StatusFilter; labelKey: string }> = [
  { id: "all", labelKey: "trafficUI.routing.statusFilter.all" },
  { id: "published", labelKey: "trafficUI.routing.statusFilter.live" },
  { id: "draft", labelKey: "trafficUI.routing.statusFilter.draft" },
  { id: "archived", labelKey: "trafficUI.routing.statusFilter.archived" },
];

export function AdvancedRoutingSection() {
  const { t } = useTranslation();
  const plans = useRoutingStore((s) => s.plans);
  const fetchPlans = useRoutingStore((s) => s.fetch);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const STATUS_OPTIONS = STATUS_KEYS.map((o) => ({ id: o.id, label: t(o.labelKey) }));

  // Refresh on open: the Routing page may have added or changed a campaign's setup.
  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (q && !`${p.name} ${p.description ?? ""} ${p.campaignName ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [plans, query, status]);

  const filtersOn = query || status !== "all";

  return (
    <SectionShell
      eyebrow={t("settings.rail.advancedRouting.eyebrow")}
      title={t("settings.rail.advancedRouting.label")}
      description={t("settings.rail.advancedRouting.intro")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Can area="call-flows" action="edit"><Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("trafficUI.routing.newPlan")}
        </Button></Can>
        <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
          <Link href={ROUTES.routing}>{t("settings.rail.advancedRouting.simpleLink")}</Link>
        </Button>
      </div>

      <TopologyOverview plans={plans} />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("trafficUI.routing.searchPlaceholder")}
              className="h-9 w-64 pl-8 font-mono text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("trafficUI.routing.clearSearch")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status pills */}
          <div className="flex gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5">
            {STATUS_OPTIONS.map((s) => {
              const active = s.id === status;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id)}
                  className={cn(
                    "h-7 rounded px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {filtersOn && (
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[10px] uppercase tracking-wider"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              {t("trafficUI.routing.clear")}
            </Button>
          )}

          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:ml-2">
            {t("trafficUI.routing.countOfTotal").replace("{count}", formatNumber(filtered.length)).replace("{total}", formatNumber(plans.length))}
          </span>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={GitFork}
          tone="amber"
          title={plans.length === 0 ? t("trafficUI.routing.empty.title") : t("trafficUI.routing.emptyMatch.title")}
          description={
            plans.length === 0
              ? t("trafficUI.routing.empty.description")
              : t("trafficUI.routing.emptyMatch.description")
          }
          actions={
            plans.length === 0 ? (
              <Can area="call-flows" action="edit"><Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> {t("trafficUI.routing.newPlan")}
              </Button></Can>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((p) => (
            <RoutingPlanCard key={p.id} plan={p} />
          ))}
        </div>
      )}

      <NewPlanDialog open={open} onOpenChange={setOpen} />
    </SectionShell>
  );
}

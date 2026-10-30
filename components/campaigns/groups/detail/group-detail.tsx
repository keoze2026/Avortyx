"use client";

/**
 * CH-415 (Sir, 30 Oct: "Fix campaign group to match this design. Ensure it
 * fetches real data, do not display mock data"): one group's page - its
 * destinations across every campaign in it, with priority, weight, limits
 * and on / off, edited once here for every campaign.
 *
 * Every figure is the server's: priorities and weights per campaign from the
 * group's destination list, limits and on / off from the Destination records
 * (the same ones the Destinations page shows and routing reads).
 */

import type * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers, Pause, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  campaignGroups,
  type CampaignGroup,
  type GroupHistoryItem,
  type GroupLine,
} from "@/lib/api/services/campaign-groups.service";
import { ROUTES } from "@/lib/constants";
import { formatLocalDateTime } from "@/lib/format";
import { useLocalName, LocalName } from "@/lib/i18n/local-name";
import { usePermissions } from "@/lib/my-permissions";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { cn } from "@/lib/utils";
import { GroupEditorDialog } from "../group-editor-dialog";
import { fill, StatusDot } from "../shared";
import { AddDestinationDrawer } from "./add-drawer";
import { AddToCampaignsDialog, BulkEditDrawer } from "./bulk-drawer";
import { LineDrawer } from "./line-drawer";
import { buildRows, filterRows, sortRows, type GroupRow, type RowFilter } from "./model";
import { RemoveDialog } from "./remove-dialog";
import { CampaignsBar, LineLabel, PriorityCell } from "./ui";

type Tab = "destinations" | "campaigns" | "history";

export function GroupDetail({
  groupId,
  switcher,
  extraActions,
  onChanged,
}: {
  groupId: string;
  /** CH-421: on the Campaign Groups page itself, a group picker in place of
   *  the breadcrumb (the page is the group list). */
  switcher?: React.ReactNode;
  /** CH-421: the list page's own buttons (New Group, Delete...). */
  extraActions?: React.ReactNode;
  /** Called after anything here changes the group (name, campaigns). */
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const { isPartner } = usePartnerPermissions();
  const canEdit = usePermissions().can("campaigns", "edit-campaign");

  const destinations = useDestinationsStore((s) => s.destinations);
  const fetchDestinations = useDestinationsStore((s) => s.fetch);
  const setEnabled = useDestinationsStore((s) => s.setEnabled);
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignsStore((s) => s.fetch);

  const [group, setGroup] = useState<CampaignGroup | null | undefined>(undefined);
  const [allGroups, setAllGroups] = useState<CampaignGroup[]>([]);
  const [lines, setLines] = useState<GroupLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("destinations");

  const [search, setSearch] = useState("");
  const [buyer, setBuyer] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [kind, setKind] = useState<RowFilter>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [removing, setRemoving] = useState<GroupRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState<null | "routing" | "limits">(null);
  const [addTo, setAddTo] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await campaignGroups.list();
      setAllGroups(list);
      const g = list.find((x) => x.id === groupId) ?? null;
      setGroup(g);
      setLines(g && g.campaigns.length ? await campaignGroups.destinations(g.id) : []);
    } catch (e) {
      setError(friendlyErrorMessage(e));
    }
  }, [groupId]);

  const reload = useCallback(async () => {
    await Promise.all([load(), fetchDestinations()]);
  }, [load, fetchDestinations]);

  // CH-421: another group picked - never show the last group's rows under it.
  useEffect(() => {
    setGroup(undefined);
    setLines(null);
    setPicked(new Set());
    setSearch("");
    setBuyer("all");
    setCampaign("all");
    setKind("all");
  }, [groupId]);

  useEffect(() => {
    if (isPartner) return;
    void load();
    void fetchDestinations();
    void fetchCampaigns();
  }, [isPartner, load, fetchDestinations, fetchCampaigns]);

  const rows = useMemo(() => sortRows(buildRows(lines ?? [], destinations)), [lines, destinations]);
  const shown = useMemo(() => filterRows(rows, { search, buyer, campaign, kind }), [rows, search, buyer, campaign, kind]);
  const pickedRows = useMemo(() => rows.filter((r) => picked.has(r.number)), [rows, picked]);

  // Drop picks that left the list (removed, filtered out by a reload).
  useEffect(() => {
    setPicked((p) => {
      const keep = new Set([...p].filter((n) => rows.some((r) => r.number === n)));
      return keep.size === p.size ? p : keep;
    });
  }, [rows]);

  if (isPartner) return <EmptyState icon={Layers} title={t("cg.title")} description={t("cg.notAllowed")} />;
  if (error)
    return (
      <EmptyState
        icon={Layers}
        title={t("cg.loadFailed")}
        description={error}
        actions={<Button size="sm" variant="outline" onClick={() => void load()}>{t("cg.retry")}</Button>}
      />
    );
  if (group === undefined) return <p className="text-sm text-muted-foreground">{t("cg.loading")}</p>;
  if (group === null)
    return (
      <EmptyState
        icon={Layers}
        title={t("x415.notFound")}
        description={t("x415.notFoundDesc")}
        actions={<Link href={`${ROUTES.campaigns}/groups`}><Button size="sm" variant="outline">{t("cg.title")}</Button></Link>}
      />
    );

  const active = group.campaigns.filter((c) => c.status === "active").length;
  const paused = group.campaigns.filter((c) => c.status === "paused").length;
  const buyers = [...new Set(rows.map((r) => r.buyerName).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  const mixedCount = rows.filter((r) => r.mixed).length;
  const checkCount = rows.filter((r) => r.check).length;
  const notAllCount = rows.filter((r) => r.inCount < r.ofCount).length;
  const limitsCount = rows.filter((r) => r.hasLimits).length;
  const allShownPicked = shown.length > 0 && shown.every((r) => picked.has(r.number));

  const toggle = async (r: GroupRow, on: boolean) => {
    if (!r.dest) return;
    try {
      await setEnabled(r.dest.id, on);
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    }
  };

  const pauseMany = async (list: GroupRow[]) => {
    const targets = list.filter((r) => r.dest && r.enabled);
    let failed = 0;
    for (const r of targets) {
      try {
        await setEnabled(r.dest!.id, false);
      } catch {
        failed += 1;
      }
    }
    if (failed) toast.error(fill(t("x415.pauseFailed"), { n: failed }));
    else toast.success(fill(t("x415.pausedN"), { n: targets.length }));
  };

  const stats = [
    { label: t("x415.kpiDestinations"), value: rows.length, sub: fill(t("x415.nBuyers"), { n: buyers.length }), tone: "" },
    {
      label: t("x415.kpiCampaigns"),
      value: group.campaigns.length,
      sub: fill(t("x415.activePaused"), { a: active, p: paused }),
      tone: "",
    },
    { label: t("x415.kpiMixed"), value: mixedCount, sub: t("x415.kpiMixedSub"), tone: mixedCount ? "text-amber-400" : "" },
    { label: t("x415.kpiCheck"), value: checkCount, sub: t("x415.kpiCheckSub"), tone: checkCount ? "text-red-400" : "" },
  ];

  const live = active > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-3">
        {switcher ?? (
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href={`${ROUTES.campaigns}/groups`} className="text-accent hover:underline">{t("cg.title")}</Link>
            <span>/</span>
            <span><LocalName name={group.name} /></span>
          </nav>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-2xl font-semibold tracking-tight"><LocalName name={group.name} /></h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  live ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-emerald-400" : "bg-amber-400")} />
                {live ? t("x415.live") : t("cg.status.paused")}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{group.description || t("x415.subtitle")}</p>
          </div>
          {(canEdit || extraActions) && (
            <div className="flex flex-wrap items-center gap-2">
              {extraActions}
              {canEdit && (
              <>
              <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> {t("x415.editGroup")}
              </Button>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setAdding(true)} disabled={!group.campaigns.length}>
                <Plus className="h-4 w-4" /> {t("x408.addDestination")}
              </Button>
              </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Figures */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
            <div className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", s.tone)}>{lines ? s.value : "—"}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* How a call picks a destination */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("x415.howTitle")}</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {[
            [t("x415.howPriority"), t("x415.howPriorityText")],
            [t("x415.howWeight"), t("x415.howWeightText")],
            [t("x415.howLimits"), t("x415.howLimitsText")],
          ].map(([title, text], i) => (
            <div key={title} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
                {i + 1}
              </span>
              <div>
                <div className="text-xs font-semibold">{title}</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["destinations", t("x415.tabDestinations"), rows.length],
            ["campaigns", t("x415.tabCampaigns"), group.campaigns.length],
            ["history", t("x415.tabHistory"), null],
          ] as [Tab, string, number | null][]
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              tab === id ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label} {n !== null && <span className="text-muted-foreground">{n}</span>}
          </button>
        ))}
      </div>

      {tab === "destinations" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("x415.search")} className="h-8 pl-8 text-xs" />
            </div>
            <Select value={buyer} onValueChange={setBuyer}>
              <SelectTrigger size="sm" className="h-8 w-auto gap-1 text-xs">
                <span className="text-muted-foreground">{t("x415.buyer")}</span> <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">{t("x415.all")}</SelectItem>
                {buyers.map((b) => (
                  <SelectItem key={b} value={b}>{localName(b)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger size="sm" className="h-8 w-auto gap-1 text-xs">
                <span className="text-muted-foreground">{t("x415.campaign")}</span> <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">{fill(t("x415.allN"), { n: group.campaigns.length })}</SelectItem>
                {group.campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{localName(c.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex overflow-hidden rounded-md border border-border text-[11px]">
              {(
                [
                  ["all", t("x415.all"), null],
                  ["mixed", t("x415.fMixed"), mixedCount],
                  ["notAll", t("x415.fNotAll"), notAllCount],
                  ["limits", t("x415.fLimits"), limitsCount],
                ] as [RowFilter, string, number | null][]
              ).map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  className={cn(
                    "px-3 py-1.5 transition-colors",
                    kind === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label} {n !== null && <span className="tabular-nums">{n}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk bar */}
          {canEdit && pickedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
              <span className="text-xs font-medium">
                {pickedRows.length === 1 ? t("x415.oneSelected") : fill(t("x415.nSelected"), { n: pickedRows.length })}
              </span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulk("routing")}>{t("x415.setRouting")}</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulk("limits")}>{t("x415.setLimits")}</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddTo(true)}>{t("x415.addToCampaigns")}</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void pauseMany(pickedRows)}>
                  <Pause className="h-3 w-3" /> {t("x415.pause")}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={() => setRemoving(pickedRows)}>
                  {t("x415.remove")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPicked(new Set())}>{t("x415.clear")}</Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  {canEdit && (
                    <th className="w-10 py-2.5 pl-4">
                      <Checkbox
                        checked={allShownPicked}
                        onCheckedChange={(v) =>
                          setPicked((p) => {
                            const next = new Set(p);
                            shown.forEach((r) => (v ? next.add(r.number) : next.delete(r.number)));
                            return next;
                          })
                        }
                        aria-label={t("x415.selectAll")}
                      />
                    </th>
                  )}
                  <th className="px-3 py-2.5 font-medium">{t("cg.col.destination")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("cg.col.priority")}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{t("cg.col.weight")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("x415.maxLive")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("x415.dailyCap")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("x415.tabCampaigns")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("x415.status")}</th>
                  <th className="w-20 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {lines === null ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-xs text-muted-foreground">{t("cg.loading")}</td></tr>
                ) : group.campaigns.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-xs text-muted-foreground">{t("cg.noCampaigns")}</td></tr>
                ) : shown.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-xs text-muted-foreground">{rows.length ? t("x415.noMatch") : t("cg.noLines")}</td></tr>
                ) : (
                  shown.map((r) => {
                    const sel = picked.has(r.number);
                    const weight = r.weights.length === 1 ? String(r.weights[0]) : `${r.weights[0]}–${r.weights[r.weights.length - 1]}`;
                    return (
                      <tr key={r.number} className={cn("border-b border-border last:border-b-0", sel && "bg-accent/5")}>
                        {canEdit && (
                          <td className="py-2.5 pl-4">
                            <Checkbox
                              checked={sel}
                              onCheckedChange={(v) =>
                                setPicked((p) => {
                                  const next = new Set(p);
                                  if (v) next.add(r.number);
                                  else next.delete(r.number);
                                  return next;
                                })
                              }
                              aria-label={r.number}
                            />
                          </td>
                        )}
                        <td className="px-3 py-2.5"><LineLabel buyer={r.buyerName} number={r.number} /></td>
                        <td className="px-3 py-2.5"><PriorityCell row={r} /></td>
                        <td className="px-3 py-2.5 text-right font-mono text-[13px] tabular-nums">{weight}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {!r.dest ? (
                            <span className="text-muted-foreground">—</span>
                          ) : r.dest.concurrencyCap > 0 ? (
                            <span className="font-medium">{fill(t("x415.nCalls"), { n: r.dest.concurrencyCap })}</span>
                          ) : (
                            <span className="text-muted-foreground">{t("x415.noLimit")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {!r.dest ? (
                            <span className="text-muted-foreground">—</span>
                          ) : r.dest.dailyCap > 0 ? (
                            <span className="font-medium">{fill(t("x415.perDay"), { n: r.dest.dailyCap })}</span>
                          ) : (
                            <span className="text-muted-foreground">{t("x415.noCap")}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5"><CampaignsBar inCount={r.inCount} ofCount={r.ofCount} /></td>
                        <td className="px-3 py-2.5">
                          {r.dest ? (
                            <Switch
                              checked={r.enabled === true}
                              disabled={!canEdit}
                              onCheckedChange={(v) => void toggle(r, v)}
                              className="data-[state=checked]:bg-emerald-500"
                              aria-label={t("x415.status")}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground" title={t("x415.noRecord")}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {canEdit && (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(r)} aria-label={t("cg.edit")}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRemoving([r])} aria-label={t("x415.remove")}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "campaigns" && <CampaignsTab group={group} lines={lines ?? []} />}
      {tab === "history" && <HistoryTab groupId={group.id} />}

      {canEdit && (
        <>
          <GroupEditorDialog
            open={editorOpen}
            onOpenChange={setEditorOpen}
            group={group}
            groups={allGroups}
            campaigns={campaigns}
            onSaved={() => {
              void reload();
              onChanged?.();
            }}
          />
          <AddDestinationDrawer
            open={adding}
            onOpenChange={setAdding}
            group={group}
            rows={rows}
            destinations={destinations}
            onDone={() => void reload()}
          />
          <LineDrawer
            row={editing}
            onClose={() => setEditing(null)}
            group={group}
            rows={rows}
            onRemove={(r) => {
              setEditing(null);
              setRemoving([r]);
            }}
            onDone={() => void reload()}
          />
          <RemoveDialog
            rows={removing}
            group={group}
            onClose={() => setRemoving(null)}
            onDone={() => {
              setPicked(new Set());
              void reload();
            }}
          />
          <BulkEditDrawer
            mode={bulk}
            rows={pickedRows}
            group={group}
            onClose={() => setBulk(null)}
            onDone={() => void reload()}
          />
          <AddToCampaignsDialog
            open={addTo}
            rows={pickedRows}
            group={group}
            onClose={() => setAddTo(false)}
            onDone={() => void reload()}
          />
        </>
      )}
    </div>
  );
}

function CampaignsTab({ group, lines }: { group: CampaignGroup; lines: GroupLine[] }) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const count = (id: string) => lines.filter((l) => l.campaigns.some((c) => c.campaignId === id)).length;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">{t("x415.campaign")}</th>
            <th className="px-4 py-2.5 font-medium">{t("x415.status")}</th>
            <th className="px-4 py-2.5 font-medium">{t("x415.tabDestinations")}</th>
          </tr>
        </thead>
        <tbody>
          {group.campaigns.length === 0 ? (
            <tr><td colSpan={3} className="px-4 py-6 text-xs text-muted-foreground">{t("cg.noCampaigns")}</td></tr>
          ) : (
            group.campaigns.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5">
                  <Link href={`${ROUTES.campaigns}/${c.id}`} className="font-medium hover:underline">{localName(c.name)}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <StatusDot status={c.status} />
                    {t(`cg.status.${c.status === "active" || c.status === "paused" ? c.status : "archived"}`)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs tabular-nums">
                  {fill(t("x415.nOfM"), { n: count(c.id), m: lines.length })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<GroupHistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let off = false;
    campaignGroups
      .history(groupId)
      .then((x) => !off && setItems(x))
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [groupId]);
  return (
    <div className="rounded-xl border border-border bg-card">
      {failed ? (
        <p className="px-4 py-6 text-xs text-muted-foreground">{t("x415.historyUnavailable")}</p>
      ) : items === null ? (
        <p className="px-4 py-6 text-xs text-muted-foreground">{t("cg.loading")}</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-xs text-muted-foreground">{t("x415.historyEmpty")}</p>
      ) : (
        <ul>
          {items.map((h) => (
            <li key={h.id} className="flex flex-col gap-0.5 border-b border-border px-4 py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="w-40 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatLocalDateTime(new Date(h.at).getTime())}
              </span>
              <span className="min-w-0 flex-1 text-xs">{h.text}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{h.by}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

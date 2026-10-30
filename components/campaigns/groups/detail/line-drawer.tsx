"use client";

/**
 * CH-415 (Sir's design): one destination across the group - in which
 * campaigns, at which priority and weight in each, and its limits.
 *
 * Priority and weight belong to each campaign (the campaign's own row), so
 * they can be the same everywhere or different per campaign. The live-call
 * limit and the caps belong to the destination itself (its record on the
 * Destinations page) and apply in every campaign it is in - routing counts
 * them there - so they are set once, below the campaigns.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignGroups, type CampaignGroup, type SetLineCampaign } from "@/lib/api/services/campaign-groups.service";
import { useLocalName } from "@/lib/i18n/local-name";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import type { Destination } from "@/lib/types/destination";
import { cn } from "@/lib/utils";
import { fill, StatusDot } from "../shared";
import { formatUs, type GroupRow } from "./model";
import { toInt } from "./ui";

interface Cell {
  included: boolean;
  priority: string;
  weight: string;
}

export interface LimitsDraft {
  concurrency: string;
  hourly: string;
  daily: string;
  monthly: string;
}

export const limitsOf = (d: Destination | null): LimitsDraft => ({
  concurrency: d && d.concurrencyCap > 0 ? String(d.concurrencyCap) : "",
  hourly: d && (d.hourlyCap ?? 0) > 0 ? String(d.hourlyCap) : "",
  daily: d && d.dailyCap > 0 ? String(d.dailyCap) : "",
  monthly: d && d.monthlyCap > 0 ? String(d.monthlyCap) : "",
});

/** What changed in the limits, as the Destinations API takes it (empty = 0 = none). */
export function limitsPatch(before: LimitsDraft, after: LimitsDraft): Partial<Destination> {
  const patch: Partial<Destination> = {};
  const n = (v: string) => toInt(v) ?? 0;
  if (n(before.concurrency) !== n(after.concurrency)) patch.concurrencyCap = n(after.concurrency);
  if (n(before.hourly) !== n(after.hourly)) patch.hourlyCap = n(after.hourly);
  if (n(before.daily) !== n(after.daily)) patch.dailyCap = n(after.daily);
  if (n(before.monthly) !== n(after.monthly)) patch.monthlyCap = n(after.monthly);
  return patch;
}

export function tzLabel(tz: string | undefined) {
  if (!tz || tz === "America/New_York") return "ET";
  if (tz === "America/Chicago") return "CT";
  if (tz === "America/Denver") return "MT";
  if (tz === "America/Los_Angeles") return "PT";
  return tz;
}

export function LimitsFields({ value, onChange, disabled }: { value: LimitsDraft; onChange: (v: LimitsDraft) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const field = (k: keyof LimitsDraft, label: string, ph: string) => (
    <div className="space-y-1">
      <div className="text-[11px] font-medium">{label}</div>
      <Input
        type="number"
        min={0}
        value={value[k]}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, [k]: e.target.value })}
        placeholder={ph}
        className="h-9 font-mono tabular-nums"
      />
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {field("concurrency", t("x415.maxLiveLong"), t("x415.noLimit"))}
        <p className="text-[11px] text-muted-foreground">{t("x415.maxLiveHint")}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {field("hourly", t("x415.hourlyCap"), t("x415.noCap"))}
        {field("daily", t("x415.dailyCap"), t("x415.noCap"))}
        {field("monthly", t("x415.monthlyCap"), t("x415.noCap"))}
      </div>
    </div>
  );
}

export function LineDrawer({
  row,
  onClose,
  group,
  rows,
  onRemove,
  onDone,
}: {
  row: GroupRow | null;
  onClose: () => void;
  group: CampaignGroup;
  rows: GroupRow[];
  onRemove: (r: GroupRow) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const updateDest = useDestinationsStore((s) => s.update);

  const initial = useMemo(() => {
    const cells: Record<string, Cell> = {};
    for (const c of group.campaigns) {
      const there = row?.line.campaigns.find((x) => x.campaignId === c.id);
      cells[c.id] = there
        ? { included: true, priority: String(there.priority), weight: String(there.weight) }
        : { included: false, priority: "", weight: "" };
    }
    return cells;
  }, [row, group]);

  const [mode, setMode] = useState<"same" | "per">("same");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [samePriority, setSamePriority] = useState("");
  const [sameWeight, setSameWeight] = useState("");
  const [all, setAll] = useState({ priority: "", weight: "" });
  const [limits, setLimits] = useState<LimitsDraft>(limitsOf(null));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!row) return;
    setCells(initial);
    setMode(row.mixed || row.weights.length > 1 ? "per" : "same");
    setSamePriority(row.mixed ? "" : String(row.minPriority));
    setSameWeight(row.weights.length === 1 ? String(row.weights[0]) : "");
    setAll({ priority: "", weight: "" });
    setLimits(limitsOf(row.dest));
  }, [row, initial]);

  // The campaigns as they will be saved.
  const target = useMemo(() => {
    const out: Record<string, Cell> = {};
    for (const [id, c] of Object.entries(cells)) {
      out[id] =
        mode === "same" && c.included
          ? { included: true, priority: samePriority || c.priority || "1", weight: sameWeight || c.weight || "100" }
          : { ...c, priority: c.included ? c.priority || "1" : "", weight: c.included ? c.weight || "100" : "" };
    }
    return out;
  }, [cells, mode, samePriority, sameWeight]);

  const campaignChanges: SetLineCampaign[] = useMemo(() => {
    const out: SetLineCampaign[] = [];
    for (const c of group.campaigns) {
      const a = initial[c.id];
      const b = target[c.id];
      if (!a || !b) continue;
      if (a.included !== b.included || (b.included && (a.priority !== b.priority || a.weight !== b.weight))) {
        out.push(
          b.included
            ? { campaignId: c.id, included: true, priority: toInt(b.priority) ?? 1, weight: toInt(b.weight) ?? 100 }
            : { campaignId: c.id, included: false },
        );
      }
    }
    return out;
  }, [initial, target, group]);

  const destPatch = useMemo(() => (row?.dest ? limitsPatch(limitsOf(row.dest), limits) : {}), [row, limits]);
  const changeCount = campaignChanges.length + Object.keys(destPatch).length;

  if (!row) return null;
  const includedIds = group.campaigns.filter((c) => target[c.id]?.included);
  const removedAll = includedIds.length === 0;

  const prioritySummary = (() => {
    const by = new Map<number, number>();
    row.line.campaigns.forEach((c) => by.set(c.priority, (by.get(c.priority) ?? 0) + 1));
    return [...by.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([p, n]) => fill(n === 1 ? t("x415.prioInOne") : t("x415.prioInN"), { p, n }))
      .join(", ");
  })();

  const setCell = (id: string, patch: Partial<Cell>) => setCells((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const applyAll = () => {
    setCells((s) => {
      const next = { ...s };
      for (const [id, c] of Object.entries(next)) {
        if (!c.included) continue;
        next[id] = { ...c, priority: all.priority || c.priority, weight: all.weight || c.weight };
      }
      return next;
    });
  };

  const save = async () => {
    if (removedAll) {
      onRemove(row);
      return;
    }
    setBusy(true);
    try {
      if (campaignChanges.length) {
        try {
          await campaignGroups.setLine(group.id, { number: row.number, buyerId: row.buyerId ?? undefined, campaigns: campaignChanges });
        } catch (e) {
          // A server not updated yet has no /line: the same priority and
          // weight everywhere the line already is still goes through /apply.
          const status = (e as { status?: number }).status;
          const uniform =
            campaignChanges.every((c) => c.included && initial[c.campaignId]?.included) &&
            new Set(campaignChanges.map((c) => `${c.priority}|${c.weight}`)).size === 1 &&
            campaignChanges.length === row.line.campaigns.length;
          if ((status === 404 || status === 405) && uniform) {
            await campaignGroups.apply({
              groupIds: [group.id],
              action: "update",
              number: row.number,
              priority: campaignChanges[0].priority,
              weight: campaignChanges[0].weight,
            });
          } else throw e;
        }
      }
      if (row.dest && Object.keys(destPatch).length) await updateDest(row.dest.id, destPatch);
      toast.success(fill(t("x415.savedN"), { n: changeCount }));
      onDone();
      onClose();
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-center gap-3 pr-6">
            {row.buyerName && (
              <span className="rounded border border-border bg-muted/40 px-2 py-1 text-[11px] font-semibold">{localName(row.buyerName)}</span>
            )}
            <div className="min-w-0">
              <SheetTitle className="font-mono text-lg tabular-nums">{formatUs(row.number)}</SheetTitle>
              <SheetDescription className="text-xs">
                {fill(t("x415.inNofM"), { n: row.inCount, m: row.ofCount })}
                {row.mixed && ` · ${t("x415.prioritiesDiffer")}`}
              </SheetDescription>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 rounded-lg border border-border p-0.5 text-xs">
            {(["same", "per"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn("rounded-md py-1.5 transition-colors", mode === m ? "bg-muted font-medium text-foreground" : "text-muted-foreground")}
              >
                {m === "same" ? t("x415.sameEverywhere") : t("x415.differentPer")}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {row.mixed && (
            <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {fill(t("x415.mixedWarn"), { summary: prioritySummary })}
            </p>
          )}

          {mode === "same" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-medium">{t("cg.col.priority")}</div>
                  <Input type="number" min={1} value={samePriority} onChange={(e) => setSamePriority(e.target.value)} placeholder={t("x415.keepEach")} className="h-9 font-mono" />
                  <p className="text-[11px] text-muted-foreground">{t("x415.priorityHint")}</p>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-medium">{t("cg.col.weight")}</div>
                  <Input type="number" min={0} value={sameWeight} onChange={(e) => setSameWeight(e.target.value)} placeholder={t("x415.keepEach")} className="h-9 font-mono" />
                  <p className="text-[11px] text-muted-foreground">{t("x415.weightHint")}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-medium">{t("x415.inTheseCampaigns")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {group.campaigns.map((c) => {
                    const on = cells[c.id]?.included;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCell(c.id, { included: !on })}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                          on ? "border-accent/50 bg-accent/10 text-foreground" : "border-border text-muted-foreground",
                        )}
                      >
                        <StatusDot status={c.status} /> {localName(c.name)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">{t("x415.campaign")}</th>
                    <th className="px-2 py-2 font-medium">{t("x415.included")}</th>
                    <th className="px-2 py-2 font-medium">{t("cg.col.priority")}</th>
                    <th className="px-2 py-2 font-medium">{t("cg.col.weight")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-accent/5">
                    <td className="py-1.5 pr-2 text-[11px] font-medium text-accent" colSpan={2}>
                      <button type="button" onClick={applyAll} className="hover:underline">{t("x415.applyAllIncluded")}</button>
                    </td>
                    <td className="px-2 py-1.5"><Input type="number" min={1} value={all.priority} onChange={(e) => setAll((a) => ({ ...a, priority: e.target.value }))} placeholder="—" className="h-8 font-mono" /></td>
                    <td className="px-2 py-1.5"><Input type="number" min={0} value={all.weight} onChange={(e) => setAll((a) => ({ ...a, weight: e.target.value }))} placeholder="—" className="h-8 font-mono" /></td>
                  </tr>
                  {group.campaigns.map((c) => {
                    const cell = cells[c.id] ?? { included: false, priority: "", weight: "" };
                    const was = initial[c.id];
                    const changedP = cell.included && was?.included && cell.priority !== was.priority;
                    return (
                      <tr key={c.id} className="border-t border-border">
                        <td className="py-1.5 pr-2">
                          <span className={cn("inline-flex items-center gap-1.5 font-mono", cell.included ? "text-foreground" : "text-muted-foreground")}>
                            <StatusDot status={c.status} /> {localName(c.name)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <Switch checked={cell.included} onCheckedChange={(v) => setCell(c.id, { included: v })} className="data-[state=checked]:bg-emerald-500" aria-label={c.name} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={1} disabled={!cell.included} value={cell.priority} onChange={(e) => setCell(c.id, { priority: e.target.value })} placeholder={cell.included ? "1" : ""} className={cn("h-8 font-mono", changedP && "border-amber-500/60")} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min={0} disabled={!cell.included} value={cell.weight} onChange={(e) => setCell(c.id, { weight: e.target.value })} placeholder={cell.included ? "100" : ""} className="h-8 font-mono" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <h3 className="text-sm font-semibold">{t("x415.limitsTitle")}</h3>
              <p className="text-[11px] text-muted-foreground">{t("x415.limitsEvery")}</p>
            </div>
            {row.dest ? (
              <>
                <LimitsFields value={limits} onChange={setLimits} />
                <p className="text-[11px] text-muted-foreground">{fill(t("x415.capsCount"), { tz: tzLabel(row.dest.timezone) })}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t("x415.noRecord")}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div>
              <div className="text-sm font-medium">{fill(t("x415.removeFromGroup"), { group: group.name })}</div>
              <p className="text-[11px] text-muted-foreground">{fill(t("x415.removeFromGroupDesc"), { n: row.inCount })}</p>
            </div>
            <Button size="sm" variant="outline" className="text-red-400" onClick={() => onRemove(row)}>{t("x415.removeDots")}</Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{fill(changeCount === 1 ? t("x415.oneChange") : t("x415.nChanges"), { n: changeCount })}</span>
            {" · "}
            {t("x415.applyNewCalls")}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{t("cg.cancel")}</Button>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => void save()} disabled={busy || changeCount === 0}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t("x415.saveChanges")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

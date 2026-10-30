"use client";

/**
 * CH-415 (Sir's design): the ticked destinations edited together. Only the
 * fields switched to "Change" are sent; everything else stays as it is.
 *
 * Priority and weight are each campaign's own: changed in every campaign the
 * lines are in (one transaction, POST /apply) or only in the campaigns
 * picked (POST /{id}/line, per line). The live-call limit, the caps and on /
 * off belong to each destination record and apply in every campaign.
 */

import { useEffect, useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignGroups, type CampaignGroup } from "@/lib/api/services/campaign-groups.service";
import { useLocalName } from "@/lib/i18n/local-name";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import type { Destination } from "@/lib/types/destination";
import { cn } from "@/lib/utils";
import { fill } from "../shared";
import { formatUs, type GroupRow } from "./model";
import { toInt } from "./ui";

type Field = "priority" | "weight" | "concurrency" | "hourly" | "daily" | "monthly" | "status";
const LIMIT_FIELD: Partial<Record<Field, keyof Destination>> = {
  concurrency: "concurrencyCap",
  hourly: "hourlyCap",
  daily: "dailyCap",
  monthly: "monthlyCap",
};

function CampaignChips({
  group,
  value,
  onChange,
  only,
}: {
  group: CampaignGroup;
  value: Set<string>;
  onChange: (v: Set<string>) => void;
  only?: Set<string>;
}) {
  const localName = useLocalName();
  return (
    <div className="flex flex-wrap gap-1.5">
      {group.campaigns
        .filter((c) => !only || only.has(c.id))
        .map((c) => {
          const on = value.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                const next = new Set(value);
                if (on) next.delete(c.id);
                else next.add(c.id);
                onChange(next);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                on ? "border-accent/50 bg-accent/10" : "border-border text-muted-foreground",
              )}
            >
              <span className={cn("h-3 w-3 rounded-sm border", on ? "border-accent bg-accent" : "border-muted-foreground/50")} />
              {localName(c.name)}
            </button>
          );
        })}
    </div>
  );
}

export function BulkEditDrawer({
  mode,
  rows,
  group,
  onClose,
  onDone,
}: {
  mode: null | "routing" | "limits";
  rows: GroupRow[];
  group: CampaignGroup;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const updateDest = useDestinationsStore((s) => s.update);
  const setEnabled = useDestinationsStore((s) => s.setEnabled);

  const [change, setChange] = useState<Set<Field>>(new Set());
  const [values, setValues] = useState<Record<Field, string>>({ priority: "", weight: "", concurrency: "", hourly: "", daily: "", monthly: "", status: "paused" });
  const [where, setWhere] = useState<"every" | "some">("every");
  const [some, setSome] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setChange(new Set());
    setValues({ priority: "", weight: "", concurrency: "", hourly: "", daily: "", monthly: "", status: "paused" });
    setWhere("every");
    setSome(new Set());
  }, [mode]);

  const inIds = useMemo(() => new Set(rows.flatMap((r) => r.line.campaigns.map((c) => c.campaignId))), [rows]);

  if (!mode) return null;

  const now = (f: Field): string => {
    const uniq = (xs: (number | string)[]) => [...new Set(xs)];
    const fmtCap = (xs: number[]) => {
      const u = uniq(xs) as number[];
      if (u.length > 1) return t("x415.nowMixed");
      return u[0] > 0 ? String(u[0]) : t("x415.noCap").toLowerCase();
    };
    const dests = rows.map((r) => r.dest).filter(Boolean) as Destination[];
    switch (f) {
      case "priority": {
        const all = rows.flatMap((r) => r.priorities);
        const lo = Math.min(...all), hi = Math.max(...all);
        return lo === hi ? String(lo) : `${lo}–${hi}, ${t("x415.mixed").toLowerCase()}`;
      }
      case "weight": {
        const all = uniq(rows.flatMap((r) => r.weights));
        return all.length === 1 ? String(all[0]) : t("x415.nowMixed");
      }
      case "concurrency": {
        const u = uniq(dests.map((d) => d.concurrencyCap)) as number[];
        if (u.length > 1) return t("x415.nowMixed");
        return u[0] > 0 ? fill(t("x415.nCalls"), { n: u[0] }) : t("x415.noLimit").toLowerCase();
      }
      case "hourly": return fmtCap(dests.map((d) => d.hourlyCap ?? 0));
      case "daily": return fmtCap(dests.map((d) => d.dailyCap));
      case "monthly": return fmtCap(dests.map((d) => d.monthlyCap));
      case "status": {
        const u = uniq(dests.map((d) => (d.enabled ? "on" : "off")));
        return u.length > 1 ? t("x415.nowMixed") : u[0] === "on" ? t("x415.on") : t("x415.off");
      }
    }
  };

  const fields: [Field, string][] = [
    ["priority", t("cg.col.priority")],
    ["weight", t("cg.col.weight")],
    ["concurrency", t("x415.maxLiveLong")],
    ["hourly", t("x415.hourlyCap")],
    ["daily", t("x415.dailyCap")],
    ["monthly", t("x415.monthlyCap")],
    ["status", t("x415.status")],
  ];

  const routing = (["priority", "weight"] as Field[]).filter((f) => change.has(f));
  const destFields = (["concurrency", "hourly", "daily", "monthly"] as Field[]).filter((f) => change.has(f));
  const campaignsTouched = where === "every" ? inIds.size : some.size;
  const settings = rows.reduce((s, r) => {
    const camps = where === "every" ? r.line.campaigns.length : r.line.campaigns.filter((c) => some.has(c.campaignId)).length;
    return s + camps * routing.length;
  }, 0) + (destFields.length + (change.has("status") ? 1 : 0)) * rows.filter((r) => r.dest).length;

  const valid =
    change.size > 0 &&
    routing.every((f) => toInt(values[f]) !== undefined && (f !== "priority" || (toInt(values[f]) ?? 0) >= 1)) &&
    (where === "every" || !routing.length || some.size > 0);

  const preview = [...change]
    .map((f) => {
      const label = fields.find(([k]) => k === f)?.[1] ?? f;
      const v = f === "status" ? (values.status === "on" ? t("x415.on") : t("x415.off")) : values[f] === "" && f !== "priority" && f !== "weight" ? t("x415.noCap").toLowerCase() : values[f];
      return `${label.toLowerCase()} → ${v}`;
    })
    .join(", ");

  const save = async () => {
    setBusy(true);
    try {
      if (routing.length) {
        const priority = change.has("priority") ? toInt(values.priority) : undefined;
        const weight = change.has("weight") ? toInt(values.weight) : undefined;
        if (where === "every") {
          await campaignGroups.apply({
            groupIds: [group.id],
            action: "update",
            number: rows[0].number,
            numbers: rows.length > 1 ? rows.map((r) => ({ number: r.number })) : undefined,
            priority,
            weight,
          });
        } else {
          for (const r of rows) {
            const camps = r.line.campaigns.filter((c) => some.has(c.campaignId));
            if (!camps.length) continue;
            await campaignGroups.setLine(group.id, {
              number: r.number,
              buyerId: r.buyerId ?? undefined,
              campaigns: camps.map((c) => ({ campaignId: c.campaignId, included: true, priority: priority ?? c.priority, weight: weight ?? c.weight })),
            });
          }
        }
      }
      let failed = 0;
      for (const r of rows) {
        if (!r.dest) continue;
        const patch: Partial<Destination> = {};
        for (const f of destFields) (patch as Record<string, number>)[LIMIT_FIELD[f] as string] = toInt(values[f]) ?? 0;
        try {
          if (Object.keys(patch).length) await updateDest(r.dest.id, patch);
          if (change.has("status") && r.dest.enabled !== (values.status === "on")) await setEnabled(r.dest.id, values.status === "on");
        } catch {
          failed += 1;
        }
      }
      if (failed) toast.error(fill(t("x415.someFailed"), { n: failed }));
      else toast.success(fill(t("x415.appliedTo"), { n: rows.length }));
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
          <SheetTitle className="text-lg">{fill(t("x415.editN"), { n: rows.length })}</SheetTitle>
          <SheetDescription className="text-xs">{t("x415.editNSub")}</SheetDescription>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rows.map((r) => (
              <span key={r.number} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px]">
                <span className="font-semibold">{localName(r.buyerName)}</span>
                <span className="font-mono tabular-nums">{formatUs(r.number)}</span>
              </span>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-1 overflow-y-auto p-5">
          {fields.map(([f, label]) => {
            const on = change.has(f);
            const first = mode === "routing" ? f === "priority" : f === "concurrency";
            return (
              <div key={f} className={cn("grid grid-cols-[1fr_auto_10rem] items-center gap-3 border-b border-border py-2.5", first && !change.size && "bg-accent/5")}>
                <div>
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-[11px] text-muted-foreground">{fill(t("x415.now"), { v: now(f) })}</div>
                </div>
                <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
                  {[false, true].map((c) => (
                    <button
                      key={String(c)}
                      type="button"
                      onClick={() =>
                        setChange((s) => {
                          const next = new Set(s);
                          if (c) next.add(f);
                          else next.delete(f);
                          return next;
                        })
                      }
                      className={cn("px-3 py-1", on === c ? "bg-muted text-foreground" : "text-muted-foreground")}
                    >
                      {c ? t("x415.change") : t("x415.keep")}
                    </button>
                  ))}
                </div>
                {f === "status" ? (
                  <Select value={values.status} onValueChange={(v) => setValues((s) => ({ ...s, status: v }))} disabled={!on}>
                    <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on">{t("x415.on")}</SelectItem>
                      <SelectItem value="paused">{t("x415.off")}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    min={f === "priority" ? 1 : 0}
                    disabled={!on}
                    value={values[f]}
                    onChange={(e) => setValues((s) => ({ ...s, [f]: e.target.value }))}
                    placeholder={f === "priority" || f === "weight" ? "" : f === "concurrency" ? t("x415.noLimit") : t("x415.noCap")}
                    className="h-8 font-mono"
                  />
                )}
              </div>
            );
          })}

          <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
            <div className="text-xs font-medium">{t("x415.applyIn")}</div>
            <label className="flex items-center gap-2 text-xs">
              <input type="radio" checked={where === "every"} onChange={() => setWhere("every")} />
              {fill(t("x415.everyCampaign"), { n: inIds.size })}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="radio" checked={where === "some"} onChange={() => setWhere("some")} />
              {t("x415.onlySelected")}
            </label>
            {where === "some" && <CampaignChips group={group} value={some} onChange={setSome} only={inIds} />}
            <p className="text-[11px] text-muted-foreground">{t("x415.applyInNote")}</p>
          </div>

          {change.size > 0 && (
            <p className="mt-3 flex gap-2 rounded-lg border border-accent/20 bg-accent/5 p-2.5 text-[11px] text-muted-foreground">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />
              {fill(t("x415.preview"), { what: preview, d: rows.length, c: campaignsTouched, s: settings })}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{t("cg.cancel")}</Button>
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => void save()} disabled={busy || !valid}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {fill(t("x415.applyToN"), { n: rows.length })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The ticked destinations added to more of the group's campaigns, each at
 *  its lowest priority and its weight, with the billing it has there. */
export function AddToCampaignsDialog({
  open,
  rows,
  group,
  onClose,
  onDone,
}: {
  open: boolean;
  rows: GroupRow[];
  group: CampaignGroup;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setPick(new Set());
  }, [open]);

  const adds = rows.reduce(
    (s, r) => s + group.campaigns.filter((c) => pick.has(c.id) && !r.line.campaigns.some((x) => x.campaignId === c.id)).length,
    0,
  );

  const go = async () => {
    setBusy(true);
    let done = 0;
    try {
      for (const r of rows) {
        const missing = group.campaigns.filter((c) => pick.has(c.id) && !r.line.campaigns.some((x) => x.campaignId === c.id));
        if (!missing.length) continue;
        const res = await campaignGroups.setLine(group.id, {
          number: r.number,
          buyerId: r.buyerId ?? undefined,
          campaigns: missing.map((c) => ({ campaignId: c.id, included: true, priority: r.minPriority, weight: r.weights[0] ?? 100 })),
        });
        done += res.changed;
      }
      toast.success(fill(t("x415.addedN"), { n: done }));
      onDone();
      onClose();
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
      if (done) onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("x415.addToCampaigns")}</DialogTitle>
          <DialogDescription>{fill(t("x415.addToDesc"), { n: rows.length })}</DialogDescription>
        </DialogHeader>
        <CampaignChips group={group} value={pick} onChange={setPick} />
        <p className="text-[11px] text-muted-foreground">{fill(t("x415.addToCount"), { n: adds })}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cg.cancel")}</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => void go()} disabled={busy || adds === 0}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t("x415.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

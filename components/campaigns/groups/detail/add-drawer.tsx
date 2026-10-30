"use client";

/**
 * CH-415 (Sir's design): add a destination to the group - an existing one
 * from the Destinations page, or a new phone number (created there first, so
 * its limits and on / off live where routing reads them) - in all of the
 * group's campaigns or only some, at one priority and weight.
 *
 * Rate and Convert ON stay required for a line the group's campaigns do not
 * have yet (as on the campaign page, CH-248); a line already in some of them
 * keeps the billing it has there.
 *
 * CH-422 (Sir, 30 Oct: "Make this box large and give check box too"): existing
 * destinations are picked from a large list with check boxes - several at
 * once. Each one new to the group gets its own Rate and Convert ON (every
 * buyer pays its own rate); priority, weight and campaigns are shared. A line
 * already in every campaign of the group cannot be picked. Each destination is
 * saved in its own transaction; any that fail are named, the rest are kept.
 */

import { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignGroups, type CampaignGroup } from "@/lib/api/services/campaign-groups.service";
import { toE164 } from "@/lib/format";
import { useLocalName } from "@/lib/i18n/local-name";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import type { Destination } from "@/lib/types/destination";
import { cn } from "@/lib/utils";
import { fill } from "../shared";
import { LimitsFields, limitsOf, limitsPatch, tzLabel, type LimitsDraft } from "./line-drawer";
import { digits10, formatUs, shareAt, type GroupRow } from "./model";
import { Step, toInt } from "./ui";

type ConvertOn = "" | "incoming" | "connected" | "length";
interface Bill {
  rate: string;
  convertOn: ConvertOn;
  seconds: string;
}
const EMPTY_BILL: Bill = { rate: "", convertOn: "", seconds: "" };
const billDone = (b: Bill | undefined) =>
  !!b && b.rate.trim() !== "" && Number(b.rate) >= 0 && !!b.convertOn && (b.convertOn !== "length" || (toInt(b.seconds) ?? 0) > 0);
const billWire = (b: Bill) => ({
  revenue: Number(b.rate),
  convertOn: b.convertOn as "incoming" | "connected" | "length",
  convertSeconds: b.convertOn === "length" ? toInt(b.seconds) ?? 0 : 0,
});

export function AddDestinationDrawer({
  open,
  onOpenChange,
  group,
  rows,
  destinations,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group: CampaignGroup;
  rows: GroupRow[];
  destinations: Destination[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const buyers = useBuyersStore((s) => s.buyers);
  const fetchBuyers = useBuyersStore((s) => s.fetch);
  const addDest = useDestinationsStore((s) => s.add);
  const updateDest = useDestinationsStore((s) => s.update);

  const [source, setSource] = useState<"existing" | "new">("existing");
  const [picked, setPicked] = useState<string[]>([]);
  const [bills, setBills] = useState<Record<string, Bill>>({});
  const [search, setSearch] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newBuyer, setNewBuyer] = useState("");
  const [newName, setNewName] = useState("");
  const [scope, setScope] = useState<"all" | "some">("all");
  const [some, setSome] = useState<Set<string>>(new Set());
  const [priority, setPriority] = useState("1");
  const [weight, setWeight] = useState("100");
  const [rate, setRate] = useState("");
  const [convertOn, setConvertOn] = useState<ConvertOn>("");
  const [seconds, setSeconds] = useState("");
  const [limits, setLimits] = useState<LimitsDraft>(limitsOf(null));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSource("existing");
    setPicked([]);
    setBills({});
    setSearch("");
    setNewNumber("");
    setNewBuyer("");
    setNewName("");
    setScope("all");
    setSome(new Set());
    setPriority("1");
    setWeight("100");
    setRate("");
    setConvertOn("");
    setSeconds("");
    setLimits(limitsOf(null));
    if (!buyers.length) void fetchBuyers();
  }, [open, buyers.length, fetchBuyers]);

  const pickedDests = useMemo(
    () => picked.map((id) => destinations.find((d) => d.id === id)).filter(Boolean) as Destination[],
    [picked, destinations],
  );
  // Limits are each destination's own: shown for one at a time.
  const dest = source === "existing" && pickedDests.length === 1 ? pickedDests[0] : null;
  useEffect(() => setLimits(limitsOf(dest)), [dest]);

  const rowOf = (tfn: string) => rows.find((r) => r.digits === digits10(tfn)) ?? null;
  const alreadyOf = (tfn: string) => new Set(rowOf(tfn)?.line.campaigns.map((c) => c.campaignId) ?? []);
  const targetsOf = (tfn: string) => {
    const has = alreadyOf(tfn);
    return group.campaigns.filter((c) => !has.has(c.id) && (scope === "all" || some.has(c.id)));
  };

  // The one line the steps describe: the single pick, or the new number.
  const number = source === "existing" ? pickedDests[0]?.tfn ?? "" : toE164(newNumber);
  const key = digits10(number);
  const row = useMemo(() => (key.length === 10 ? rows.find((r) => r.digits === key) ?? null : null), [rows, key]);
  const already = source === "existing" && pickedDests.length > 1 ? new Set<string>() : new Set(row?.line.campaigns.map((c) => c.campaignId) ?? []);
  const targets = group.campaigns.filter((c) => !already.has(c.id) && (scope === "all" || some.has(c.id)));
  const needsBilling = source === "new" ? !row : false;
  const buyerName =
    source === "existing" ? pickedDests[0]?.buyerName ?? "" : buyers.find((b) => b.id === newBuyer)?.name ?? "";

  // Existing picks: what each adds, and which are new to the group (own billing).
  const plan = pickedDests.map((d) => ({ d, targets: targetsOf(d.tfn), isNew: !rowOf(d.tfn) }));
  const adding = plan.filter((x) => x.targets.length > 0);
  const newOnes = plan.filter((x) => x.isNew);
  const rowsAdded = adding.reduce((s, x) => s + x.targets.length, 0);

  // Already in every campaign of the group: nothing left to add.
  const fullIn = (d: Destination) => {
    const r = rows.find((x) => x.digits === digits10(d.tfn));
    return !!r && r.inCount >= r.ofCount;
  };

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return [...destinations]
      .filter((d) => !q || (d.buyerName ?? "").toLowerCase().includes(q) || d.name.toLowerCase().includes(q) || (qd && digits10(d.tfn).includes(qd)))
      // CH-422: pickable lines first (not yet in every campaign), live before
      // paused, then by buyer.
      .sort(
        (a, b) =>
          Number(fullIn(a)) - Number(fullIn(b)) ||
          Number(b.enabled) - Number(a.enabled) ||
          (a.buyerName ?? "").localeCompare(b.buyerName ?? "", undefined, { numeric: true }),
      );
  }, [destinations, search, rows]);

  const inAll = (d: Destination) => {
    const r = rowOf(d.tfn);
    return !!r && r.inCount >= r.ofCount;
  };

  const p = toInt(priority) ?? 1;
  const w = toInt(weight) ?? 100;
  const share = shareAt(rows, p, w, key);

  const valid =
    source === "existing"
      ? adding.length > 0 && newOnes.every((x) => billDone(bills[x.d.id]))
      : key.length === 10 &&
        targets.length > 0 &&
        !!newBuyer &&
        (newName.trim().length >= 2 || !!buyerName) &&
        (!needsBilling || (rate.trim() !== "" && Number(rate) >= 0 && !!convertOn && (convertOn !== "length" || (toInt(seconds) ?? 0) > 0)));

  const togglePick = (id: string, on: boolean) =>
    setPicked((p) => (on ? (p.includes(id) ? p : [...p, id]) : p.filter((x) => x !== id)));
  const setBill = (id: string, patch: Partial<Bill>) =>
    setBills((b) => ({ ...b, [id]: { ...(b[id] ?? EMPTY_BILL), ...patch } }));
  const copyFirstBill = () => {
    const first = newOnes[0] && bills[newOnes[0].d.id];
    if (!first) return;
    setBills((b) => ({ ...b, ...Object.fromEntries(newOnes.map((x) => [x.d.id, { ...first }])) }));
  };

  /** One existing destination into the campaigns it is missing from. */
  const addOne = async (d: Destination, camps: { id: string }[], isNew: boolean) => {
    const billing = isNew ? billWire(bills[d.id] ?? EMPTY_BILL) : {};
    try {
      await campaignGroups.setLine(group.id, {
        number: d.tfn,
        buyerId: d.buyerId || undefined,
        campaigns: camps.map((c) => ({ campaignId: c.id, included: true, priority: p, weight: w })),
        ...billing,
      });
    } catch (e) {
      // A server not updated yet has no /line: every missing campaign still
      // goes through /apply, with the billing given or the one the line has.
      const status = (e as { status?: number }).status;
      const r = rowOf(d.tfn);
      const known = r?.line.campaigns.find((c) => c.revenue != null && c.convertOn);
      const bill = isNew
        ? billing
        : known
          ? { revenue: Number(known.revenue), convertOn: known.convertOn as "incoming" | "connected" | "length", convertSeconds: known.convertSeconds }
          : null;
      const everyMissing = camps.length === group.campaigns.length - alreadyOf(d.tfn).size;
      if ((status === 404 || status === 405) && everyMissing && bill) {
        await campaignGroups.apply({ groupIds: [group.id], action: "add", number: d.tfn, buyerId: d.buyerId || undefined, priority: p, weight: w, ...bill });
      } else throw e;
    }
  };

  const saveMany = async () => {
    setBusy(true);
    const failed: string[] = [];
    let done = 0;
    for (const x of adding) {
      try {
        await addOne(x.d, x.targets, x.isNew);
        done += 1;
      } catch (e) {
        failed.push(`${formatUs(x.d.tfn)} (${friendlyErrorMessage(e)})`);
      }
    }
    try {
      if (dest) {
        const patch = limitsPatch(limitsOf(dest), limits);
        if (Object.keys(patch).length) await updateDest(dest.id, patch);
      }
    } catch (e) {
      failed.push(friendlyErrorMessage(e));
    }
    setBusy(false);
    if (done) {
      toast.success(
        adding.length === 1
          ? fill(t("x415.addedTo"), { name: localName(adding[0].d.buyerName ?? "") || formatUs(adding[0].d.tfn), n: adding[0].targets.length })
          : fill(t("x422.addedMany"), { d: done }),
      );
      onDone();
    }
    if (failed.length) {
      toast.error(fill(t("x422.someFailed"), { n: failed.length, list: failed.join("; ") }));
      // Keep only the ones that failed picked, so they can be retried.
      setPicked((p) => p.filter((id) => failed.some((f) => f.startsWith(formatUs(destinations.find((d) => d.id === id)?.tfn ?? "")))));
    } else onOpenChange(false);
  };

  const save = async () => {
    if (!valid) return;
    if (source === "existing") return saveMany();
    setBusy(true);
    try {
      let buyerId: string | undefined = newBuyer;
      // A new number becomes a destination first, so its limits and its
      // on / off are where routing reads them.
      if (source === "new") {
        const created = await addDest({
          name: newName.trim() || `${buyerName}|${key.slice(-4)}`,
          tfn: toE164(newNumber),
          buyerId: newBuyer,
          concurrencyCap: toInt(limits.concurrency) ?? 0,
          hourlyCap: toInt(limits.hourly) ?? 0,
          dailyCap: toInt(limits.daily) ?? 0,
          monthlyCap: toInt(limits.monthly) ?? 0,
          enabled: true,
          liveCalls: 0,
          hourlyCalls: 0,
          dailyCalls: 0,
          monthlyCalls: 0,
          globalCalls: 0,
          hourlyRevenue: 0,
          dailyRevenue: 0,
          monthlyRevenue: 0,
          globalRevenue: 0,
          hourlySpend: 0,
          dailySpend: 0,
          monthlySpend: 0,
          globalSpend: 0,
        });
        buyerId = created.buyerId || newBuyer;
      }
      const billing = needsBilling
        ? {
            revenue: Number(rate),
            convertOn: convertOn as "incoming" | "connected" | "length",
            convertSeconds: convertOn === "length" ? toInt(seconds) ?? 0 : 0,
          }
        : {};
      const everyMissing = targets.length === group.campaigns.length - already.size;
      try {
        await campaignGroups.setLine(group.id, {
          number,
          buyerId,
          campaigns: targets.map((c) => ({ campaignId: c.id, included: true, priority: p, weight: w })),
          ...billing,
        });
      } catch (e) {
        // A server not updated yet has no /line: every missing campaign with
        // the billing given still goes through /apply.
        const status = (e as { status?: number }).status;
        if ((status === 404 || status === 405) && everyMissing && needsBilling) {
          await campaignGroups.apply({ groupIds: [group.id], action: "add", number, buyerId, priority: p, weight: w, ...billing });
        } else throw e;
      }
      toast.success(fill(t("x415.addedTo"), { name: localName(buyerName) || formatUs(number), n: targets.length }));
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let n = 0;
  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="text-lg">{t("x408.addDestination")}</SheetTitle>
          <SheetDescription className="text-xs">{fill(t("x415.addSub"), { group: group.name })}</SheetDescription>
        </SheetHeader>

        {/* CH-425 (Sir, 30 Oct: "Destination put more down - Campaign, Routing
            and Limits can be in bottom"): the destination list takes all the
            spare height, the other steps sit at the bottom. */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          <Step n={++n} title={t("x415.whichDestination")} grow={source === "existing"}>
            <div className="grid grid-cols-2 rounded-lg border border-border p-0.5 text-xs">
              {(["existing", "new"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSource(s)} className={cn("rounded-md py-1.5", source === s ? "bg-muted font-medium" : "text-muted-foreground")}>
                  {s === "existing" ? t("x415.existingDest") : t("x415.newNumber")}
                </button>
              ))}
            </div>
            {source === "existing" ? (
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("x415.search")} className="h-9 pl-8 text-xs" />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => setPicked((p) => [...new Set([...p, ...pool.filter((d) => !inAll(d)).map((d) => d.id)])])}
                  >
                    {t("x415.selectAll")}
                  </Button>
                  {picked.length > 0 && (
                    <Button type="button" size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setPicked([])}>
                      {t("x415.clear")}
                    </Button>
                  )}
                </div>
                {/* Sir: a large box with check boxes, not a small drop-down. */}
                <div className="min-h-80 flex-1 basis-80 overflow-y-auto rounded-lg border border-border">
                  {pool.length === 0 ? (
                    <p className="p-4 text-xs text-muted-foreground">{t("x415.noMatch")}</p>
                  ) : (
                    pool.map((d) => {
                      const r = rowOf(d.tfn);
                      const full = inAll(d);
                      const on = picked.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0",
                            on && "bg-accent/10",
                            full && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <Checkbox checked={on} disabled={full} onCheckedChange={(v) => togglePick(d.id, v === true)} aria-label={d.tfn} />
                          <span className="w-14 shrink-0 truncate rounded border border-border bg-muted/40 px-1.5 py-0.5 text-center text-[10px] font-semibold">
                            {localName(d.buyerName ?? "")}
                          </span>
                          <span className="font-mono text-[13px] tabular-nums">{formatUs(d.tfn)}</span>
                          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{localName(d.name)}</span>
                          {!d.enabled && <span className="shrink-0 text-[10px] text-amber-400">{t("cg.status.paused")}</span>}
                          <span
                            className={cn(
                              "shrink-0 rounded border px-1.5 py-px text-[10px]",
                              full
                                ? "border-border text-muted-foreground"
                                : r
                                  ? "border-amber-500/30 text-amber-400"
                                  : "border-accent/30 text-accent",
                            )}
                          >
                            {full ? fill(t("x415.allN"), { n: group.campaigns.length }) : r ? fill(t("x415.nOfM"), { n: r.inCount, m: r.ofCount }) : t("x422.newToGroup")}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {picked.length === 0
                    ? t("x422.pickHint")
                    : picked.length === 1 && row
                      ? fill(t("x415.alreadyIn"), { n: row.inCount, m: row.ofCount })
                      : picked.length === 1
                        ? fill(t("x415.inNone"), { m: group.campaigns.length })
                        : fill(t("x422.pickedN"), { n: picked.length })}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-[11px] font-medium">{t("x415.phoneNumber")}</div>
                  <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="+1 (888) 000-0000" className="h-9 font-mono" />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-medium">{t("x415.buyer")}</div>
                  <Select value={newBuyer} onValueChange={setNewBuyer}>
                    <SelectTrigger className="h-9 w-full"><SelectValue placeholder={t("x415.pickBuyer")} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {[...buyers]
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                        .map((b) => (
                          <SelectItem key={b.id} value={b.id}>{localName(b.name)}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="text-[11px] font-medium">{t("x415.destName")}</div>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={buyerName && key.length === 10 ? `${buyerName}|${key.slice(-4)}` : ""} className="h-9" />
                </div>
              </div>
            )}
          </Step>

          <Step n={++n} title={t("x415.whichCampaigns")}>
            <div className="space-y-2">
              <label className={cn("block cursor-pointer rounded-lg border p-3", scope === "all" ? "border-accent bg-accent/10" : "border-border")}>
                <span className="flex items-start gap-2.5">
                  <input type="radio" className="mt-0.5" checked={scope === "all"} onChange={() => setScope("all")} />
                  <span>
                    <span className="block text-sm font-medium">{fill(t("x415.allCampaignsIn"), { n: group.campaigns.length })}</span>
                    <span className="text-[11px] text-muted-foreground">{t("x415.allCampaignsHint")}</span>
                  </span>
                </span>
              </label>
              <label className={cn("block cursor-pointer rounded-lg border p-3", scope === "some" ? "border-accent bg-accent/10" : "border-border")}>
                <span className="flex items-start gap-2.5">
                  <input type="radio" className="mt-0.5" checked={scope === "some"} onChange={() => setScope("some")} />
                  <span className="text-sm font-medium">{t("x415.onlySome")}</span>
                </span>
                {scope === "some" && (
                  <span className="mt-2 flex flex-wrap gap-1.5 pl-6">
                    {group.campaigns.map((c) => {
                      const has = already.has(c.id);
                      const on = has || some.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={has}
                          title={has ? t("x415.alreadyThere") : undefined}
                          onClick={() =>
                            setSome((s) => {
                              const next = new Set(s);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            })
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                            on ? "border-accent/50 bg-accent/10" : "border-border text-muted-foreground",
                            has && "opacity-60",
                          )}
                        >
                          <span className={cn("flex h-3 w-3 items-center justify-center rounded-sm border", on ? "border-accent bg-accent" : "border-muted-foreground/50")} />
                          {localName(c.name)}
                        </button>
                      );
                    })}
                  </span>
                )}
              </label>
            </div>
          </Step>

          <Step n={++n} title={t("x415.routing")}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-medium">{t("cg.col.priority")}</div>
                <Input type="number" min={1} value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 font-mono" />
                <p className="text-[11px] text-muted-foreground">{t("x415.priorityHint")}</p>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-medium">{t("cg.col.weight")}</div>
                <Input type="number" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} className="h-9 font-mono" />
                <p className="text-[11px] text-muted-foreground">{t("x415.weightHint")}</p>
              </div>
            </div>
            <p className="flex gap-2 rounded-lg border border-accent/20 bg-accent/5 p-2.5 text-[11px] text-muted-foreground">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-accent" />
              <span>
                {share.others
                  ? fill(t("x415.shareText"), { p, n: share.others, w, pct: share.pct })
                  : fill(t("x415.shareAlone"), { p })}
              </span>
            </p>
          </Step>

          {source === "existing" && newOnes.length > 0 && (
            <Step n={++n} title={t("x415.billing")} aside={t("x422.billingEach")}>
              <div className="space-y-2">
                {newOnes.map((x, i) => {
                  const b = bills[x.d.id] ?? EMPTY_BILL;
                  return (
                    <div key={x.d.id} className="grid grid-cols-[minmax(0,1fr)_6rem_9rem] items-center gap-2">
                      <span className="truncate text-xs">
                        <span className="font-semibold">{localName(x.d.buyerName ?? "")}</span>{" "}
                        <span className="font-mono tabular-nums text-muted-foreground">{formatUs(x.d.tfn)}</span>
                      </span>
                      <Input type="number" min={0} step="0.01" value={b.rate} onChange={(e) => setBill(x.d.id, { rate: e.target.value })} placeholder={t("cg.apply.rate")} className="h-8 font-mono" />
                      <div className="flex gap-1">
                        <Select value={b.convertOn || undefined} onValueChange={(v) => setBill(x.d.id, { convertOn: v as ConvertOn })}>
                          <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder={t("cg.apply.convertOn")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="incoming">{t("cg.apply.incoming")}</SelectItem>
                            <SelectItem value="connected">{t("cg.apply.connected")}</SelectItem>
                            <SelectItem value="length">{t("cg.apply.length")}</SelectItem>
                          </SelectContent>
                        </Select>
                        {b.convertOn === "length" && (
                          <Input type="number" min={1} value={b.seconds} onChange={(e) => setBill(x.d.id, { seconds: e.target.value })} placeholder={t("cg.apply.secondsShort")} className="h-8 w-16 font-mono" />
                        )}
                      </div>
                      {i === 0 && newOnes.length > 1 && (
                        <button type="button" onClick={copyFirstBill} className="col-span-3 justify-self-start text-[11px] text-accent hover:underline">
                          {t("cg.apply.copyFirst")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Step>
          )}

          {needsBilling && (
            <Step n={++n} title={t("x415.billing")} aside={t("x415.billingAside")}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-medium">{t("cg.apply.rate")}</div>
                  <Input type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" className="h-9 font-mono" />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-medium">{t("cg.apply.convertOn")}</div>
                  <Select value={convertOn || undefined} onValueChange={(v) => setConvertOn(v as ConvertOn)}>
                    <SelectTrigger className="h-9 w-full"><SelectValue placeholder={t("cg.apply.pick")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incoming">{t("cg.apply.incoming")}</SelectItem>
                      <SelectItem value="connected">{t("cg.apply.connected")}</SelectItem>
                      <SelectItem value="length">{t("cg.apply.length")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {convertOn === "length" && (
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium">{t("cg.apply.seconds")}</div>
                    <Input type="number" min={1} value={seconds} onChange={(e) => setSeconds(e.target.value)} className="h-9 font-mono" />
                  </div>
                )}
              </div>
            </Step>
          )}

          <Step n={++n} title={t("x415.limitsTitle")} aside={t("x415.emptyNoLimit")}>
            {source === "existing" && pickedDests.length > 1 ? (
              <p className="text-xs text-muted-foreground">{t("x422.limitsMany")}</p>
            ) : source === "existing" && !dest ? (
              <p className="text-xs text-muted-foreground">{t("x415.pickFirst")}</p>
            ) : (
              <>
                <LimitsFields value={limits} onChange={setLimits} />
                <p className="text-[11px] text-muted-foreground">
                  {t("x415.limitsEvery")} {fill(t("x415.capsCount"), { tz: tzLabel(dest?.timezone) })}
                </p>
              </>
            )}
          </Step>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          <span className="text-[11px] text-muted-foreground">
            {source === "existing"
              ? adding.length > 1
                ? fill(t("x422.addsMany"), { d: adding.length, r: rowsAdded })
                : adding.length === 1
                  ? fill(t("x415.addsTo"), { name: localName(adding[0].d.buyerName ?? "") || formatUs(adding[0].d.tfn), n: adding[0].targets.length })
                  : ""
              : targets.length > 0 && (buyerName || key.length === 10)
                ? fill(t("x415.addsTo"), { name: localName(buyerName) || formatUs(number), n: targets.length })
                : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>{t("cg.cancel")}</Button>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => void save()} disabled={busy || !valid}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{" "}
              {source === "existing" && adding.length > 1 ? fill(t("x422.addN"), { n: adding.length }) : t("x408.addDestination")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

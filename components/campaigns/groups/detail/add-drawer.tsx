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
 */

import { useEffect, useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [destId, setDestId] = useState("");
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
    setDestId("");
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

  const dest = useMemo(() => destinations.find((d) => d.id === destId) ?? null, [destinations, destId]);
  useEffect(() => setLimits(limitsOf(dest)), [dest]);

  const number = source === "existing" ? dest?.tfn ?? "" : toE164(newNumber);
  const key = digits10(number);
  const row = useMemo(() => (key.length === 10 ? rows.find((r) => r.digits === key) ?? null : null), [rows, key]);
  const already = new Set(row?.line.campaigns.map((c) => c.campaignId) ?? []);
  const targets = group.campaigns.filter((c) => !already.has(c.id) && (scope === "all" || some.has(c.id)));
  const needsBilling = !row;
  const buyerName =
    source === "existing" ? dest?.buyerName ?? "" : buyers.find((b) => b.id === newBuyer)?.name ?? "";

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return [...destinations]
      .filter((d) => !q || (d.buyerName ?? "").toLowerCase().includes(q) || d.name.toLowerCase().includes(q) || (qd && digits10(d.tfn).includes(qd)))
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || (a.buyerName ?? "").localeCompare(b.buyerName ?? "", undefined, { numeric: true }));
  }, [destinations, search]);

  const p = toInt(priority) ?? 1;
  const w = toInt(weight) ?? 100;
  const share = shareAt(rows, p, w, key);

  const valid =
    key.length === 10 &&
    targets.length > 0 &&
    (source === "existing" ? !!dest : !!newBuyer && (newName.trim().length >= 2 || !!buyerName)) &&
    (!needsBilling || (rate.trim() !== "" && Number(rate) >= 0 && !!convertOn && (convertOn !== "length" || (toInt(seconds) ?? 0) > 0)));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      let buyerId = source === "existing" ? dest?.buyerId || undefined : newBuyer;
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
      if (source === "existing" && dest) {
        const patch = limitsPatch(limitsOf(dest), limits);
        if (Object.keys(patch).length) await updateDest(dest.id, patch);
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
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="text-lg">{t("x408.addDestination")}</SheetTitle>
          <SheetDescription className="text-xs">{fill(t("x415.addSub"), { group: group.name })}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <Step n={++n} title={t("x415.whichDestination")}>
            <div className="grid grid-cols-2 rounded-lg border border-border p-0.5 text-xs">
              {(["existing", "new"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSource(s)} className={cn("rounded-md py-1.5", source === s ? "bg-muted font-medium" : "text-muted-foreground")}>
                  {s === "existing" ? t("x415.existingDest") : t("x415.newNumber")}
                </button>
              ))}
            </div>
            {source === "existing" ? (
              <div className="space-y-2">
                <div className="text-[11px] font-medium">{t("cg.col.destination")}</div>
                <Select value={destId} onValueChange={setDestId}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder={t("x415.pickDestination")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <div className="p-1.5">
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder={t("x415.search")} className="h-8 text-xs" />
                    </div>
                    {pool.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded border border-border px-1 text-[10px] font-semibold">{localName(d.buyerName ?? "")}</span>
                          <span className="font-mono text-xs tabular-nums">{formatUs(d.tfn)}</span>
                          {!d.enabled && <span className="text-[10px] text-muted-foreground">{t("cg.status.paused")}</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dest && (
                  <p className="text-[11px] text-muted-foreground">
                    {row
                      ? fill(t("x415.alreadyIn"), { n: row.inCount, m: row.ofCount })
                      : fill(t("x415.inNone"), { m: group.campaigns.length })}
                  </p>
                )}
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
            {source === "existing" && !dest ? (
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
            {targets.length > 0 && (buyerName || key.length === 10)
              ? fill(t("x415.addsTo"), { name: localName(buyerName) || formatUs(number), n: targets.length })
              : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>{t("cg.cancel")}</Button>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => void save()} disabled={busy || !valid}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t("x408.addDestination")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

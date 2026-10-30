"use client";

/**
 * CH-328: one destination change - add, remove, or a new priority / weight -
 * made in every campaign of the ticked groups at once (Sir, 28 Oct: "If the
 * team increases the priority of Destination 1 in Groups A, B and C, that
 * change is automatically applied to every campaign under those groups").
 *
 * The server does it in one transaction: every campaign or none. After it,
 * the dialog lists each campaign and what happened there.
 *
 * CH-353 (Sir, 29 Oct: "under Destination give check box to add bulk"):
 * tick several destinations and change them all at once. When adding, each
 * picked destination has its own Rate and Convert ON - every buyer pays its
 * own rate - and Priority / Weight are shared.
 */

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MinusCircle, PlusCircle, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  campaignGroups,
  type ApplyResult,
  type CampaignGroup,
  type GroupAction,
  type GroupLine,
} from "@/lib/api/services/campaign-groups.service";
import { toE164 } from "@/lib/format";
import { useLocalName, LocalName } from "@/lib/i18n/local-name";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { fill, useResultDetail } from "./shared";

export interface ApplyStart {
  action: GroupAction;
  number?: string;
  groupIds?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CampaignGroup[];
  linesByGroup: Record<string, GroupLine[]>;
  start: ApplyStart;
  onApplied: () => void;
}

const key10 = (n: string) => n.replace(/\D/g, "").slice(-10);

type ConvertOn = "" | "incoming" | "connected" | "length";

/** Rate and Convert ON of one picked destination (Add only). */
interface Billing {
  rate: string;
  convertOn: ConvertOn;
  seconds: string;
}

const NO_BILLING: Billing = { rate: "", convertOn: "", seconds: "" };

interface Option {
  /** The number's last 10 digits, or digits|buyer when the number is on several buyers (CH-392). */
  key: string;
  /** The number's last 10 digits. */
  num10: string;
  number: string;
  name: string;
  buyerId?: string;
  buyerName: string;
}

export function ApplyChangeDialog({ open, onOpenChange, groups, linesByGroup, start, onApplied }: Props) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const detailText = useResultDetail();
  const destinations = useDestinationsStore((s) => s.destinations);
  const fetchDestinations = useDestinationsStore((s) => s.fetch);

  const [action, setAction] = useState<GroupAction>("update");
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);        // key10 of each ticked number, in tick order
  const [billing, setBilling] = useState<Record<string, Billing>>({});
  const [priority, setPriority] = useState("");
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");
  const [convertOn, setConvertOn] = useState<ConvertOn>("");
  const [seconds, setSeconds] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setAction(start.action);
    setGroupIds(new Set(start.groupIds ?? []));
    setQuery("");
    setPicked(start.number ? [key10(start.number)] : []);
    setBilling({});
    setPriority(start.action === "add" ? "1" : "");
    setWeight(start.action === "add" ? "100" : "");
    setRate("");
    setConvertOn("");
    setSeconds("");
    setResult(null);
    void fetchDestinations();
  }, [open, start, fetchDestinations]);

  useEffect(() => {
    // Defaults that fit the action: an added line needs a priority and weight.
    if (action === "add") {
      setPriority((p) => p || "1");
      setWeight((w) => w || "100");
    }
  }, [action]);

  // Every number the team can pick: the Destinations page, plus anything
  // already routed in the groups (an old line with no Destination row).
  const options = useMemo<Option[]>(() => {
    // One TFN can be on several buyers (CH-392): then each buyer is its own
    // line to pick, so the team chooses which buyer the campaigns pay.
    const buyersOf = new Map<string, Set<string>>();
    for (const d of destinations) {
      const k = key10(d.tfn);
      if (k.length !== 10) continue;
      if (!buyersOf.has(k)) buyersOf.set(k, new Set());
      buyersOf.get(k)!.add(d.buyerId || "");
    }
    const m = new Map<string, Option>();
    const numbers = new Set<string>();
    // Live destinations first, so a buyer's live line names the option.
    for (const d of [...destinations].sort((a, b) => Number(b.enabled) - Number(a.enabled))) {
      const k = key10(d.tfn);
      if (k.length !== 10) continue;
      const key = (buyersOf.get(k)?.size ?? 0) > 1 ? `${k}|${d.buyerId || ""}` : k;
      if (!m.has(key)) {
        m.set(key, { key, num10: k, number: toE164(d.tfn), name: d.name, buyerId: d.buyerId || undefined, buyerName: d.buyerName ?? "" });
        numbers.add(k);
      }
    }
    for (const lines of Object.values(linesByGroup)) {
      for (const l of lines) {
        const k = key10(l.number);
        if (!numbers.has(k)) {
          m.set(k, { key: k, num10: k, number: l.number, name: "", buyerId: l.buyerId ?? undefined, buyerName: l.buyerName });
          numbers.add(k);
        }
      }
    }
    return [...m.values()].sort((a, b) => a.buyerName.localeCompare(b.buyerName) || a.number.localeCompare(b.number));
  }, [destinations, linesByGroup]);

  // CH-383 (Sir, 29 Oct: "Once a TFN is added in the group it should not
  // come in the list"): when adding, a destination already in every campaign
  // of each ticked group is left out of the list - adding it again would
  // only duplicate it. One missing from some campaigns still shows (adding
  // fills the gaps). A destination opened from its own row stays.
  const fullyIn = useMemo(() => {
    const out = new Set<string>();
    if (action !== "add" || groupIds.size === 0) return out;
    const counts = new Map<string, number>();
    for (const gid of groupIds) {
      for (const l of linesByGroup[gid] ?? []) {
        if (l.missingIn.length === 0) {
          const k = key10(l.number);
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
    }
    for (const [k, n] of counts) if (n === groupIds.size) out.add(k);
    return out;
  }, [action, groupIds, linesByGroup]);

  // Change / remove: only the destinations that are in the ticked groups -
  // a number the group does not have cannot be changed or removed there.
  const inGroups = useMemo(() => {
    if (action === "add" || groupIds.size === 0) return null;
    const out = new Set<string>();
    for (const gid of groupIds) for (const l of linesByGroup[gid] ?? []) out.add(key10(l.number));
    return out;
  }, [action, groupIds, linesByGroup]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const own = start.number ? key10(start.number) : "";
    const listed = options.filter(
      (o) => o.num10 === own || (!fullyIn.has(o.num10) && (!inGroups || inGroups.has(o.num10))),
    );
    if (!q) return listed;
    return listed.filter(
      (o) => o.number.includes(q.replace(/\D/g, "") || q) || o.name.toLowerCase().includes(q) || o.buyerName.toLowerCase().includes(q),
    );
  }, [options, query, fullyIn, inGroups, start.number]);

  const chosenGroups = groups.filter((g) => groupIds.has(g.id));
  const campaignCount = chosenGroups.reduce((n, g) => n + g.campaigns.filter((c) => c.status !== "archived").length, 0);
  const byKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);
  // Opened from a row, the tick is the bare number; when that number is on
  // several buyers (CH-392) it becomes the first of its lines.
  useEffect(() => {
    setPicked((prev) => {
      let changed = false;
      const next = prev.map((k) => {
        if (byKey.has(k)) return k;
        const o = options.find((x) => x.num10 === k);
        if (!o) return k;
        changed = true;
        return o.key;
      });
      return changed ? [...new Set(next)] : prev;
    });
  }, [byKey, options]);
  // A tick on a destination that is already in the whole group (CH-383) is not
  // sent: adding it there again would only duplicate it.
  const chosen = picked
    .map((k) => byKey.get(k))
    .filter((o): o is Option => Boolean(o))
    .filter((o) => action !== "add" || !fullyIn.has(o.num10));
  const pickedSet = new Set(picked);

  const togglePick = (k: string) =>
    setPicked((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const allShownPicked = shown.length > 0 && shown.every((o) => pickedSet.has(o.key));
  const toggleAllShown = () =>
    setPicked((prev) => {
      if (allShownPicked) return prev.filter((k) => !shown.some((o) => o.key === k));
      const next = [...prev];
      for (const o of shown) if (!next.includes(o.key)) next.push(o.key);
      return next;
    });

  const bill = (k: string) => billing[k] ?? NO_BILLING;
  const setBill = (k: string, patch: Partial<Billing>) =>
    setBilling((prev) => ({ ...prev, [k]: { ...(prev[k] ?? NO_BILLING), ...patch } }));
  /** The first picked destination's Rate and Convert ON, copied to the rest. */
  const copyFirstToAll = () => {
    const first = chosen[0] ? bill(chosen[0].key) : NO_BILLING;
    setBilling((prev) => {
      const next = { ...prev };
      for (const o of chosen) next[o.key] = { ...first };
      return next;
    });
  };

  const rateOf = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const secs = (v: string) => Math.floor(Number(v) || 0);
  const rateValue = rateOf(rate);
  const secondsValue = secs(seconds);
  const num = (v: string) => (v.trim() === "" ? undefined : Math.floor(Number(v)));
  const billOk = (b: Billing) => {
    const r = rateOf(b.rate);
    return r !== undefined && Number.isFinite(r) && r >= 0 && b.convertOn !== "" && (b.convertOn !== "length" || secs(b.seconds) > 0);
  };
  const missingBilling = action === "add" ? chosen.filter((o) => !billOk(bill(o.key))) : [];
  const updateHasSomething =
    action !== "update" || [priority, weight, rate].some((v) => v.trim() !== "") || convertOn !== "";
  const ready = chosenGroups.length > 0 && campaignCount > 0 && chosen.length > 0 && missingBilling.length === 0 && !busy;

  const allGroups = groups.length > 0 && groups.every((g) => groupIds.has(g.id));
  const toggleGroup = (id: string) =>
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** "Done: 2 of 3 campaigns changed", or for several destinations
   *  "Done: 6 changes - 2 destinations in 3 campaigns" (CH-353). */
  const doneText = (r: ApplyResult) =>
    (r.numbers?.length ?? 1) > 1
      ? fill(t("cg.apply.doneMany"), { changed: r.changed, d: r.numbers!.length, n: r.campaigns })
      : fill(t("cg.apply.done"), { changed: r.changed, n: r.campaigns });

  const submit = async () => {
    if (!ready) return;
    if (!updateHasSomething) {
      toast.error(t("cg.apply.nothing"));
      return;
    }
    setBusy(true);
    try {
      // Every ticked destination in one request: all or nothing (CH-353).
      const res = await campaignGroups.apply({
        groupIds: [...groupIds],
        action,
        number: chosen[0].number,
        numbers: chosen.map((o) => {
          if (action !== "add") return { number: o.number };
          const b = bill(o.key);
          return {
            number: o.number,
            buyerId: o.buyerId,
            revenue: rateOf(b.rate),
            convertOn: b.convertOn || undefined,
            convertSeconds: b.convertOn === "length" ? secs(b.seconds) : undefined,
          };
        }),
        priority: action === "remove" ? undefined : num(priority),
        weight: action === "remove" ? undefined : num(weight),
        revenue: action === "update" ? rateValue : undefined,
        convertOn: action === "update" && convertOn ? convertOn : undefined,
        convertSeconds: action === "update" && convertOn === "length" ? secondsValue : undefined,
      });
      setResult(res);
      toast.success(doneText(res));
      // A server without CH-353 reads only the first number: say so plainly.
      if (chosen.length > 1 && !res.numbers) toast.warning(fill(t("cg.apply.onlyFirst"), { number: chosen[0].number }));
      onApplied();
    } catch (e) {
      toast.error(t("cg.apply.failed"), { description: friendlyErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const ACTIONS: { id: GroupAction; label: string; Icon: typeof PlusCircle }[] = [
    { id: "add", label: t("cg.apply.add"), Icon: PlusCircle },
    { id: "update", label: t("cg.apply.update"), Icon: SlidersHorizontal },
    { id: "remove", label: t("cg.apply.remove"), Icon: MinusCircle },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("cg.apply.title")}</DialogTitle>
          <DialogDescription>{t("cg.apply.desc")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {doneText(result)}
            </p>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
              {result.results.map((r) => (
                <div
                  key={`${r.number ?? ""}-${r.campaignId}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  {result.results.some((x) => x.number !== result.results[0].number) && r.number && (
                    <span className="font-mono text-xs tabular-nums">{r.number}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium">{localName(r.campaignName)}</span>
                  <span className="text-xs text-muted-foreground">{r.group}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      r.result === "unchanged" ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {t(`cg.result.${r.result}`)}
                  </span>
                  {r.detail && <span className="basis-full text-xs text-muted-foreground">{detailText(r.detail)}</span>}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResult(null)}>{t("cg.apply.again")}</Button>
              <Button onClick={() => onOpenChange(false)}>{t("cg.apply.close")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("cg.apply.what")}</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {ACTIONS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAction(id)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      action === id ? "border-accent bg-accent/10 font-medium" : "hover:bg-muted/50"
                    }`}
                    aria-pressed={action === id}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{t("cg.apply.groups")}</Label>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <Checkbox
                    checked={allGroups}
                    onCheckedChange={() => setGroupIds(allGroups ? new Set() : new Set(groups.map((g) => g.id)))}
                  />
                  {t("cg.apply.allGroups")}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => (
                  <label
                    key={g.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                      groupIds.has(g.id) ? "border-accent bg-accent/10" : ""
                    }`}
                  >
                    <Checkbox checked={groupIds.has(g.id)} onCheckedChange={() => toggleGroup(g.id)} />
                    <span className="font-medium"><LocalName name={g.name} /></span>
                    <span className="text-xs text-muted-foreground">
                      {g.campaigns.length === 1 ? t("cg.campaignsCountOne") : fill(t("cg.campaignsCount"), { n: g.campaigns.length })}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium">
                  {t("cg.apply.destination")}
                  {chosen.length > 0 && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      {fill(t("cg.apply.pickedCount"), { n: chosen.length })}
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-3 text-xs">
                  {chosen.length > 0 && (
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setPicked([])}>
                      {t("cg.apply.clearPicked")}
                    </button>
                  )}
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox checked={allShownPicked} onCheckedChange={toggleAllShown} disabled={shown.length === 0} />
                    {t("cg.apply.allShown")}
                  </label>
                </div>
              </div>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("cg.apply.searchDest")} />
              {/* CH-397 (Sir, 29 Oct: "Destination box more large"): about 11
                  rows instead of 5, never more than half the screen. */}
              <div className="max-h-[min(28rem,50vh)] min-h-48 overflow-y-auto rounded-md border">
                {shown.length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted-foreground">{t("cg.apply.noDest")}</p>
                ) : (
                  shown.map((o) => (
                    <label
                      key={o.key}
                      className={`flex w-full cursor-pointer items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 ${
                        pickedSet.has(o.key) ? "bg-accent/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox checked={pickedSet.has(o.key)} onCheckedChange={() => togglePick(o.key)} />
                      <span className="font-mono tabular-nums">{o.number}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {[o.buyerName && localName(o.buyerName), o.name && localName(o.name)].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {action !== "remove" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField id="cg-pri" label={t("cg.apply.priority")} value={priority} onChange={setPriority}
                               placeholder={action === "update" ? t("cg.apply.keep") : "1"} min={1} />
                  <NumberField id="cg-wt" label={t("cg.apply.weight")} value={weight} onChange={setWeight}
                               placeholder={action === "update" ? t("cg.apply.keep") : "100"} min={0} />
                  {action === "update" && (
                    <>
                      <NumberField id="cg-rate" label={t("cg.apply.rate")} value={rate} onChange={setRate}
                                   placeholder={t("cg.apply.keep")} min={0} step="0.01" prefix="$" />
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t("cg.apply.convertOn")}</Label>
                        <ConvertSelect value={convertOn} onChange={setConvertOn} placeholder={t("cg.apply.keep")} />
                      </div>
                      {convertOn === "length" && (
                        <NumberField id="cg-sec" label={t("cg.apply.seconds")} value={seconds} onChange={setSeconds} required min={1} placeholder="60" />
                      )}
                    </>
                  )}
                </div>
                {action === "add" && chosen.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-medium">
                        {t("cg.apply.perDest")} <span className="text-destructive">*</span>
                      </Label>
                      {chosen.length > 1 && (
                        <button type="button" className="text-xs text-accent hover:underline" onClick={copyFirstToAll}>
                          {t("cg.apply.copyFirst")}
                        </button>
                      )}
                    </div>
                    <div className="divide-y rounded-md border">
                      {chosen.map((o) => {
                        const b = bill(o.key);
                        const bad = !billOk(b);
                        return (
                          <div key={o.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                            <div className="min-w-[150px] flex-1">
                              <div className="font-mono text-sm tabular-nums">{o.number}</div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {[o.buyerName && localName(o.buyerName), o.name && localName(o.name)].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                            <div className="relative w-[110px]">
                              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={b.rate}
                                onChange={(e) => setBill(o.key, { rate: e.target.value })}
                                placeholder={t("cg.apply.rate")}
                                aria-label={`${t("cg.apply.rate")} ${o.number}`}
                                className={`h-9 pl-6 font-mono tabular-nums ${bad && b.rate.trim() === "" ? "border-destructive/60" : ""}`}
                              />
                            </div>
                            <div className="w-[160px]">
                              <ConvertSelect
                                value={b.convertOn}
                                onChange={(v) => setBill(o.key, { convertOn: v })}
                                placeholder={t("cg.apply.convertOn")}
                              />
                            </div>
                            {b.convertOn === "length" && (
                              <Input
                                type="number"
                                min={1}
                                value={b.seconds}
                                onChange={(e) => setBill(o.key, { seconds: e.target.value })}
                                placeholder={t("cg.apply.secondsShort")}
                                aria-label={`${t("cg.apply.seconds")} ${o.number}`}
                                className="h-9 w-[90px] font-mono tabular-nums"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => togglePick(o.key)}
                              className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={t("cg.apply.unpick")}
                              title={t("cg.apply.unpick")}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {action === "add" ? t("cg.apply.billingNote") : t("cg.apply.updateNote")}
                </p>
              </div>
            )}

            {chosenGroups.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {chosen.length > 1 && `${fill(t("cg.apply.summaryDest"), { d: chosen.length })} `}
                {fill(campaignCount === 1 ? t("cg.apply.summaryOne") : t("cg.apply.summary"), {
                  n: campaignCount,
                  groups: chosenGroups.map((g) => g.name).join(", "),
                })}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t("cg.cancel")}
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={!ready}
                variant={action === "remove" ? "destructive" : "default"}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {campaignCount === 1 ? t("cg.apply.goOne") : fill(t("cg.apply.go"), { n: campaignCount })}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConvertSelect({
  value,
  onChange,
  placeholder,
}: {
  value: ConvertOn;
  onChange: (v: ConvertOn) => void;
  placeholder: string;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value || undefined} onValueChange={(v) => onChange(v as ConvertOn)}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="incoming">{t("cg.apply.incoming")}</SelectItem>
        <SelectItem value="connected">{t("cg.apply.connected")}</SelectItem>
        <SelectItem value="length">{t("cg.apply.length")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  min,
  step,
  prefix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: string;
  prefix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>
        )}
        <Input
          id={id}
          type="number"
          min={min}
          step={step ?? "1"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`font-mono tabular-nums ${prefix ? "pl-6" : ""}`}
        />
      </div>
    </div>
  );
}

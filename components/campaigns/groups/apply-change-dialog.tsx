"use client";

/**
 * CH-328: one destination change - add, remove, or a new priority / weight -
 * made in every campaign of the ticked groups at once (Sir, 28 Oct: "If the
 * team increases the priority of Destination 1 in Groups A, B and C, that
 * change is automatically applied to every campaign under those groups").
 *
 * The server does it in one transaction: every campaign or none. After it,
 * the dialog lists each campaign and what happened there.
 */

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MinusCircle, PlusCircle, SlidersHorizontal } from "lucide-react";
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
import { useLocalName } from "@/lib/i18n/local-name";
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

interface Option {
  key: string;
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
  const [picked, setPicked] = useState<string>("");          // key10 of the number
  const [priority, setPriority] = useState("");
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");
  const [convertOn, setConvertOn] = useState<"" | "incoming" | "connected" | "length">("");
  const [seconds, setSeconds] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setAction(start.action);
    setGroupIds(new Set(start.groupIds ?? []));
    setQuery("");
    setPicked(start.number ? key10(start.number) : "");
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
    const m = new Map<string, Option>();
    for (const d of destinations) {
      const k = key10(d.tfn);
      if (k.length === 10 && !m.has(k)) {
        m.set(k, { key: k, number: toE164(d.tfn), name: d.name, buyerId: d.buyerId || undefined, buyerName: d.buyerName ?? "" });
      }
    }
    for (const lines of Object.values(linesByGroup)) {
      for (const l of lines) {
        const k = key10(l.number);
        if (!m.has(k)) m.set(k, { key: k, number: l.number, name: "", buyerId: l.buyerId ?? undefined, buyerName: l.buyerName });
      }
    }
    return [...m.values()].sort((a, b) => a.buyerName.localeCompare(b.buyerName) || a.number.localeCompare(b.number));
  }, [destinations, linesByGroup]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.number.includes(q.replace(/\D/g, "") || q) || o.name.toLowerCase().includes(q) || o.buyerName.toLowerCase().includes(q),
    );
  }, [options, query]);

  const chosenGroups = groups.filter((g) => groupIds.has(g.id));
  const campaignCount = chosenGroups.reduce((n, g) => n + g.campaigns.filter((c) => c.status !== "archived").length, 0);
  const option = options.find((o) => o.key === picked);

  const rateValue = rate.trim() === "" ? undefined : Number(rate);
  const secondsValue = Math.floor(Number(seconds) || 0);
  const num = (v: string) => (v.trim() === "" ? undefined : Math.floor(Number(v)));
  const billingOk =
    action !== "add" ||
    (rateValue !== undefined && Number.isFinite(rateValue) && rateValue >= 0 && convertOn !== "" &&
      (convertOn !== "length" || secondsValue > 0));
  const updateHasSomething =
    action !== "update" || [priority, weight, rate].some((v) => v.trim() !== "") || convertOn !== "";
  const ready = chosenGroups.length > 0 && campaignCount > 0 && Boolean(option) && billingOk && !busy;

  const allGroups = groups.length > 0 && groups.every((g) => groupIds.has(g.id));
  const toggleGroup = (id: string) =>
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (!ready || !option) return;
    if (!updateHasSomething) {
      toast.error(t("cg.apply.nothing"));
      return;
    }
    setBusy(true);
    try {
      const res = await campaignGroups.apply({
        groupIds: [...groupIds],
        action,
        number: option.number,
        buyerId: action === "add" ? option.buyerId : undefined,
        priority: action === "remove" ? undefined : num(priority),
        weight: action === "remove" ? undefined : num(weight),
        revenue: action === "remove" ? undefined : rateValue,
        convertOn: action === "remove" || !convertOn ? undefined : convertOn,
        convertSeconds: convertOn === "length" ? secondsValue : undefined,
      });
      setResult(res);
      toast.success(fill(t("cg.apply.done"), { changed: res.changed, n: res.campaigns }));
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
              {fill(t("cg.apply.done"), { changed: result.changed, n: result.campaigns })}
            </p>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border">
              {result.results.map((r) => (
                <div key={r.campaignId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-sm last:border-b-0">
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
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.campaigns.length === 1 ? t("cg.campaignsCountOne") : fill(t("cg.campaignsCount"), { n: g.campaigns.length })}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("cg.apply.destination")}</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("cg.apply.searchDest")} />
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {shown.length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted-foreground">{t("cg.apply.noDest")}</p>
                ) : (
                  shown.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setPicked(o.key)}
                      className={`flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 ${
                        picked === o.key ? "bg-accent/10" : "hover:bg-muted/50"
                      }`}
                      aria-pressed={picked === o.key}
                    >
                      <span className="font-mono tabular-nums">{o.number}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {[o.buyerName && localName(o.buyerName), o.name && localName(o.name)].filter(Boolean).join(" · ")}
                      </span>
                    </button>
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
                  <NumberField id="cg-rate" label={t("cg.apply.rate")} value={rate} onChange={setRate} required={action === "add"}
                               placeholder={action === "update" ? t("cg.apply.keep") : "0.00"} min={0} step="0.01" prefix="$" />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      {t("cg.apply.convertOn")} {action === "add" && <span className="text-destructive">*</span>}
                    </Label>
                    <Select value={convertOn || undefined} onValueChange={(v) => setConvertOn(v as typeof convertOn)}>
                      <SelectTrigger>
                        <SelectValue placeholder={action === "update" ? t("cg.apply.keep") : t("cg.apply.pick")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incoming">{t("cg.apply.incoming")}</SelectItem>
                        <SelectItem value="connected">{t("cg.apply.connected")}</SelectItem>
                        <SelectItem value="length">{t("cg.apply.length")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {convertOn === "length" && (
                    <NumberField id="cg-sec" label={t("cg.apply.seconds")} value={seconds} onChange={setSeconds} required min={1} placeholder="60" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {action === "add" ? t("cg.apply.billingNote") : t("cg.apply.updateNote")}
                </p>
              </div>
            )}

            {chosenGroups.length > 0 && (
              <p className="text-sm text-muted-foreground">
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

"use client";

/**
 * Attach a destination to a campaign, from the campaign's own page.
 *
 * The "+ Add" button beside ROUTED DESTINATIONS used to call
 * `toast.info("Attach destination — coming soon")`. It sat directly under the
 * line "No destinations routed to this campaign yet", which is exactly where
 * someone goes to fix that, so the one obvious path was a dead end and the
 * only real route was a different page entirely.
 *
 * A campaign with no routing rule drops every call it receives with
 * "No matching rule found" — the carrier test on C-11 failed six times for
 * this reason while the carrier itself was working. So this creates the rule
 * when the campaign has none, rather than asking the user to go and make one.
 *
 * Every destination is offered (switched-off ones are marked "Off" and can
 * be switched on from the table afterwards), numbers already routed to the
 * campaign are left out, and "Select all" picks everything in the list, so
 * the team can route all their destinations in one go.
 *
 * Billing is mandatory, as on Revo (Sir, 24 Oct: "give mandate while adding
 * destination in campaign"): after picking, a Conversion Settings step asks
 * for the Rate and Convert ON (Incoming Call / Call Connected / Call Length
 * with its seconds). Nothing is added until both are filled in; they apply to
 * every destination picked, and each can be changed later with its pencil.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Target } from "lucide-react";
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
import { routingService } from "@/lib/api/services/routing.service";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { toE164 } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

interface Props {
  campaignId: string;
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful attach so the parent can refetch its rows. */
  onAttached?: () => void;
  /** Numbers (E.164) already routed to this campaign - not offered again. */
  excludeNumbers?: ReadonlySet<string>;
  /** Priority for the first new destination (after the existing ones). */
  startPriority?: number;
}

export function AttachDestinationDialog({
  campaignId,
  campaignName,
  open,
  onOpenChange,
  onAttached,
  excludeNumbers,
  startPriority = 1,
}: Props) {
  const { t } = useTranslation();
  const destinations = useDestinationsStore((s) => s.destinations);
  const fetchDestinations = useDestinationsStore((s) => s.fetch);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  // Step 2: Conversion Settings - required before anything is added (CH-248).
  const [step, setStep] = useState<"pick" | "billing">("pick");
  const [rate, setRate] = useState("");
  const [convertOn, setConvertOn] = useState<"" | "incoming" | "connected" | "length">("");
  const [seconds, setSeconds] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(new Set());
    setStep("pick");
    setRate("");
    setConvertOn("");
    setSeconds("");
    void fetchDestinations();
  }, [open, fetchDestinations]);

  const rateValue = rate.trim() === "" ? NaN : Number(rate);
  const secondsValue = Math.floor(Number(seconds) || 0);
  const billingReady =
    Number.isFinite(rateValue) && rateValue >= 0 && convertOn !== "" &&
    (convertOn !== "length" || secondsValue > 0);

  // Every destination not already routed here, switched-on ones first. A
  // switched-off one can be routed too; it takes calls once it is switched on.
  const available = useMemo(
    () =>
      destinations
        .filter((d) => !excludeNumbers?.has(toE164(d.tfn)))
        .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)),
    [destinations, excludeNumbers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (d) =>
        d.tfn.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.buyerName ?? "").toLowerCase().includes(q),
    );
  }, [available, query]);

  const allShownSelected = filtered.length > 0 && filtered.every((d) => selected.has(d.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) for (const d of filtered) next.delete(d.id);
      else for (const d of filtered) next.add(d.id);
      return next;
    });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSubmit = async () => {
    if (selected.size === 0 || !billingReady) return;
    setSubmitting(true);
    try {
      // Reuse the campaign's rule when it has one; a second rule would add a
      // competing set of destinations rather than extending this one.
      // The live (active) rule first - the router ignores paused / draft ones,
      // so destinations added there would never take a call.
      const rules = await routingService.listRules({ campaignId, pageSize: 50 });
      let ruleId = (rules.items.find((r) => r.status === "active") ?? rules.items[0])?.id;

      if (!ruleId) {
        const created = await routingService.createRule({
          name: `${campaignName} routing`,
          ruleType: "priority",
          campaignId,
          priority: 1,
        });
        ruleId = created.id;
      }

      const chosen = available.filter((d) => selected.has(d.id));
      const attached: string[] = [];
      try {
        // Sequential so a failure half way names what already landed.
        let priority = startPriority;
        for (const d of chosen) {
          await routingService.addDestination(ruleId, {
            destination: toE164(d.tfn),
            buyerId: d.buyerId || undefined,
            priority: priority++,
            revenue: rateValue,
            convertOn: convertOn || undefined,
            convertSeconds: convertOn === "length" ? secondsValue : 0,
          });
          attached.push(d.tfn);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("y.attDest.failed"), {
          description: attached.length
            ? t("y.attDest.partial").replace("{done}", String(attached.length)).replace("{total}", String(chosen.length)).replace("{numbers}", attached.join(", "))
            : t("y.attDest.nothing"),
        });
        return;
      }

      toast.success(
        attached.length === 1
          ? t("y.attDest.routedOne")
          : t("y.attDest.routedMany").replace("{count}", String(attached.length)),
        { description: t("y.attDest.routedHint").replace("{campaign}", campaignName) },
      );
      onAttached?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.attDest.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("y.attDest.title")}</DialogTitle>
              <DialogDescription>
                {t("y.attDest.description").split("{campaign}")[0]}
                <span className="font-medium text-foreground">{campaignName}</span>
                {t("y.attDest.description").split("{campaign}")[1]}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "billing" ? (
          <div className="mx-auto w-full max-w-md space-y-5 py-2">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wider">{t("y.attDest.billing.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("y.attDest.billing.desc").replace("{count}", String(selected.size))}
              </p>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <Label htmlFor="att-rate" className="text-xs font-medium">
                  {t("trafficUI.campaigns.settings.forward.conversion.rate")} <span className="text-destructive">*</span>
                </Label>
                <p className="text-[11px] text-muted-foreground">{t("y.fwd.conv.rateHint")}</p>
              </div>
              <div className="relative w-28">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  id="att-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0.00"
                  className="pl-6 text-right font-mono tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t("trafficUI.campaigns.settings.forward.conversion.convertOn")} <span className="text-destructive">*</span>
              </Label>
              <Select value={convertOn || undefined} onValueChange={(v) => setConvertOn(v as typeof convertOn)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("y.attDest.billing.pick")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">{t("trafficUI.campaigns.settings.forward.conversion.events.incomingCall")}</SelectItem>
                  <SelectItem value="connected">{t("trafficUI.campaigns.settings.forward.conversion.events.callConnected")}</SelectItem>
                  <SelectItem value="length">{t("trafficUI.campaigns.settings.forward.conversion.events.callLength")}</SelectItem>
                </SelectContent>
              </Select>
              {convertOn && (
                <p className="text-[11px] text-muted-foreground">
                  {t(`y.fwd.conv.hint.${convertOn}`)}
                </p>
              )}
            </div>
            {convertOn === "length" && (
              <div className="flex items-end justify-between gap-3">
                <div>
                  <Label htmlFor="att-sec" className="text-xs font-medium">
                    {t("trafficUI.campaigns.settings.forward.conversion.length")} <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t("trafficUI.campaigns.settings.forward.conversion.lengthHint")}
                  </p>
                </div>
                <div className="relative w-28">
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("trafficUI.common.sec")}
                  </span>
                  <Input
                    id="att-sec"
                    type="number"
                    min={1}
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value)}
                    placeholder="60"
                    className="pr-10 text-right font-mono tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
        <>
        <div className="flex items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("y.attDest.search")}
            className="h-10 flex-1 text-sm"
          />
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allShownSelected}
              disabled={filtered.length === 0}
              onCheckedChange={toggleAll}
              aria-label={t("y.attDest.selectAll")}
            />
            {t("y.attDest.selectAllCount").replace("{count}", String(filtered.length))}
          </label>
        </div>

        <div className="min-h-[300px] flex-1 overflow-y-auto rounded-md border sm:min-h-[460px]">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {available.length === 0
                ? destinations.length === 0
                  ? t("y.attDest.noneYet")
                  : t("y.attDest.allRouted")
                : t("y.attDest.noMatch")}
            </p>
          ) : (
            filtered.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.has(d.id)}
                  onCheckedChange={() => toggle(d.id)}
                />
                <span className="flex-1 text-sm">
                  <span className="font-medium">{toE164(d.tfn)}</span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {d.name}
                    {d.buyerName ? ` · ${d.buyerName}` : ""}
                  </span>
                </span>
                {!d.enabled && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("y.attDest.off")}
                  </span>
                )}
              </label>
            ))
          )}
        </div>
        </>
        )}

        <DialogFooter>
          {step === "billing" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep("pick")} disabled={submitting}>
                {t("y.attDest.billing.back")}
              </Button>
              <Button size="sm" onClick={onSubmit} disabled={submitting || !billingReady}>
                {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {selected.size === 1
                  ? t("y.attDest.routeOne")
                  : t("y.attDest.routeMany").replace("{count}", String(selected.size))}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {t("y.common.cancel")}
              </Button>
              {/* Billing comes next and is required (CH-248). */}
              <Button size="sm" onClick={() => setStep("billing")} disabled={selected.size === 0}>
                {selected.size === 0 ? t("y.attDest.routeNone") : t("y.attDest.billing.next")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
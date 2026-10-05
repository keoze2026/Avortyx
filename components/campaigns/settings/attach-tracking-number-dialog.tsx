"use client";

import { useEffect, useMemo, useState } from "react";
import { Hash, Loader2, Plus, Search } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { numbersService } from "@/lib/api/services/numbers.service";
import { toE164 } from "@/lib/format";
import type { NumberType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "add" | "buy";

// Used by the "Buy new" mode to generate plausible candidate numbers.
// Mirrors ProvisionNumberDialog's STATE_OPTIONS so demo behavior is consistent.
const STATE_OPTIONS = [
  { code: "TX", city: "Austin", area: 512 },
  { code: "CA", city: "Los Angeles", area: 213 },
  { code: "FL", city: "Miami", area: 305 },
  { code: "NY", city: "New York", area: 212 },
  { code: "IL", city: "Chicago", area: 312 },
  { code: "GA", city: "Atlanta", area: 404 },
];

/* randomLocalNumber and randomTollfree used to live here. They invented an
 * E.164 string from Math.random() and "Buy" imported it into the backend as a
 * live tracking number attached to the campaign, with a hardcoded monthly
 * cost. Nothing was ever bought from the carrier, so the campaign was wired to
 * a number no call could arrive on - and it looked correctly configured.
 *
 * Numbers now come from the carrier's own inventory via
 * numbersService.phoneNumberSearch, and are bought with the exact string the
 * search returned. phoneNumberPurchase says it outright: the number "must be
 * the exact E.164 string from the search result - never a client-generated
 * value." */

export function AttachTrackingNumberDialog({ campaignId, open, onOpenChange }: Props) {
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const campaign = campaigns.find((c) => c.id === campaignId);
  const allNumbers = useNumbersStore((s) => s.numbers);
  const updateNumber = useNumbersStore((s) => s.updateNumber);
  const provisionNumber = useNumbersStore((s) => s.provisionNumber);

  const [mode, setMode] = useState<Mode>("add");

  // ─── "Add existing" state ─────────────────────────────────────────────
  // Only numbers that aren't already linked to a campaign are eligible —
  // each tracking number routes for exactly one campaign at a time.
  const available = useMemo(
    () => (allNumbers ?? []).filter((n) => !n.campaignId),
    [allNumbers],
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (n) =>
        n.number.toLowerCase().includes(q) ||
        (n.label ?? "").toLowerCase().includes(q) ||
        (n.city ?? "").toLowerCase().includes(q),
    );
  }, [available, query]);

  // ─── "Buy new" state ──────────────────────────────────────────────────
  const [buyType, setBuyType] = useState<NumberType>("tollfree");
  const [buyRegion, setBuyRegion] = useState(STATE_OPTIONS[0].code);
  const [buyCount, setBuyCount] = useState(1);

  /* Numbers already owned, free, and of the type being asked for.
   *
   * Buying from the carrier while unattached numbers sit idle costs money for
   * nothing - ten toll-free numbers were imported from a new carrier and the
   * Buy tab would still have gone out and bought more. These are spent first
   * and only the shortfall is purchased. */
  const bucket = useMemo(
    () => available.filter((n) => n.type === buyType),
    [available, buyType],
  );
  const fromBucket = Math.min(buyCount, bucket.length);
  const toPurchase = Math.max(0, buyCount - bucket.length);

  const [submitting, setSubmitting] = useState(false);

  // Reset transient form state whenever the dialog re-opens so a previous
  // pick doesn't leak across sessions.
  useEffect(() => {
    if (!open) return;
    setMode("add");
    setQuery("");
    setSelected(new Set());
    setBuyType("tollfree");
    setBuyRegion(STATE_OPTIONS[0].code);
    setBuyCount(1);
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((n) => n.id)));
  };

  const onSubmitAdd = async () => {
    if (!campaign || selected.size === 0) return;
    setSubmitting(true);
    try {
      // Attach each picked number in parallel — each call PATCHes the
      // tracking number with this campaign's id.
      await Promise.all(
        Array.from(selected).map((id) =>
          updateNumber(id, { campaignId: campaign.id, campaignName: campaign.name }),
        ),
      );
      toast.success(
        selected.size === 1
          ? "1 tracking number attached"
          : `${selected.size} tracking numbers attached`,
        { description: `Routing to "${campaign.name}".` },
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not attach numbers");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitBuy = async () => {
    if (!campaign) return;
    setSubmitting(true);
    const region = STATE_OPTIONS.find((s) => s.code === buyRegion) ?? STATE_OPTIONS[0];
    const numberType = buyType === "tollfree" ? "toll_free" : "local";
    try {
      // Spend what is already owned before buying anything.
      const taken = bucket.slice(0, fromBucket);
      for (const n of taken) {
        await updateNumber(n.id, { campaignId: campaign.id, campaignName: campaign.name });
      }

      if (toPurchase === 0) {
        toast.success(
          taken.length === 1
            ? "1 number attached from your pool"
            : `${taken.length} numbers attached from your pool`,
          { description: `Attached to "${campaign.name}". Nothing was purchased.` },
        );
        onOpenChange(false);
        return;
      }

      // Ask the carrier what is actually for sale. Toll-free has no area code.
      const available = await numbersService.phoneNumberSearch({
        numberType,
        countryCode: "US",
        limit: toPurchase,
        areaCode: buyType === "tollfree" ? undefined : String(region.area),
      });

      // Stop rather than buy a partial batch. Quietly provisioning 2 of 5 and
      // reporting success is how a campaign ends up short of the numbers
      // somebody thinks it has. Anything already taken from the pool is named,
      // because that part did happen.
      if (available.length < toPurchase) {
        toast.error(
          available.length === 0
            ? "The carrier has no numbers available for that selection"
            : `Only ${available.length} of ${toPurchase} numbers are available to buy`,
          {
            description: taken.length
              ? `${taken.length} attached from your pool. Nothing was purchased.`
              : "Nothing was purchased. Try a different area or a smaller count.",
          },
        );
        return;
      }

      // Sequential, not Promise.all: each one is a real purchase against the
      // carrier, and a partial failure must leave a knowable state.
      const bought: string[] = [];
      try {
        for (const candidate of available.slice(0, toPurchase)) {
          await provisionNumber({
            // Verbatim from the search result, never reformatted.
            phoneNumber: candidate.phoneNumber,
            numberType,
            campaignId: campaign.id,
            campaignName: campaign.name,
          });
          bought.push(candidate.phoneNumber);
        }
      } catch (e) {
        // Say exactly how far it got. The numbers already bought are real and
        // billable, and pretending otherwise leaves them unaccounted for.
        toast.error(e instanceof Error ? e.message : "Could not purchase number", {
          description: bought.length
            ? `${bought.length} of ${toPurchase} were purchased and attached: ${bought.join(", ")}`
            : "No numbers were purchased.",
        });
        return;
      }

      const total = taken.length + bought.length;
      toast.success(
        total === 1 ? "1 number attached" : `${total} numbers attached`,
        {
          description: taken.length
            ? `${taken.length} from your pool, ${bought.length} purchased. Attached to "${campaign.name}".`
            : `Attached to "${campaign.name}".`,
        },
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not purchase number");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Hash className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>Add Tracking Number</DialogTitle>
              <DialogDescription>
                Toll-free or local numbers that land calls for{" "}
                <span className="font-medium text-foreground">{campaign?.name ?? "this campaign"}</span>{" "}
                and forward them to the routed destinations below.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Mode toggle — Add (existing inventory) vs Buy (new from carrier) */}
        <div className="inline-flex w-full rounded-md border border-border bg-muted p-0.5">
          {(["add", "buy"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "add" ? "Add existing number" : "Buy a new number"}
            </button>
          ))}
        </div>

        {mode === "add" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by number, name, or city"
                className="pl-8 text-xs"
              />
            </div>

            {available.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                <Hash className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-xs font-medium">No unassigned numbers in inventory</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Switch to <span className="font-medium text-foreground">Buy a new number</span>{" "}
                  above to purchase one.
                </p>
              </div>
            ) : (
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 pl-3">
                        <Checkbox
                          checked={
                            filtered.length > 0 && selected.size === filtered.length
                          }
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Number
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Type
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Name
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">
                        Region
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                          No matches for &ldquo;{query}&rdquo;
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((n) => (
                        <TableRow
                          key={n.id}
                          className="cursor-pointer"
                          onClick={() => toggle(n.id)}
                          data-state={selected.has(n.id) ? "selected" : undefined}
                        >
                          <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(n.id)}
                              onCheckedChange={() => toggle(n.id)}
                              aria-label={`Select ${toE164(n.number)}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {toE164(n.number)}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {n.type === "tollfree" ? "Toll-free" : n.type}
                          </TableCell>
                          <TableCell className="text-xs">{n.label ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {n.city ? `${n.city}, ${n.state ?? ""}` : n.state ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={onSubmitAdd}
                disabled={submitting || selected.size === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Attaching…
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />{" "}
                    {selected.size > 0
                      ? `Attach ${selected.size} number${selected.size === 1 ? "" : "s"}`
                      : "Attach"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Number type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["tollfree", "local"] as NumberType[]).map((nt) => (
                  <button
                    key={nt}
                    type="button"
                    onClick={() => setBuyType(nt)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      buyType === nt
                        ? "border-accent bg-accent/10"
                        : "border-border bg-secondary/30 hover:border-border/80",
                    )}
                  >
                    <div className="text-sm font-medium">
                      {nt === "tollfree" ? "Toll-free" : "Local"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {nt === "tollfree"
                        ? "8xx prefix — best for national campaigns."
                        : "Geo-targeted area code."}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {buyType === "local" && (
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={buyRegion} onValueChange={setBuyRegion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATE_OPTIONS.map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {o.city}, {o.code} · ({o.area})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="buy-count">How many</Label>
              <Input
                id="buy-count"
                type="number"
                min={1}
                max={20}
                value={buyCount}
                onChange={(e) =>
                  setBuyCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))
                }
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Up to 20 per batch.
                {bucket.length > 0 && (
                  <>
                    {" "}
                    You already own {bucket.length} free{" "}
                    {buyType === "tollfree" ? "toll-free" : "local"}{" "}
                    {bucket.length === 1 ? "number" : "numbers"} —{" "}
                    {toPurchase === 0
                      ? `all ${fromBucket} will come from those, nothing will be bought.`
                      : `${fromBucket} will come from those and ${toPurchase} will be bought.`}
                  </>
                )}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={onSubmitBuy} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Purchasing…
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />{" "}
                    {buyCount > 1 ? `Buy ${buyCount} numbers & attach` : "Buy & attach"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

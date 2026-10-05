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
import type { NumberType, TrackingNumber } from "@/lib/types";
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
  const [typeFilter, setTypeFilter] = useState<"all" | NumberType>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (!q) return true;
      return (
        n.number.toLowerCase().includes(q) ||
        (n.label ?? "").toLowerCase().includes(q) ||
        (n.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [available, query, typeFilter]);

  // ─── "Buy new" state ──────────────────────────────────────────────────
  const [buyType, setBuyType] = useState<NumberType>("tollfree");
  const [buyRegion, setBuyRegion] = useState(STATE_OPTIONS[0].code);
  const [buyCount, setBuyCount] = useState(1);

  const [submitting, setSubmitting] = useState(false);

  // Reset transient form state whenever the dialog re-opens so a previous
  // pick doesn't leak across sessions.
  useEffect(() => {
    if (!open) return;
    setMode("add");
    setQuery("");
    setTypeFilter("all");
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

  const allShownSelected = filtered.length > 0 && filtered.every((n) => selected.has(n.id));
  const someShownSelected = filtered.some((n) => selected.has(n.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) filtered.forEach((n) => next.delete(n.id));
      else filtered.forEach((n) => next.add(n.id));
      return next;
    });
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
      // Ask the carrier what is actually for sale. Toll-free has no area code.
      const available = await numbersService.phoneNumberSearch({
        numberType,
        countryCode: "US",
        limit: buyCount,
        areaCode: buyType === "tollfree" ? undefined : String(region.area),
      });

      // Stop rather than buy a partial batch. Quietly provisioning 2 of 5 and
      // reporting success is how a campaign ends up short of the numbers
      // somebody thinks it has.
      if (available.length < buyCount) {
        toast.error(
          available.length === 0
            ? "The carrier has no numbers available for that selection"
            : `Only ${available.length} of ${buyCount} numbers are available`,
          { description: "Nothing was purchased. Try a different area or a smaller count." },
        );
        return;
      }

      // Sequential, not Promise.all: each one is a real purchase against the
      // carrier, and a partial failure must leave a knowable state.
      const bought: string[] = [];
      try {
        for (const candidate of available.slice(0, buyCount)) {
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
            ? `${bought.length} of ${buyCount} were purchased and attached: ${bought.join(", ")}`
            : "No numbers were purchased.",
        });
        return;
      }

      toast.success(
        bought.length === 1 ? "1 number purchased" : `${bought.length} numbers purchased`,
        { description: `Attached to "${campaign.name}".` },
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
      {/* Large window: room for dozens of numbers at once, so several can be
          picked and added to the campaign in one go. */}
      <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col gap-4 sm:max-w-5xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Hash className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="uppercase tracking-wide">Add numbers</DialogTitle>
              <DialogDescription>
                Pick one or more numbers for{" "}
                <span className="font-medium text-foreground">{campaign?.name ?? "this campaign"}</span>
                {" "}— calls to them forward to the routed destinations.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Add existing numbers / Buy new numbers */}
        <div className="inline-flex w-full rounded-md border border-border bg-muted p-0.5 sm:w-auto sm:self-start">
          {(["add", "buy"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded px-4 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "add" ? "Add existing numbers" : "Buy new numbers"}
            </button>
          ))}
        </div>

        {mode === "add" ? (
          <>
            {/* Search · type filter · count */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by number, name or city"
                  className="pl-8 text-xs"
                />
              </div>
              <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                {([
                  ["all", "All"],
                  ["tollfree", "Toll-free"],
                  ["local", "Local"],
                ] as Array<["all" | NumberType, string]>).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTypeFilter(v)}
                    className={cn(
                      "rounded px-3 py-1 text-xs font-medium transition-colors",
                      typeFilter === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                {filtered.length} of {available.length} available
              </span>
            </div>

            {available.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
                <Hash className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No unassigned numbers in inventory</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Switch to <span className="font-medium text-foreground">Buy new numbers</span> above to purchase some.
                </p>
              </div>
            ) : (
              <div className="min-h-[240px] flex-1 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={allShownSelected || (someShownSelected && "indeterminate")}
                          onCheckedChange={toggleAll}
                          aria-label="Select all shown numbers"
                        />
                      </TableHead>
                      <TableHead className="text-left text-[11px] uppercase tracking-wider">Number</TableHead>
                      <TableHead className="text-left text-[11px] uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Region</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="py-10 text-center text-xs text-muted-foreground">
                          No numbers match your search.
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
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(n.id)}
                              onCheckedChange={() => toggle(n.id)}
                              aria-label={`Select ${toE164(n.number)}`}
                            />
                          </TableCell>
                          <TableCell className="text-left text-xs font-medium tabular-nums whitespace-nowrap">
                            {toE164(n.number)}
                          </TableCell>
                          <TableCell className="text-left text-xs font-medium">{n.label ?? "—"}</TableCell>
                          <TableCell className="text-xs font-medium">
                            {n.type === "tollfree" ? "Toll-free" : "Local"}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {n.city ? `${n.city}, ${n.state ?? ""}` : n.state ?? "—"}
                          </TableCell>
                          <TableCell>
                            <NumberStatusPill status={n.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter className="items-center sm:justify-between">
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {selected.size === 0
                  ? "Tick one or more numbers to add them"
                  : `${selected.size} number${selected.size === 1 ? "" : "s"} selected`}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={onSubmitAdd} disabled={submitting || selected.size === 0}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />{" "}
                      {selected.size > 0
                        ? `Add ${selected.size} number${selected.size === 1 ? "" : "s"}`
                        : "Add"}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <div className="mx-auto w-full max-w-xl space-y-4 overflow-auto">
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
                    <div className="text-sm font-medium">{nt === "tollfree" ? "Toll-free" : "Local"}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {nt === "tollfree" ? "8xx prefix — best for national campaigns." : "Geo-targeted area code."}
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
                onChange={(e) => setBuyCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="tabular-nums"
              />
              <p className="text-[10px] text-muted-foreground">Up to 20 per batch.</p>
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
                    {buyCount > 1 ? `Buy ${buyCount} numbers & add` : "Buy & add"}
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

/** Active / Paused / Pending / Expired as a small coloured pill. */
function NumberStatusPill({ status }: { status: TrackingNumber["status"] }) {
  const tone =
    status === "active"
      ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
      : status === "paused"
        ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
        : status === "expired"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex min-w-[4.5rem] justify-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize", tone)}>
      {status}
    </span>
  );
}
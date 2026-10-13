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
import { routingService } from "@/lib/api/services/routing.service";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { toE164 } from "@/lib/format";

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
  const destinations = useDestinationsStore((s) => s.destinations);
  const fetchDestinations = useDestinationsStore((s) => s.fetch);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(new Set());
    void fetchDestinations();
  }, [open, fetchDestinations]);

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
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      // Reuse the campaign's rule when it has one; a second rule would add a
      // competing set of destinations rather than extending this one.
      const rules = await routingService.listRules({ campaignId, pageSize: 1 });
      let ruleId = rules.items[0]?.id;

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
          });
          attached.push(d.tfn);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not attach destination", {
          description: attached.length
            ? `${attached.length} of ${chosen.length} were attached: ${attached.join(", ")}`
            : "Nothing was attached.",
        });
        return;
      }

      toast.success(
        attached.length === 1
          ? "1 destination routed"
          : `${attached.length} destinations routed`,
        { description: `Calls for "${campaignName}" will now be sent to them.` },
      );
      onAttached?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not attach destination");
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
              <Target className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>Route destinations</DialogTitle>
              <DialogDescription>
                Pick where calls for{" "}
                <span className="font-medium text-foreground">{campaignName}</span>{" "}
                should be sent. A campaign with no destination drops every call it
                receives.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by number, name or buyer"
            className="h-8 flex-1"
          />
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium">
            <Checkbox
              checked={allShownSelected}
              disabled={filtered.length === 0}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            Select all ({filtered.length})
          </label>
        </div>

        <div className="max-h-[320px] overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {available.length === 0
                ? destinations.length === 0
                  ? "No destinations yet. Create one under Destinations first."
                  : "Every destination is already routed to this campaign."
                : "Nothing matches that search."}
            </p>
          ) : (
            filtered.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.has(d.id)}
                  onCheckedChange={() => toggle(d.id)}
                />
                <span className="flex-1 text-xs">
                  <span className="font-medium">{toE164(d.tfn)}</span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {d.name}
                    {d.buyerName ? ` · ${d.buyerName}` : ""}
                  </span>
                </span>
                {!d.enabled && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Off
                  </span>
                )}
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={submitting || selected.size === 0}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Route {selected.size > 0 ? `${selected.size} ` : ""}
            {selected.size === 1 ? "destination" : "destinations"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

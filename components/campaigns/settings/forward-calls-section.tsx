"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Pencil, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/shared/pagination";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { campaignsService } from "@/lib/api/services/campaigns.service";
import { routingService, type RoutingDestination } from "@/lib/api/services/routing.service";
import { AttachDestinationDialog } from "./attach-destination-dialog";
import { ROUTES } from "@/lib/constants";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { formatCurrency, toE164 } from "@/lib/format";
import { cn } from "@/lib/utils";

type RoutingOption = "Standard" | "Menu" | "Call Flow" | "Revenue";
type DuplicateHandling = "Normal" | "Original" | "Different";
type DirectionScope = "Destination" | "Buyer";

const ROUTING_OPTIONS: RoutingOption[] = ["Standard", "Menu", "Call Flow", "Revenue"];
const DUPLICATE_OPTIONS: DuplicateHandling[] = ["Normal", "Original", "Different"];
const DIRECTION_OPTIONS: DirectionScope[] = ["Destination", "Buyer"];

/* ─── Per-destination conversion settings (Edit pencil modal) ───────── */

type ConvertEvent = "Call Connected" | "Call Length" | "Incoming Call" | "Webhook";
type DupeRevenue = "Disabled" | "Enabled" | "Time Limit";

const CONVERT_EVENTS: ConvertEvent[] = [
  "Call Connected",
  "Call Length",
  "Incoming Call",
  "Webhook",
];
const DUPE_REVENUE_OPTIONS: DupeRevenue[] = ["Disabled", "Enabled", "Time Limit"];

/**
 * Webhooks the operator has already configured at the workspace level.
 * In the real system this would come from a webhooks store / API; for the
 * demo we surface a stable hand-rolled list so the dropdown isn't empty.
 */
const WORKSPACE_WEBHOOKS: Array<{ id: string; name: string }> = [
  { id: "wh_lead_qualified", name: "Lead Qualified — CRM ingest" },
  { id: "wh_billing_event", name: "Billing event — Stripe" },
  { id: "wh_pubsub_main", name: "PubSub — main topic" },
  { id: "wh_slack_ops", name: "Slack — #ops-routing" },
];

interface ConversionSettings {
  rate: number;
  convertOn: ConvertEvent;
  /** Minimum call duration (seconds) — only meaningful when convertOn = Call Length. */
  lengthSec: number;
  /** Selected webhook id — only meaningful when convertOn = Webhook. */
  webhookId: string;
  dupeRevenue: DupeRevenue;
  /** Days window — only meaningful when dupeRevenue = Time Limit. */
  dupeRevenueDays: number;
  priority: number;
  weight: number;
}

interface ForwardCallsSectionProps {
  campaignId: string;
}

/** One row of ROUTED DESTINATIONS: a number this campaign really sends calls to. */
interface RoutedRow {
  /** The routing-rule destination id (priority / weight / unlink act on this). */
  id: string;
  name: string;
  tfn: string;
  buyerId: string;
  buyerName?: string;
  /** The Destination record behind the number, when there is one. */
  destId?: string;
  enabled: boolean;
}

/** Longest duplicate window offered: five years, in hours (5 × 8,760). */
const MAX_DUPLICATE_HOURS = 43800;

export function ForwardCallsSection({ campaignId }: ForwardCallsSectionProps) {
  const { t } = useTranslation();
  const updateCampaign = useCampaignsStore((s) => s.update);

  // ─── Block duplicate calls ──────────────────────────────────────────────
  // Saved on the campaign as duplicate_call_block / duplicate_call_block_hours.
  // When on, the backend drops any call from a caller ID that already called
  // this campaign within the window ("Duplicate call blocked").
  const [dupBlock, setDupBlock] = useState(false);
  const [dupHours, setDupHours] = useState("24");
  const [dupSavedHours, setDupSavedHours] = useState(24); // last value saved
  const [dupLoaded, setDupLoaded] = useState(false);
  const [dupSaving, setDupSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDupLoaded(false);
    campaignsService
      .get(campaignId)
      .then((c) => {
        if (cancelled) return;
        setDupBlock(Boolean(c.duplicateCallBlock));
        setDupHours(String(c.duplicateCallBlockHours ?? 24));
        setDupSavedHours(c.duplicateCallBlockHours ?? 24);
        setDupLoaded(true);
        // The other four controls were component state with hardcoded
        // defaults - selected, never saved, reset on every load. The boss
        // picked Different and duplicates kept forwarding because the choice
        // never left the browser tab.
        const h = (c.duplicateHandling ?? "normal");
        setDuplicate(h === "original" ? "Original" : h === "different" ? "Different" : "Normal");
        setDirection((c.duplicateDirection ?? "destination") === "buyer" ? "Buyer" : "Destination");
        setStrict(Boolean(c.duplicateStrict));
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load the duplicate call setting.");
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const saveDuplicate = async (block: boolean, hoursText: string) => {
    const hours = Math.min(MAX_DUPLICATE_HOURS, Math.max(1, Math.floor(Number(hoursText) || 24)));
    const prevBlock = dupBlock;
    const prevHours = dupHours;
    setDupBlock(block);
    setDupHours(String(hours));
    setDupSaving(true);
    try {
      await updateCampaign(campaignId, { duplicateCallBlock: block, duplicateCallBlockHours: hours });
      setDupSavedHours(hours);
      toast.success(
        block
          ? `Duplicate calls blocked — repeat callers within ${hours} hour${hours === 1 ? "" : "s"} are dropped.`
          : "Duplicate call blocking turned off.",
      );
    } catch {
      setDupBlock(prevBlock);
      setDupHours(prevHours);
      toast.error("Couldn't save the duplicate call setting. Please try again.");
    } finally {
      setDupSaving(false);
    }
  };
  const [routing, setRouting] = useState<RoutingOption>("Standard");
  // Seeded from the campaign once it loads; defaults mirror the backend's.
  const [duplicate, setDuplicate] = useState<DuplicateHandling>("Normal");
  const [direction, setDirection] = useState<DirectionScope>("Destination");
  const [strict, setStrict] = useState(false);

  const saveDuplicateHandling = async (patch: {
    duplicateHandling?: string;
    duplicateDirection?: string;
    duplicateStrict?: boolean;
  }) => {
    try {
      await updateCampaign(campaignId, patch);
      toast.success(t("trafficUI.campaigns.settings.forward.duplicateSaved"));
    } catch {
      toast.error("Couldn't save the duplicate routing setting. Please try again.");
    }
  };
  const routingLabel: Record<RoutingOption, string> = {
    Standard: t("trafficUI.campaigns.settings.forward.options.standard"),
    Menu: t("trafficUI.campaigns.settings.forward.options.menu"),
    "Call Flow": t("trafficUI.campaigns.settings.forward.options.callFlow"),
    Revenue: t("trafficUI.campaigns.settings.forward.options.revenue"),
  };
  const duplicateLabel: Record<DuplicateHandling, string> = {
    Normal: t("trafficUI.campaigns.settings.forward.options.normal"),
    Original: t("trafficUI.campaigns.settings.forward.options.original"),
    Different: t("trafficUI.campaigns.settings.forward.options.different"),
  };
  const directionLabel: Record<DirectionScope, string> = {
    Destination: t("trafficUI.campaigns.settings.forward.options.destination"),
    Buyer: t("trafficUI.campaigns.settings.forward.options.buyer"),
  };

  const allDestinations = useDestinationsStore((s) => s.destinations);
  const setEnabled = useDestinationsStore((s) => s.setEnabled);
  const buyers = useBuyersStore((s) => s.buyers);
  const buyerById = useMemo(() => new Map(buyers.map((b) => [b.id, b])), [buyers]);

  // ─── Routed destinations: the numbers this campaign's calls really go to ──
  // Read from the campaign's routing rule (the same one "+ Add" fills). This
  // table used to list every enabled destination in the account, which was
  // not where the calls went, and "+ Add" only said "coming soon".
  const campaignName = useCampaignsStore((s) => s.getById(campaignId)?.name) ?? "this campaign";
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [routed, setRouted] = useState<RoutingDestination[]>([]);
  const [routedLoaded, setRoutedLoaded] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});

  const loadRouted = useCallback(async () => {
    try {
      const rules = await routingService.listRules({ campaignId, pageSize: 1 });
      const rule = rules.items[0];
      const rows = rule ? await routingService.listDestinations(rule.id) : [];
      rows.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
      setRuleId(rule?.id ?? null);
      setRouted(rows);
      setPriorities(Object.fromEntries(rows.map((r) => [r.id, r.priority ?? 1])));
      setWeights(Object.fromEntries(rows.map((r) => [r.id, r.weight ?? 100])));
    } catch {
      toast.error("Couldn't load this campaign's routed destinations.");
    } finally {
      setRoutedLoaded(true);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadRouted();
  }, [loadRouted]);

  const destinations = useMemo<RoutedRow[]>(() => {
    const byNumber = new Map((allDestinations ?? []).map((d) => [toE164(d.tfn), d]));
    return routed.map((r) => {
      const number = r.destination ?? "";
      const dest = byNumber.get(toE164(number));
      return {
        id: r.id,
        name: dest?.name ?? toE164(number),
        tfn: number,
        buyerId: r.buyerId ?? dest?.buyerId ?? "",
        buyerName: r.buyerName ?? dest?.buyerName,
        destId: dest?.id,
        enabled: dest ? dest.enabled : true,
      };
    });
  }, [routed, allDestinations]);

  /** Save a row's Priority or Weight when the box is left. */
  const saveRow = async (rowId: string, field: "priority" | "weight") => {
    if (!ruleId) return;
    const before = routed.find((r) => r.id === rowId);
    if (!before) return;
    const old = field === "priority" ? before.priority ?? 1 : before.weight ?? 100;
    const typed = field === "priority" ? priorities[rowId] : weights[rowId];
    const value =
      field === "priority"
        ? Math.max(1, Math.floor(typed ?? old))
        : Math.max(0, Math.min(100, Math.floor(typed ?? old)));
    (field === "priority" ? setPriorities : setWeights)((p) => ({ ...p, [rowId]: value }));
    if (value === old) return;
    try {
      await routingService.updateDestination(ruleId, rowId, { [field]: value });
      setRouted((rows) =>
        rows
          .map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
          .sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1)),
      );
    } catch (e) {
      (field === "priority" ? setPriorities : setWeights)((p) => ({ ...p, [rowId]: old }));
      toast.error(e instanceof Error ? e.message : "Couldn't save the change.");
    }
  };
  // Per-destination conversion settings entered via the pencil-icon modal.
  // Survives until the user reploads — sufficient for the demo surface.
  const [conversions, setConversions] = useState<Record<string, ConversionSettings>>({});

  // Pagination for the routed-destinations table — defaults to 100 so the
  // operator sees a full block at a glance instead of paging through tiny 8-row
  // chunks. Options step up to 400 for ops teams running 200+ destinations.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const pageStart = page * pageSize;
  const pageEnd = pageStart + pageSize;
  const pagedDestinations = useMemo(
    () => destinations.slice(pageStart, pageEnd),
    [destinations, pageStart, pageEnd],
  );
  // Reset to page 0 when the underlying list shrinks (e.g. a destination is
  // detached) so we never strand the user on an empty page.
  if (page > 0 && pageStart >= destinations.length) {
    setPage(0);
  }

  // The destination currently being edited in the Conversion Settings modal.
  // `null` means the modal is closed.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingDest = editingId
    ? destinations.find((d) => d.id === editingId) ?? null
    : null;
  const editingBuyer = editingDest ? buyerById.get(editingDest.buyerId) : undefined;

  const openEdit = (id: string) => setEditingId(id);
  const closeEdit = () => setEditingId(null);

  const onConfirmConversion = (id: string, next: ConversionSettings) => {
    setConversions((prev) => ({ ...prev, [id]: next }));
    setPriorities((prev) => ({ ...prev, [id]: next.priority }));
    setWeights((prev) => ({ ...prev, [id]: next.weight }));
    if (ruleId) {
      void routingService
        .updateDestination(ruleId, id, { priority: next.priority, weight: next.weight })
        .then(() => loadRouted())
        .catch(() => toast.error("Couldn't save priority / weight."));
    }
    closeEdit();
    toast.success(t("trafficUI.campaigns.settings.forward.toast.convSaved"));
  };

  const onDetach = async (id: string, name: string) => {
    // Stops THIS campaign sending calls there. It used to switch the
    // destination off everywhere, for every campaign.
    if (!ruleId) return;
    try {
      await routingService.removeDestination(ruleId, id);
      setRouted((rows) => rows.filter((r) => r.id !== id));
      toast.success(t("trafficUI.campaigns.settings.forward.toast.detached").replace("{name}", name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the destination.");
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider">{t("trafficUI.campaigns.settings.forward.title")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("trafficUI.campaigns.settings.forward.description")}
        </p>
      </div>

      <Card className="space-y-5 p-5">
        <ChoiceRow
          label={t("trafficUI.campaigns.settings.forward.routingOption")}
          description={t("trafficUI.campaigns.settings.forward.routingOptionHint")}
          value={routing}
          options={ROUTING_OPTIONS}
          labels={routingLabel}
          onChange={setRouting}
        />
        <ChoiceRow
          label={t("trafficUI.campaigns.settings.forward.duplicateHandling")}
          description={t("trafficUI.campaigns.settings.forward.duplicateHandlingHint")}
          value={duplicate}
          options={DUPLICATE_OPTIONS}
          labels={duplicateLabel}
          onChange={(v) => {
            setDuplicate(v);
            void saveDuplicateHandling({ duplicateHandling: v.toLowerCase() });
          }}
        />
        <ChoiceRow
          label={t("trafficUI.campaigns.settings.forward.directionScope")}
          description={t("trafficUI.campaigns.settings.forward.directionScopeHint")}
          value={direction}
          options={DIRECTION_OPTIONS}
          labels={directionLabel}
          onChange={(v) => {
            setDirection(v);
            void saveDuplicateHandling({ duplicateDirection: v.toLowerCase() });
          }}
        />
        <div className="flex items-start justify-between gap-3 border-t border-border pt-4">
          <div>
            <div className="text-xs font-medium">{t("trafficUI.campaigns.settings.forward.strictMode")}</div>
            <div className="text-[11px] text-muted-foreground">{t("trafficUI.campaigns.settings.forward.strictModeHint")}</div>
          </div>
          <Switch className="data-[state=checked]:bg-accent" checked={strict} onCheckedChange={(on) => { setStrict(on); void saveDuplicateHandling({ duplicateStrict: on }); }} aria-label={t("trafficUI.campaigns.settings.forward.toggleStrict")} />
        </div>
        <div className="flex items-start justify-between gap-3 border-t border-border pt-4">
          <div>
            <div className="text-xs font-medium">Block duplicate calls</div>
            <div className="text-[11px] text-muted-foreground">
              Drop any call from a caller ID that already called this campaign within the time window.
            </div>
            {dupBlock && (
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">Block repeat callers for</span>
                <Input
                  type="number"
                  min={1}
                  max={MAX_DUPLICATE_HOURS}
                  value={dupHours}
                  disabled={!dupLoaded || dupSaving}
                  onChange={(e) => setDupHours(e.target.value)}
                  onBlur={() => {
                    // Only save when the number actually changed.
                    const next = Math.min(MAX_DUPLICATE_HOURS, Math.max(1, Math.floor(Number(dupHours) || 24)));
                    if (next !== dupSavedHours) void saveDuplicate(true, dupHours);
                    else setDupHours(String(dupSavedHours));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  aria-label="Duplicate window in hours"
                  className="h-6 w-20 px-2 text-center text-[11px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-muted-foreground">hours (up to 43,800 = 5 years)</span>
              </div>
            )}
          </div>
          <Switch
            className="data-[state=checked]:bg-accent"
            checked={dupBlock}
            disabled={!dupLoaded || dupSaving}
            onCheckedChange={(on) => void saveDuplicate(on, dupHours)}
            aria-label="Block duplicate calls"
          />
        </div>
      </Card>

      {/* Destinations priority table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("trafficUI.campaigns.settings.forward.routedDestinations")}
          </div>
          <Button size="sm" disabled={!routedLoaded} onClick={() => setAttachOpen(true)}>
            {routedLoaded ? <Plus className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}{" "}
            {t("trafficUI.common.add")}
          </Button>
        </div>
        {/* Compact density mode — shrink every cell's font + padding so a
            100-row page fits without each row chewing up vertical space.
            `[&_td]:py-1.5` + `[&_th]:py-2` overrides the table primitive's
            default py-2/py-3 padding for this single table. */}
        <Table className="[&_td]:py-1.5 [&_th]:py-2">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6 uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.priority")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.weight")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.name")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.number")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.type")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.revenue")}</TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.status")}</TableHead>
              <TableHead className="pr-6 text-center uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {destinations.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="pl-6 py-6 text-xs text-muted-foreground">
                  {routedLoaded ? t("trafficUI.campaigns.settings.forward.empty") : "Loading…"}
                </TableCell>
              </TableRow>
            ) : (
              pagedDestinations.map((d, localIndex) => {
                // Preserve the absolute row index for the default-priority
                // suggestion so paging doesn't reset the column to 1 on page 2.
                const i = pageStart + localIndex;
                const buyer = buyerById.get(d.buyerId);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="pl-6">
                      <Input
                        type="number"
                        min={1}
                        className="h-6 w-14 text-[11px]"
                        value={priorities[d.id] ?? i + 1}
                        onChange={(e) =>
                          setPriorities((p) => ({ ...p, [d.id]: Number(e.target.value) }))
                        }
                        onBlur={() => void saveRow(d.id, "priority")}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        // Wide enough for "100", centred, without the browser's
                        // up/down arrows (which took the space and cut it to "10").
                        className="h-6 w-20 px-2 text-center text-[11px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={weights[d.id] ?? 100}
                        onChange={(e) =>
                          setWeights((p) => ({ ...p, [d.id]: Number(e.target.value) }))
                        }
                        onBlur={() => void saveRow(d.id, "weight")}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={d.destId ? `${ROUTES.destinations}/${d.destId}` : ROUTES.destinations}
                        className="text-xs font-medium transition-colors hover:text-accent"
                      >
                        {d.name}
                      </Link>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {buyer?.name ?? d.buyerName ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[9.5px] font-medium tabular-nums text-foreground">
                      {toE164(d.tfn)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider",
                        )}
                      >
                        {conversions[d.id]?.convertOn ?? "Call Connected"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] tabular-nums">
                      {formatCurrency(
                        conversions[d.id]?.rate ?? buyer?.bidAmount ?? 0,
                        true,
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch className="data-[state=checked]:bg-accent"
                        checked={d.enabled}
                        disabled={!d.destId}
                        onCheckedChange={(v) => {
                          if (!d.destId) return;
                          void setEnabled(d.destId, v);
                          toast.success(
                            v
                              ? t("trafficUI.campaigns.settings.forward.row.enabled").replace("{name}", d.name)
                              : t("trafficUI.campaigns.settings.forward.row.disabled").replace("{name}", d.name),
                          );
                        }}
                        aria-label={t("trafficUI.campaigns.settings.forward.row.toggle").replace("{name}", d.name)}
                      />
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="inline-flex items-center gap-0.5">
                        <RowAction
                          icon={ExternalLink}
                          label={t("trafficUI.campaigns.settings.forward.row.open").replace("{name}", d.name)}
                          asLink={d.destId ? `${ROUTES.destinations}/${d.destId}` : ROUTES.destinations}
                        />
                        <RowAction
                          icon={Pencil}
                          label={t("trafficUI.campaigns.settings.forward.row.editConversion").replace("{name}", d.name)}
                          onClick={() => openEdit(d.id)}
                        />
                        <RowAction
                          icon={Unlink}
                          label={t("trafficUI.campaigns.settings.forward.row.detach").replace("{name}", d.name)}
                          tone="destructive"
                          onClick={() => void onDetach(d.id, d.name)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {destinations.length > 0 && (
          <div className="border-t border-border px-6 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={destinations.length}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(0);
              }}
              pageSizeOptions={[100, 200, 300, 400]}
            />
          </div>
        )}
      </Card>

      {/* "+ Add": route destinations to this campaign (all at once with Select all). */}
      <AttachDestinationDialog
        campaignId={campaignId}
        campaignName={campaignName}
        open={attachOpen}
        onOpenChange={setAttachOpen}
        excludeNumbers={new Set(routed.map((r) => toE164(r.destination ?? "")))}
        startPriority={routed.reduce((m, r) => Math.max(m, r.priority ?? 1), 0) + 1}
        onAttached={() => void loadRouted()}
      />

      {/* Conversion settings — opens when a row's pencil action is clicked. */}
      {editingDest && (
        <ConversionSettingsDialog
          open={!!editingDest}
          onOpenChange={(o) => !o && closeEdit()}
          destinationName={editingDest.name}
          initial={
            conversions[editingDest.id] ?? {
              rate: editingBuyer?.bidAmount ?? 1,
              convertOn: "Call Connected",
              lengthSec: 10,
              webhookId: "",
              dupeRevenue: "Disabled",
              dupeRevenueDays: 10,
              priority: priorities[editingDest.id] ?? 1,
              weight: weights[editingDest.id] ?? 100,
            }
          }
          onConfirm={(next) => onConfirmConversion(editingDest.id, next)}
        />
      )}
    </section>
  );
}

function ChoiceRow<T extends string>({
  label,
  description,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  description: string;
  value: T;
  options: readonly T[];
  labels?: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Label className="text-xs font-medium">{label}</Label>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
      <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === opt
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {labels?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Single icon-only action in a row's Actions cell.
 * Either renders as a Link (when `asLink` is set, for navigation actions like
 * "open detail page") or a button.
 */
function RowAction({
  icon: Icon,
  label,
  asLink,
  onClick,
  tone = "muted",
}: {
  icon: React.ElementType;
  label: string;
  asLink?: string;
  onClick?: () => void;
  tone?: "muted" | "destructive";
}) {
  const cls = cn(
    "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
    tone === "destructive"
      ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
  );

  if (asLink) {
    return (
      <Link href={asLink} aria-label={label} className={cls}>
        <Icon className="h-3.5 w-3.5" />
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Conversion Settings dialog (Edit pencil)                            */
/* ─────────────────────────────────────────────────────────────────── */

interface ConversionSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinationName: string;
  initial: ConversionSettings;
  onConfirm: (next: ConversionSettings) => void;
}

function ConversionSettingsDialog({
  open,
  onOpenChange,
  destinationName,
  initial,
  onConfirm,
}: ConversionSettingsDialogProps) {
  const { t } = useTranslation();
  // Buffered form state — discarded on cancel, written on confirm.
  const [name, setName] = useState(destinationName);
  const convertEventLabel: Record<ConvertEvent, string> = {
    "Call Connected": t("trafficUI.campaigns.settings.forward.conversion.events.callConnected"),
    "Call Length": t("trafficUI.campaigns.settings.forward.conversion.events.callLength"),
    "Incoming Call": t("trafficUI.campaigns.settings.forward.conversion.events.incomingCall"),
    Webhook: t("trafficUI.campaigns.settings.forward.conversion.events.webhook"),
  };
  const dupeLabel: Record<DupeRevenue, string> = {
    Disabled: t("trafficUI.campaigns.settings.forward.conversion.dupe.disabled"),
    Enabled: t("trafficUI.campaigns.settings.forward.conversion.dupe.enabled"),
    "Time Limit": t("trafficUI.campaigns.settings.forward.conversion.dupe.timeLimit"),
  };
  const [rate, setRate] = useState<number>(initial.rate);
  const [convertOn, setConvertOn] = useState<ConvertEvent>(initial.convertOn);
  const [lengthSec, setLengthSec] = useState<number>(initial.lengthSec);
  const [webhookId, setWebhookId] = useState<string>(initial.webhookId);
  const [dupeRevenue, setDupeRevenue] = useState<DupeRevenue>(initial.dupeRevenue);
  const [dupeRevenueDays, setDupeRevenueDays] = useState<number>(initial.dupeRevenueDays);
  const [priority, setPriority] = useState<number>(initial.priority);
  const [weight, setWeight] = useState<number>(initial.weight);

  // Reseed when a different row's pencil opens the dialog.
  // (initial / destinationName change because the parent passes new values
  // — checking destinationName keeps this cheap and avoids stale captures.)
  if (open && name === "" && destinationName !== "") setName(destinationName);

  // Webhook conversions can't be saved without a webhook picked — Call Length
  // needs a positive duration — and Time Limit needs a positive day window.
  // Gate Confirm on the active sub-field.
  const canSubmit =
    rate >= 0 &&
    (convertOn !== "Webhook" || webhookId !== "") &&
    (convertOn !== "Call Length" || lengthSec > 0) &&
    (dupeRevenue !== "Time Limit" || dupeRevenueDays > 0);

  const submit = () => {
    if (!canSubmit) return;
    onConfirm({
      rate,
      convertOn,
      lengthSec: Math.max(1, lengthSec || 1),
      webhookId,
      dupeRevenue,
      dupeRevenueDays: Math.max(1, dupeRevenueDays || 1),
      priority: Math.max(1, priority || 1),
      weight: Math.max(0, Math.min(100, weight || 0)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[13px] font-semibold uppercase tracking-wider">
            {t("trafficUI.campaigns.settings.forward.conversion.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Destination name */}
          <div className="space-y-1.5">
            <Label htmlFor="cs-name" className="text-xs font-medium">
              {t("trafficUI.campaigns.settings.forward.conversion.destName")}
            </Label>
            <Input
              id="cs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Rate */}
          <div className="space-y-1.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <Label htmlFor="cs-rate" className="text-xs font-medium">
                  {t("trafficUI.campaigns.settings.forward.conversion.rate")}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("trafficUI.campaigns.settings.forward.conversion.rateHint")}
                </p>
              </div>
              <div className="relative w-28">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id="cs-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  className="pl-6 text-right font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Convert ON */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t("trafficUI.campaigns.settings.forward.conversion.convertOn")}</Label>
            <Select value={convertOn} onValueChange={(v) => setConvertOn(v as ConvertEvent)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERT_EVENTS.map((e) => (
                  <SelectItem key={e} value={e}>
                    <span className="inline-flex items-center gap-2">
                      {convertEventLabel[e]}
                      {e === "Webhook" && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
                          {t("trafficUI.campaigns.settings.forward.conversion.beta")}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional sub-field driven by the Convert ON choice:
              - Call Length → minimum-duration input (seconds)
              - Webhook    → pick one of the workspace webhooks
              The other two events (Call Connected, Incoming Call) need no
              extra config, so nothing renders. */}
          {convertOn === "Call Length" && (
            <div className="space-y-1.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <Label htmlFor="cs-length" className="text-xs font-medium">
                    {t("trafficUI.campaigns.settings.forward.conversion.length")}
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
                    id="cs-length"
                    type="number"
                    min={1}
                    value={lengthSec}
                    onChange={(e) => setLengthSec(Number(e.target.value) || 0)}
                    className="pr-10 text-right font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {convertOn === "Webhook" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("trafficUI.campaigns.settings.forward.conversion.webhook")}</Label>
              <Select value={webhookId} onValueChange={setWebhookId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("trafficUI.campaigns.settings.forward.conversion.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {WORKSPACE_WEBHOOKS.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {webhookId === "" && (
                <p className="text-[11px] text-destructive">
                  {t("trafficUI.campaigns.settings.forward.conversion.webhookRequired")}
                </p>
              )}
            </div>
          )}

          {/* Duplicate revenue options */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t("trafficUI.campaigns.settings.forward.conversion.dupeRevenue")}</Label>
            <div className="inline-flex w-full rounded-md border border-border bg-muted p-0.5">
              {DUPE_REVENUE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDupeRevenue(opt)}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    dupeRevenue === opt
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {dupeLabel[opt]}
                </button>
              ))}
            </div>
          </div>

          {/* Time-Limit sub-field — only relevant when Time Limit is picked. */}
          {dupeRevenue === "Time Limit" && (
            <div className="space-y-1.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <Label htmlFor="cs-days" className="text-xs font-medium">
                    {t("trafficUI.campaigns.settings.forward.conversion.days")}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t("trafficUI.campaigns.settings.forward.conversion.daysHint")}
                  </p>
                </div>
                <Input
                  id="cs-days"
                  type="number"
                  min={1}
                  value={dupeRevenueDays}
                  onChange={(e) => setDupeRevenueDays(Number(e.target.value) || 0)}
                  className="w-24 text-center font-mono tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Priority + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cs-priority" className="text-xs font-medium">
                {t("trafficUI.campaigns.settings.forward.conversion.priority")}
              </Label>
              <Input
                id="cs-priority"
                type="number"
                min={1}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) || 1)}
                className="text-center font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cs-weight" className="text-xs font-medium">
                {t("trafficUI.campaigns.settings.forward.conversion.weight")}
              </Label>
              <Input
                id="cs-weight"
                type="number"
                min={0}
                max={100}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value) || 0)}
                className="text-center font-mono tabular-nums"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("trafficUI.common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>{t("trafficUI.common.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
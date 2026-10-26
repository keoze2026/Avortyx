"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Pencil, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
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
import { LiveBadge } from "@/components/campaigns/settings/live-badge";
import { liveFor, useLiveCounts } from "@/lib/use-live-counts";

type RoutingOption = "Standard" | "Menu" | "Call Flow" | "Revenue";
type DuplicateHandling = "Normal" | "Original" | "Different";
type DirectionScope = "Destination" | "Buyer";

const ROUTING_OPTIONS: RoutingOption[] = ["Standard", "Menu", "Call Flow", "Revenue"];
const DUPLICATE_OPTIONS: DuplicateHandling[] = ["Normal", "Original", "Different"];
const DIRECTION_OPTIONS: DirectionScope[] = ["Destination", "Buyer"];

/* ─── Per-destination billing (Edit pencil modal), backend CH-247 ────────
 * Each destination bills its buyer by its own rule, as on Revo: a Rate and
 * "Convert ON" - Incoming Call (every call forwarded to it, answered or not),
 * Call Connected (answered) or Call Length (answered and at least N seconds).
 * "Campaign default" keeps the campaign's revenue and rule. The Webhook and
 * duplicate-revenue options were never saved anywhere and are gone. */

type ConvertEvent = "Campaign default" | "Incoming Call" | "Call Connected" | "Call Length";
type ConvertKey = "" | "incoming" | "connected" | "length";

const CONVERT_EVENTS: ConvertEvent[] = ["Campaign default", "Incoming Call", "Call Connected", "Call Length"];
const EVENT_KEY: Record<ConvertEvent, ConvertKey> = {
  "Campaign default": "",
  "Incoming Call": "incoming",
  "Call Connected": "connected",
  "Call Length": "length",
};
const KEY_EVENT: Record<ConvertKey, ConvertEvent> = {
  "": "Campaign default",
  incoming: "Incoming Call",
  connected: "Call Connected",
  length: "Call Length",
};

interface ConversionSettings {
  /** This destination's rate; ignored for "Campaign default". */
  rate: number;
  convertOn: ConvertEvent;
  /** Minimum call duration (seconds) — only meaningful when convertOn = Call Length. */
  lengthSec: number;
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
  /** The destination's concurrency cap (0 = no cap), for the LIVE column. */
  concurrencyCap: number;
  /** Its own billing (CH-247): null rate / "" = the campaign's. */
  revenue: number | null;
  convertOn: ConvertKey;
  convertSeconds: number;
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
  const [campaignRate, setCampaignRate] = useState(0);
  const [campaignMinSec, setCampaignMinSec] = useState(0);
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
        // The campaign's own billing, shown on rows that follow it (CH-247).
        setCampaignRate(Number(c.revenue ?? 0));
        setCampaignMinSec(Number(c.qualifyDurationSec ?? 0));
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
        if (!cancelled) toast.error(t("y.fwd.dupLoadFailed"));
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
          ? t("y.fwd.dupOn").replace("{hours}", String(hours))
          : t("y.err.dupOff"),
      );
    } catch {
      setDupBlock(prevBlock);
      setDupHours(prevHours);
      toast.error(t("y.fwd.dupSaveFailed"));
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
      toast.error(t("y.fwd.dupRoutingSaveFailed"));
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
  // Calls up right now on each destination, for the LIVE column (Sir, CH-212).
  const live = useLiveCounts();
  const setEnabled = useDestinationsStore((s) => s.setEnabled);
  const setEnabledMany = useDestinationsStore((s) => s.setEnabledMany);
  const buyers = useBuyersStore((s) => s.buyers);
  const buyerById = useMemo(() => new Map(buyers.map((b) => [b.id, b])), [buyers]);

  // ─── Routed destinations: the numbers this campaign's calls really go to ──
  // Read from the campaign's routing rule (the same one "+ Add" fills). This
  // table used to list every enabled destination in the account, which was
  // not where the calls went, and "+ Add" only said "coming soon".
  const campaignName = useCampaignsStore((s) => s.getById(campaignId)?.name) ?? "this campaign";
  const [ruleId, setRuleId] = useState<string | null>(null);
  /** The rule's status: anything but "active" is skipped by the router. */
  const [ruleStatus, setRuleStatus] = useState<string | null>(null);
  const [turningOn, setTurningOn] = useState(false);
  const [routed, setRouted] = useState<RoutingDestination[]>([]);
  const [routedLoaded, setRoutedLoaded] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});

  const loadRouted = useCallback(async () => {
    try {
      // Same pick as "+ Add": the live (active) rule first.
      const rules = await routingService.listRules({ campaignId, pageSize: 50 });
      const rule = rules.items.find((r) => r.status === "active") ?? rules.items[0];
      setRuleStatus(rule?.status ?? null);
      const rows = rule ? await routingService.listDestinations(rule.id) : [];
      rows.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
      setRuleId(rule?.id ?? null);
      setRouted(rows);
      setPriorities(Object.fromEntries(rows.map((r) => [r.id, r.priority ?? 1])));
      setWeights(Object.fromEntries(rows.map((r) => [r.id, r.weight ?? 100])));
    } catch {
      toast.error(t("y.fwd.routedLoadFailed"));
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
        concurrencyCap: dest?.concurrencyCap ?? 0,
        revenue: r.revenue != null && r.revenue !== "" ? Number(r.revenue) : null,
        convertOn: ((r.convertOn as ConvertKey) || "") as ConvertKey,
        convertSeconds: r.convertSeconds ?? 0,
      };
    });
  }, [routed, allDestinations]);

  /** Switch the campaign's routing back on (a paused / draft rule drops every call). */
  const turnRoutingOn = async () => {
    if (!ruleId) return;
    setTurningOn(true);
    try {
      await routingService.updateRule(ruleId, { status: "active" });
      setRuleStatus("active");
      toast.success(t("y.fwd.routingOn"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.err.routingOn"));
    } finally {
      setTurningOn(false);
    }
  };

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
      toast.error(e instanceof Error ? e.message : t("y.err.changeSave"));
    }
  };
  // Per-destination conversion settings entered via the pencil-icon modal.
  // Survives until the user reploads — sufficient for the demo surface.

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

  const openEdit = (id: string) => setEditingId(id);
  const closeEdit = () => setEditingId(null);

  /** Saved on the server (CH-247) - it bills every call from now on. */
  const onConfirmConversion = async (id: string, next: ConversionSettings) => {
    if (!ruleId) return;
    const key = EVENT_KEY[next.convertOn];
    setPriorities((prev) => ({ ...prev, [id]: next.priority }));
    setWeights((prev) => ({ ...prev, [id]: next.weight }));
    try {
      await routingService.updateDestination(ruleId, id, {
        priority: next.priority,
        weight: next.weight,
        convertOn: key,
        convertSeconds: key === "length" ? next.lengthSec : 0,
        // "Campaign default" follows the campaign's rate too.
        revenue: key === "" ? null : next.rate,
      });
      await loadRouted();
      closeEdit();
      toast.success(t("trafficUI.campaigns.settings.forward.toast.convSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.fwd.priorityFailed"));
    }
  };

  /** TYPE column: the event this destination bills on. */
  const typeLabel = (d: RoutedRow): string => {
    if (d.convertOn === "incoming") return t("trafficUI.campaigns.settings.forward.conversion.events.incomingCall");
    if (d.convertOn === "connected") return t("trafficUI.campaigns.settings.forward.conversion.events.callConnected");
    if (d.convertOn === "length")
      return `${t("trafficUI.campaigns.settings.forward.conversion.events.callLength")} ${d.convertSeconds}s`;
    // The campaign's rule: answered, and at least its minimum duration.
    return campaignMinSec > 0
      ? `${t("trafficUI.campaigns.settings.forward.conversion.events.callLength")} ${campaignMinSec}s`
      : t("trafficUI.campaigns.settings.forward.conversion.events.callConnected");
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
      toast.error(e instanceof Error ? e.message : t("y.err.destRemove"));
    }
  };

  /* ── Bulk select (CH-273, Sir 24 Oct: "give check box if anyone wants to
     check all boxes and remove destination in bulk") - the same tick boxes and
     Play / Pause / Detach bar as the campaign's Tracking Numbers. ── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Only rows still in the list count (one may have been detached meanwhile).
  const selectedRows = destinations.filter((d) => selected.has(d.id));
  const pageIds = pagedDestinations.map((d) => d.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = !allOnPage && pageIds.some((id) => selected.has(id));
  const toggleAll = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const toggleOne = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Take the selected destinations off THIS campaign (they stay in Destinations). */
  const bulkDetach = async () => {
    if (!ruleId || bulkBusy || selectedRows.length === 0) return;
    setBulkBusy(true);
    const failed: string[] = [];
    for (const d of selectedRows) {
      try {
        await routingService.removeDestination(ruleId, d.id);
        setRouted((rows) => rows.filter((r) => r.id !== d.id));
      } catch {
        failed.push(d.id);
      }
    }
    setBulkBusy(false);
    const ok = selectedRows.length - failed.length;
    if (failed.length === 0) toast.success(t("routedBulk.detached").replace("{count}", String(ok)));
    else
      toast.error(
        t("campaignNumbers.bulk.partial")
          .replace("{ok}", String(ok))
          .replace("{total}", String(selectedRows.length))
          .replace("{failed}", String(failed.length)),
      );
    // The ones that could not be removed stay selected, so they are easy to find.
    setSelected(new Set(failed));
  };

  /** Switch the selected destinations on or off - the same as each row's switch. */
  const bulkSwitch = async (on: boolean) => {
    if (bulkBusy || selectedRows.length === 0) return;
    const withDest = selectedRows.filter((d) => d.destId);
    if (withDest.length === 0) return;
    setBulkBusy(true);
    const { ok, failed } = await setEnabledMany(
      withDest.map((d) => d.destId!),
      on,
    );
    setBulkBusy(false);
    if (failed.length === 0) {
      toast.success(
        t(on ? "routedBulk.activated" : "routedBulk.paused").replace("{count}", String(ok.length)),
      );
      setSelected(new Set());
      return;
    }
    toast.error(
      t("campaignNumbers.bulk.partial")
        .replace("{ok}", String(ok.length))
        .replace("{total}", String(withDest.length))
        .replace("{failed}", String(failed.length)),
    );
    const bad = new Set(failed.map((f) => f.id));
    setSelected(new Set(withDest.filter((d) => bad.has(d.destId!)).map((d) => d.id)));
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
            <div className="text-xs font-medium">{t("y.fwd.blockDup")}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("y.fwd.blockDupHint")}
            </div>
            {dupBlock && (
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">{t("y.fwd.blockRepeatFor")}</span>
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
                  aria-label={t("y.fwd.dupWindowAria")}
                  className="h-6 w-20 px-2 text-center text-[11px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-muted-foreground">{t("y.fwd.hoursUpTo")}</span>
              </div>
            )}
          </div>
          <Switch
            className="data-[state=checked]:bg-accent"
            checked={dupBlock}
            disabled={!dupLoaded || dupSaving}
            onCheckedChange={(on) => void saveDuplicate(on, dupHours)}
            aria-label={t("y.fwd.blockDup")}
          />
        </div>
      </Card>

      {/* Destinations priority table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("trafficUI.campaigns.settings.forward.routedDestinations")}
          </div>
          <div className="flex items-center gap-2">
            {selectedRows.length > 0 && (
              <BulkActionsBar
                count={bulkBusy ? 0 : selectedRows.length}
                onPlay={() => void bulkSwitch(true)}
                onPause={() => void bulkSwitch(false)}
                onDetach={() => void bulkDetach()}
                onClear={() => setSelected(new Set())}
                entity={t("routedBulk.entity")}
              />
            )}
            <Button size="sm" disabled={!routedLoaded} onClick={() => setAttachOpen(true)}>
              {routedLoaded ? <Plus className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}{" "}
              {t("trafficUI.common.add")}
            </Button>
          </div>
        </div>
        {/* Why calls would drop "No matching rule found", said where it can be fixed. */}
        {routedLoaded && ruleId && ruleStatus !== "active" && (
          <div className="flex flex-col gap-2 border-b border-border bg-destructive/10 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-destructive">
              {t("y.fwd.routingOff").replace("{status}", ruleStatus ?? "off")}
            </p>
            <Button size="sm" variant="destructive" disabled={turningOn} onClick={() => void turnRoutingOn()}>
              {turningOn && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t("y.fwd.turnRoutingOn")}
            </Button>
          </div>
        )}
        {routedLoaded && (!ruleId || destinations.length === 0) && (
          <div className="border-b border-border bg-destructive/10 px-6 py-3 text-xs text-destructive">
            {t("y.fwd.noDestination").split("{add}")[0]}<span className="font-semibold">+ {t("trafficUI.common.add")}</span>{t("y.fwd.noDestination").split("{add}")[1]}
          </div>
        )}
        {routedLoaded && destinations.length > 0 && destinations.every((d) => !d.enabled) && (
          <div className="border-b border-border bg-destructive/10 px-6 py-3 text-xs text-destructive">
            {t("y.fwd.allOff")}
          </div>
        )}
        {/* Compact density mode — shrink every cell's font + padding so a
            100-row page fits without each row chewing up vertical space.
            `[&_td]:py-1.5` + `[&_th]:py-2` overrides the table primitive's
            default py-2/py-3 padding for this single table. */}
        <Table className="[&_td]:py-1.5 [&_th]:py-2">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-6">
                <Checkbox
                  checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  disabled={pageIds.length === 0}
                  aria-label={t("routedBulk.selectAll")}
                />
              </TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.priority")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.weight")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.name")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.number")}</TableHead>
              <TableHead className="uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.type")}</TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.revenue")}</TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[10px]">{t("networkUI.destinations.table.live")}</TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.status")}</TableHead>
              <TableHead className="pr-6 text-center uppercase tracking-wider text-[10px]">{t("trafficUI.campaigns.settings.forward.headers.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {destinations.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10} className="pl-6 py-6 text-xs text-muted-foreground">
                  {routedLoaded ? t("trafficUI.campaigns.settings.forward.empty") : t("y.fwd.loading")}
                </TableCell>
              </TableRow>
            ) : (
              pagedDestinations.map((d, localIndex) => {
                // Preserve the absolute row index for the default-priority
                // suggestion so paging doesn't reset the column to 1 on page 2.
                const i = pageStart + localIndex;
                const buyer = buyerById.get(d.buyerId);
                return (
                  <TableRow key={d.id} data-state={selected.has(d.id) ? "selected" : undefined}>
                    <TableCell className="w-10 pl-6">
                      <Checkbox
                        checked={selected.has(d.id)}
                        onCheckedChange={(v) => toggleOne(d.id, v === true)}
                        aria-label={t("routedBulk.selectRow").replace("{name}", d.name)}
                      />
                    </TableCell>
                    <TableCell>
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
                        {typeLabel(d)}
                      </span>
                    </TableCell>
                    {/* Centred under REVENUE like the other columns (it was right-aligned). */}
                    <TableCell className="text-center font-mono text-[11px] tabular-nums">
                      {/* Its own rate, else the campaign's (CH-247). It showed the
                          buyer's bid, which bills nothing. */}
                      {formatCurrency(d.revenue ?? campaignRate, true)}
                    </TableCell>
                    {/* LIVE: calls up now / the destination's concurrency cap,
                        as on the Destinations page and in Revo. */}
                    <TableCell className="text-center">
                      <LiveBadge
                        live={liveFor(live.destinations, d.tfn)}
                        cap={d.concurrencyCap}
                        loaded={live.loaded}
                      />
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
          campaignRate={campaignRate}
          initial={
            {
              rate: editingDest.revenue ?? campaignRate,
              convertOn: KEY_EVENT[editingDest.convertOn],
              lengthSec: editingDest.convertSeconds || 60,
              priority: priorities[editingDest.id] ?? 1,
              weight: weights[editingDest.id] ?? 100,
            }
          }
          onConfirm={(next) => void onConfirmConversion(editingDest.id, next)}
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
  /** Shown when the row follows the campaign. */
  campaignRate: number;
  initial: ConversionSettings;
  onConfirm: (next: ConversionSettings) => void;
}

function ConversionSettingsDialog({
  open,
  onOpenChange,
  destinationName,
  campaignRate,
  initial,
  onConfirm,
}: ConversionSettingsDialogProps) {
  const { t } = useTranslation();
  const convertEventLabel: Record<ConvertEvent, string> = {
    "Campaign default": t("y.fwd.conv.campaignDefault"),
    "Call Connected": t("trafficUI.campaigns.settings.forward.conversion.events.callConnected"),
    "Call Length": t("trafficUI.campaigns.settings.forward.conversion.events.callLength"),
    "Incoming Call": t("trafficUI.campaigns.settings.forward.conversion.events.incomingCall"),
  };
  const convertHint: Record<ConvertEvent, string> = {
    "Campaign default": t("y.fwd.conv.hint.campaign"),
    "Incoming Call": t("y.fwd.conv.hint.incoming"),
    "Call Connected": t("y.fwd.conv.hint.connected"),
    "Call Length": t("y.fwd.conv.hint.length"),
  };
  // Buffered form state — discarded on cancel, written on confirm.
  const [rate, setRate] = useState<number>(initial.rate);
  const [convertOn, setConvertOn] = useState<ConvertEvent>(initial.convertOn);
  const [lengthSec, setLengthSec] = useState<number>(initial.lengthSec);
  const [priority, setPriority] = useState<number>(initial.priority);
  const [weight, setWeight] = useState<number>(initial.weight);
  const followsCampaign = convertOn === "Campaign default";

  // Call Length needs a positive duration.
  const canSubmit = rate >= 0 && (convertOn !== "Call Length" || lengthSec > 0);

  const submit = () => {
    if (!canSubmit) return;
    onConfirm({
      rate: followsCampaign ? campaignRate : rate,
      convertOn,
      lengthSec: Math.max(1, lengthSec || 1),
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
          <p className="text-xs text-muted-foreground">{destinationName}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rate */}
          <div className="space-y-1.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <Label htmlFor="cs-rate" className="text-xs font-medium">
                  {t("trafficUI.campaigns.settings.forward.conversion.rate")}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {followsCampaign ? t("y.fwd.conv.rateCampaign") : t("y.fwd.conv.rateHint")}
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
                  value={followsCampaign ? campaignRate : rate}
                  disabled={followsCampaign}
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
                    {convertEventLabel[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{convertHint[convertOn]}</p>
          </div>

          {/* Call Length → minimum duration (seconds). */}
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
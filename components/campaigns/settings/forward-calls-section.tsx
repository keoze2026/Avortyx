"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, GitFork, Loader2, Pencil, Plus, Unlink } from "lucide-react";
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
import { AttachDestinationDialog } from "./attach-destination-dialog";

// Fallback local definitions for the routing API so this screen can compile in
// environments where the backend module is not present yet.
type Distribution = "priority" | "weighted" | "round_robin";
type RuleSummary = {
  id: string;
  name?: string;
  ruleType?: string | null;
  campaignId?: string;
};
type RoutedDestination = {
  id: string;
  number: string;
  buyerId?: string;
  buyerName?: string;
  priority: number;
  weight: number;
};

const SIMPLE_TYPES: Distribution[] = ["priority", "weighted", "round_robin"];

const campaignRouting = {
  listRules: async (_campaignId: string): Promise<RuleSummary[]> => [],
  pickSimple: (rules: RuleSummary[]): RuleSummary | null =>
    rules.find((rule) => SIMPLE_TYPES.includes((rule.ruleType ?? "priority") as Distribution)) ?? null,
  listDestinations: async (_ruleId: string): Promise<RoutedDestination[]> => [],
  createSimple: async (
    campaignId: string,
    _campaignName: string,
    _rules: RuleSummary[],
  ): Promise<RuleSummary> => ({
    id: `simple-${campaignId}`,
    name: "Simple setup",
    ruleType: "priority",
    campaignId,
  }),
  setDistribution: async (_ruleId: string, _distribution: Distribution): Promise<void> => undefined,
  updateDestination: async (
    _ruleId: string,
    _destinationId: string,
    _updates: Partial<RoutedDestination>,
  ): Promise<void> => undefined,
  removeDestination: async (_ruleId: string, _destinationId: string): Promise<void> => undefined,
};
import { ROUTES } from "@/lib/constants";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { formatCurrency, toE164 } from "@/lib/format";
import { cn } from "@/lib/utils";

type DuplicateHandling = "Normal" | "Original" | "Different";
type DirectionScope = "Destination" | "Buyer";

/** How calls are shared between this campaign's destinations - saved on the
 *  campaign's Simple setup (backend rule types). Replaces the old "Routing
 *  option" row, whose choice was never saved anywhere. */
const DISTRIBUTION_OPTIONS: Distribution[] = ["priority", "weighted", "round_robin"];
const DISTRIBUTION_LABEL: Record<Distribution, string> = {
  priority: "In order",
  weighted: "Split by %",
  round_robin: "Take turns",
};
const DISTRIBUTION_HINT: Record<Distribution, string> = {
  priority: "Calls go to the destination with priority 1; the next one takes over when it is busy, full or off.",
  weighted: "Calls are shared by the Weight column (e.g. 70 / 30).",
  round_robin: "Each destination takes the next call in turn.",
};

/** One row of "Send calls to": a destination this campaign really routes to. */
interface RoutedRow {
  /** Rule-destination id (priority / weight / remove act on this). */
  id: string;
  name: string;
  tfn: string;
  buyerId: string;
  buyerName?: string;
  /** The Destination record behind the number, when there is one. */
  destId?: string;
  enabled: boolean;
}
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

  // ─── Call setup: where this campaign's calls go ─────────────────────────
  // Read from the campaign's own routing (its "Simple setup" rule). Before,
  // this table listed EVERY enabled destination in the account, which was
  // not where the calls went, and Priority / Weight were never saved.
  const campaign = useCampaignsStore((s) => s.getById(campaignId));
  const numbers = useNumbersStore((s) => s.numbers);
  const numberCount = useMemo(
    () => numbers.filter((n) => n.campaignId === campaignId).length,
    [numbers, campaignId],
  );
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [simple, setSimple] = useState<RuleSummary | null>(null);
  const [routed, setRouted] = useState<RoutedDestination[]>([]);
  const [routingLoaded, setRoutingLoaded] = useState(false);
  const [routingFailed, setRoutingFailed] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});

  const loadRouting = useCallback(async () => {
    try {
      const list = await campaignRouting.listRules(campaignId);
      const mine = campaignRouting.pickSimple(list);
      const rows = mine ? await campaignRouting.listDestinations(mine.id) : [];
      setRules(list);
      setSimple(mine);
      setRouted(rows);
      setPriorities(Object.fromEntries(rows.map((r) => [r.id, r.priority])));
      setWeights(Object.fromEntries(rows.map((r) => [r.id, r.weight])));
      setRoutingFailed(false);
    } catch {
      setRoutingFailed(true);
    } finally {
      setRoutingLoaded(true);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadRouting();
  }, [loadRouting]);

  /** The Simple setup's id, creating it the first time a destination is added. */
  const ensureRule = async (): Promise<string> => {
    if (simple) return simple.id;
    const created = await campaignRouting.createSimple(campaignId, campaign?.name ?? "Campaign", rules);
    setSimple(created);
    setRules((prev) => [...prev, created]);
    return created.id;
  };

  const distribution: Distribution =
    simple && SIMPLE_TYPES.includes(simple.ruleType as Distribution)
      ? (simple.ruleType as Distribution)
      : "priority";

  const changeDistribution = async (next: Distribution) => {
    if (next === distribution && simple) return;
    try {
      const ruleId = await ensureRule();
      await campaignRouting.setDistribution(ruleId, next);
      setSimple((s) => (s ? { ...s, ruleType: next } : s));
      toast.success(`Calls now shared: ${DISTRIBUTION_LABEL[next]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save how calls are shared.");
    }
  };

  const destinations = useMemo<RoutedRow[]>(() => {
    const byNumber = new Map((allDestinations ?? []).map((d) => [toE164(d.tfn), d]));
    return routed.map((r) => {
      const dest = byNumber.get(toE164(r.number));
      return {
        id: r.id,
        name: dest?.name ?? r.number,
        tfn: r.number,
        buyerId: r.buyerId ?? dest?.buyerId ?? "",
        buyerName: r.buyerName ?? dest?.buyerName,
        destId: dest?.id,
        enabled: dest ? dest.enabled : true,
      };
    });
  }, [routed, allDestinations]);

  /** Save a row's Priority or Weight when the box is left. */
  const saveRow = async (rowId: string, field: "priority" | "weight") => {
    if (!simple) return;
    const before = routed.find((r) => r.id === rowId);
    if (!before) return;
    const value =
      field === "priority"
        ? Math.max(1, Math.floor(priorities[rowId] ?? before.priority))
        : Math.max(0, Math.min(100, Math.floor(weights[rowId] ?? before.weight)));
    if (value === before[field]) return;
    try {
      await campaignRouting.updateDestination(simple.id, rowId, { [field]: value });
      setRouted((rows) =>
        rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)).sort((a, b) => a.priority - b.priority),
      );
    } catch (e) {
      (field === "priority" ? setPriorities : setWeights)((p) => ({ ...p, [rowId]: before[field] }));
      toast.error(e instanceof Error ? e.message : "Couldn't save the change.");
    }
  };

  const advancedPlans = rules.filter((r) => r.id !== simple?.id);
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
    if (simple) {
      void campaignRouting
        .updateDestination(simple.id, id, { priority: next.priority, weight: next.weight })
        .then(() => loadRouting())
        .catch(() => toast.error("Couldn't save priority / weight."));
    }
    closeEdit();
    toast.success(t("trafficUI.campaigns.settings.forward.toast.convSaved"));
  };

  const onDetach = async (id: string, name: string) => {
    // Stops THIS campaign sending calls there. Before, it switched the
    // destination off everywhere, for every campaign.
    if (!simple) return;
    try {
      await campaignRouting.removeDestination(simple.id, id);
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

      {/* Call setup in three steps: numbers -> where calls go -> live. */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <ol className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <SetupStep
              n={1}
              done={numberCount > 0}
              title="Tracking numbers"
              detail={numberCount > 0 ? `${numberCount} attached` : "Attach at least one number"}
            />
            <SetupStep
              n={2}
              done={routed.length > 0}
              title="Send calls to"
              detail={
                !routingLoaded
                  ? "Checking…"
                  : routed.length > 0
                    ? `${routed.length} destination${routed.length === 1 ? "" : "s"} · ${DISTRIBUTION_LABEL[distribution]}`
                    : "Add at least one destination below"
              }
            />
            <SetupStep
              n={3}
              done={campaign?.status === "active"}
              title="Campaign live"
              detail={campaign?.status === "active" ? "Taking calls" : "Turn the campaign on to take calls"}
            />
          </ol>
          <Button asChild size="sm" variant="outline" className="gap-1.5 self-start lg:self-center">
            <Link href={ROUTES.routing}>
              <GitFork className="h-3.5 w-3.5" /> Advanced routing
            </Link>
          </Button>
        </div>
        {advancedPlans.length > 0 && (
          <p className="mt-4 rounded-md border border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
            This campaign also has {advancedPlans.length} Advanced routing plan
            {advancedPlans.length === 1 ? "" : "s"}. Calls that match{" "}
            {advancedPlans.length === 1 ? "it" : "them"} go there first; every other call follows{" "}
            <span className="font-medium text-foreground">Send calls to</span> below.
          </p>
        )}
        {routingFailed && (
          <p className="mt-4 text-[11px] text-destructive">
            Couldn&apos;t load where this campaign&apos;s calls go. Reload the page to try again.
          </p>
        )}
      </Card>

      <Card className="space-y-5 p-5">
        <ChoiceRow
          label="Share calls"
          description={DISTRIBUTION_HINT[distribution]}
          value={distribution}
          options={DISTRIBUTION_OPTIONS}
          labels={DISTRIBUTION_LABEL}
          onChange={(v) => void changeDistribution(v)}
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
          <Button size="sm" disabled={!routingLoaded || routingFailed} onClick={() => setAttachOpen(true)}>
            {routingLoaded ? <Plus className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}{" "}
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
                  {routingLoaded ? t("trafficUI.campaigns.settings.forward.empty") : "Loading…"}
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

      {/* "+ Add": pick destinations for this campaign; they go into its Simple setup. */}
      <AttachDestinationDialog
        campaignId={campaignId}
        campaignName={campaign?.name ?? "this campaign"}
        open={attachOpen}
        onOpenChange={setAttachOpen}
        ensureRule={ensureRule}
        excludeNumbers={new Set(routed.map((r) => toE164(r.number)))}
        startPriority={routed.reduce((m, r) => Math.max(m, r.priority), 0) + 1}
        onAttached={() => void loadRouting()}
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

/** One step of the call setup checklist. */
function SetupStep({ n, done, title, detail }: { n: number; done: boolean; title: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-md border border-border bg-background/30 px-3 py-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success)]" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <div className="text-xs font-semibold">
          {n}. {title}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{detail}</div>
      </div>
    </li>
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
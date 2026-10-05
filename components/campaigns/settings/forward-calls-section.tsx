"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Plus, Unlink } from "lucide-react";
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
import { ROUTES } from "@/lib/constants";
import { useBuyersStore } from "@/lib/store/buyers-store";
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

export function ForwardCallsSection({ campaignId }: ForwardCallsSectionProps) {
  void campaignId;
  const { t } = useTranslation();
  const [routing, setRouting] = useState<RoutingOption>("Standard");
  const [duplicate, setDuplicate] = useState<DuplicateHandling>("Different");
  const [direction, setDirection] = useState<DirectionScope>("Destination");
  const [strict, setStrict] = useState(true);
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

  // Show every active destination — a real router pick is determined by the
  // campaign↔buyer↔destination chain; for this UI we list all enabled ones
  // so the user can reorder them by priority/weight.
  const destinations = useMemo(
    () => (allDestinations ?? []).filter((d) => d.enabled),
    [allDestinations],
  );

  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
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
    closeEdit();
    toast.success(t("trafficUI.campaigns.settings.forward.toast.convSaved"));
  };

  const onDetach = (id: string, name: string) => {
    // Demo behavior: flip the destination to disabled so it drops out of the
    // routed list (the section already filters by `enabled`).
    setEnabled(id, false);
    toast.success(t("trafficUI.campaigns.settings.forward.toast.detached").replace("{name}", name));
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
          onChange={setDuplicate}
        />
        <ChoiceRow
          label={t("trafficUI.campaigns.settings.forward.directionScope")}
          description={t("trafficUI.campaigns.settings.forward.directionScopeHint")}
          value={direction}
          options={DIRECTION_OPTIONS}
          labels={directionLabel}
          onChange={setDirection}
        />
        <div className="flex items-start justify-between gap-3 border-t border-border pt-4">
          <div>
            <div className="text-xs font-medium">{t("trafficUI.campaigns.settings.forward.strictMode")}</div>
            <div className="text-[11px] text-muted-foreground">{t("trafficUI.campaigns.settings.forward.strictModeHint")}</div>
          </div>
          <Switch className="data-[state=checked]:bg-accent" checked={strict} onCheckedChange={setStrict} aria-label={t("trafficUI.campaigns.settings.forward.toggleStrict")} />
        </div>
      </Card>

      {/* Destinations priority table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("trafficUI.campaigns.settings.forward.routedDestinations")}
          </div>
          <Button
            size="sm"
            onClick={() => toast.info(t("trafficUI.campaigns.settings.forward.addDestSoon"))}
          >
            <Plus className="h-4 w-4" /> {t("trafficUI.common.add")}
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
                  {t("trafficUI.campaigns.settings.forward.empty")}
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
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-6 w-16 text-[11px]"
                        value={weights[d.id] ?? 100}
                        onChange={(e) =>
                          setWeights((p) => ({ ...p, [d.id]: Number(e.target.value) }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`${ROUTES.destinations}/${d.id}`}
                        className="text-xs font-medium transition-colors hover:text-accent"
                      >
                        {d.name}
                      </Link>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {buyer?.name ?? "—"}
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
                        onCheckedChange={(v) => {
                          setEnabled(d.id, v);
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
                          asLink={`${ROUTES.destinations}/${d.id}`}
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
                          onClick={() => onDetach(d.id, d.name)}
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
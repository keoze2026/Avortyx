"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from "@/components/shared/table-toolbar";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import {
  derivePurchaseStatus,
  deriveName as deriveNumberName,
  deriveDisplayName,
} from "@/components/numbers/track-numbers-table";
import { toE164 } from "@/lib/format";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type {
  NumberPool,
  PhoneNumberFormat,
  TrafficSourceEntry,
  TrackingNumber,
} from "@/lib/types";
import { Can } from "@/components/shared/can";
import { LocalName } from "@/lib/i18n/local-name";

const VENDOR_OPTIONS = ["Bandwidth", "Twilio", "Inteliquent", "Telnyx", "Voxbone"];
const PHONE_FORMATS: { id: PhoneNumberFormat; label: string; labelKey?: string }[] = [
  { id: "E164", label: "E164" },
  { id: "national", label: "National", labelKey: "x5.pools.formatNational" },
  { id: "international", label: "International", labelKey: "trafficUI.numbers.typeOptions.international" },
];

const STATUS_KEY: Record<string, string> = {
  active: "trafficUI.numbers.statusOptions.active",
  paused: "trafficUI.numbers.statusOptions.paused",
  pending: "trafficUI.numbers.statusOptions.pending",
  expired: "trafficUI.numbers.statusOptions.expired",
};

export default function NumberPoolDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const pool = useNumbersStore((s) => s.pools.find((p) => p.id === id));
  const updatePool = useNumbersStore((s) => s.updatePool);
  const numbers = useNumbersStore((s) => s.numbers);

  if (!pool) {
    return (
      <>
        <Link
          href={ROUTES.numbers}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("trafficUI.numbers.poolDetail.back")}
        </Link>
        <h1 className="mt-6 text-xl font-semibold">{t("trafficUI.numbers.poolDetail.notFoundTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("trafficUI.numbers.poolDetail.notFoundDescription")}
        </p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.numbers)}
          className="text-xs text-accent hover:underline"
        >
          {t("trafficUI.numbers.poolDetail.backToList")}
        </button>
      </>
    );
  }

  return (
    // Same content-width cap as Campaign Settings and the other edit pages
    // — keeps the form readable instead of stretching across an ultrawide.
    <div className="mx-auto w-full max-w-[928px] space-y-4">
      <Link
        href={ROUTES.numbers}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("trafficUI.numbers.poolDetail.back")}
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight"><LocalName name={pool.name} /></h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("trafficUI.numbers.poolDetail.manageDescription")}
        </p>
      </div>

      <IntegrationCodeCard pool={pool} />
      <SetupNumberPoolCard pool={pool} onChange={(patch) => updatePool(pool.id, patch)} />
      <AttachNumbersCard pool={pool} allNumbers={numbers} onChange={(ids) => updatePool(pool.id, { attachedNumberIds: ids })} />
      <VendorCard
        pool={pool}
        onToggleEnabled={(enabled) => updatePool(pool.id, { vendorEnabled: enabled })}
        onChangeVendor={(vendorId) => updatePool(pool.id, { vendorId })}
      />
      <TrafficSourcesCard
        pool={pool}
        onToggleEnabled={(enabled) => updatePool(pool.id, { trafficSourcesEnabled: enabled })}
        onChangeSources={(sources) => updatePool(pool.id, { trafficSources: sources })}
      />
    </div>
  );
}

/* ─── Integration Code card ──────────────────────────────────────────── */

function IntegrationCodeCard({ pool }: { pool: NumberPool }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const snippet = `<!-- Avortyx number-pool tracker · ${pool.name} -->
<script src="https://cdn.avortyx.io/track.js" data-pool="${pool.id}" defer></script>`;
  return (
    <Card className="p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
        {t("trafficUI.numbers.poolDetail.integration.title")}
      </h3>
      <div className="my-4 h-px w-full bg-border" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{t("trafficUI.numbers.poolDetail.integration.row")}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {t("trafficUI.numbers.poolDetail.integration.rowHint")}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t("trafficUI.numbers.poolDetail.integration.show")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("trafficUI.numbers.poolDetail.integration.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("trafficUI.numbers.poolDetail.integration.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <pre className="overflow-auto rounded-md border border-border bg-secondary/30 p-3 font-mono text-[11px] text-foreground/90">
            {snippet}
          </pre>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(snippet);
                  toast.success(t("trafficUI.common.copied"));
                } catch {
                  toast.error(t("trafficUI.common.copyFailed"));
                }
              }}
            >
              {t("trafficUI.common.copy")}
            </Button>
            <Button onClick={() => setOpen(false)}>{t("trafficUI.common.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ─── Setup Number Pool card ─────────────────────────────────────────── */

function SetupNumberPoolCard({
  pool,
  onChange,
}: {
  pool: NumberPool;
  onChange: (patch: Partial<NumberPool>) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
        {t("trafficUI.numbers.poolDetail.setup.title")}
      </h3>
      <div className="my-4 h-px w-full bg-border" />

      {/* Replacement Number */}
      <Row
        label={t("trafficUI.numbers.poolDetail.setup.replacementNumber")}
        hint={t("trafficUI.numbers.poolDetail.setup.replacementHint")}
      >
        <Input
          value={pool.replacementNumber ?? ""}
          onChange={(e) => onChange({ replacementNumber: e.target.value })}
          placeholder={t("trafficUI.numbers.poolDetail.setup.replacementPlaceholder")}
        />
      </Row>

      <Divider />

      {/* Phone Number Format */}
      <Row label={t("trafficUI.numbers.poolDetail.setup.format")} hint={t("trafficUI.numbers.poolDetail.setup.formatHint")}>
        <Select
          value={pool.phoneNumberFormat ?? "E164"}
          onValueChange={(v) => onChange({ phoneNumberFormat: v as PhoneNumberFormat })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHONE_FORMATS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.labelKey ? t(f.labelKey) : f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Divider />

      {/* Idle time */}
      <Row label={t("trafficUI.numbers.poolDetail.setup.idleTime")} hint={t("trafficUI.numbers.poolDetail.setup.idleHint")}>
        <SecondsInput
          value={pool.idleTimeSec ?? 300}
          onChange={(n) => onChange({ idleTimeSec: n })}
        />
      </Row>

      <Divider />

      {/* Closed browser delay */}
      <Row
        label={t("trafficUI.numbers.poolDetail.setup.closedBrowser")}
        hint={t("trafficUI.numbers.poolDetail.setup.closedBrowserHint")}
      >
        <SecondsInput
          value={pool.closedBrowserDelaySec ?? 30}
          onChange={(n) => onChange({ closedBrowserDelaySec: n })}
        />
      </Row>
    </Card>
  );
}

/* ─── Attach Numbers in Pool card ────────────────────────────────────── */

function AttachNumbersCard({
  pool,
  allNumbers,
  onChange,
}: {
  pool: NumberPool;
  allNumbers: TrackingNumber[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [pageSize, setPageSize] = React.useState<PageSize>(PAGE_SIZE_OPTIONS[1]);
  const [attachOpen, setAttachOpen] = React.useState(false);

  const attachedIds = pool.attachedNumberIds ?? [];
  const attached = React.useMemo(
    () => allNumbers.filter((n) => attachedIds.includes(n.id)),
    [allNumbers, attachedIds],
  );
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attached;
    return attached.filter((n) =>
      `${n.number} ${deriveNumberName(n)} ${deriveDisplayName(n)}`.toLowerCase().includes(q),
    );
  }, [attached, query]);
  const visible = filtered.slice(0, pageSize);

  const detach = (id: string) => {
    onChange(attachedIds.filter((x) => x !== id));
    toast.success(t("trafficUI.numbers.poolDetail.attach.removed"));
  };

  return (
    <Card className="p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
        {t("trafficUI.numbers.poolDetail.attach.title")}
      </h3>
      <div className="my-4 h-px w-full bg-border" />

      <Toolbar
        query={query}
        onQuery={setQuery}
        pageSize={pageSize}
        onPageSize={setPageSize}
        ctaLabel={t("trafficUI.numbers.poolDetail.attach.add")}
        onCta={() => setAttachOpen(true)}
      />

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 w-10 text-left">
                <Checkbox aria-label={t("trafficUI.common.selectAll")} />
              </TableHead>
              <TableHead>{t("trafficUI.numbers.poolDetail.attach.headers.number")}</TableHead>
              <TableHead>{t("trafficUI.numbers.poolDetail.attach.headers.name")}</TableHead>
              <TableHead>{t("trafficUI.numbers.poolDetail.attach.headers.purchaseStatus")}</TableHead>
              <TableHead>{t("trafficUI.numbers.poolDetail.attach.headers.type")}</TableHead>
              <TableHead>{t("trafficUI.numbers.poolDetail.attach.headers.status")}</TableHead>
              <TableHead className="pr-4">{t("trafficUI.numbers.poolDetail.attach.headers.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                  {t("trafficUI.common.noData")}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((n) => {
                const purchase = derivePurchaseStatus(n);
                return (
                  <TableRow key={n.id}>
                    <TableCell className="pl-4 text-left">
                      <Checkbox aria-label={t("trafficUI.numbers.track.selectRow").replace("{number}", toE164(n.number))} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{toE164(n.number)}</TableCell>
                    <TableCell className="font-medium">{deriveDisplayName(n)}</TableCell>
                    <TableCell>
                      <Badge variant={purchase.tone}>{t(purchase.labelKey)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {n.type === "tollfree" ? t("trafficUI.numbers.typeOptions.tollfree") : n.type === "local" ? t("trafficUI.numbers.typeOptions.local") : t("trafficUI.numbers.typeOptions.international")}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{STATUS_KEY[n.status] ? t(STATUS_KEY[n.status]) : n.status}</TableCell>
                    <TableCell className="pr-4">
                      <Can area="number-pools" action="edit"><Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={t("trafficUI.numbers.poolDetail.attach.detach").replace("{number}", toE164(n.number))}
                        onClick={() => detach(n.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button></Can>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AttachNumbersDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        allNumbers={allNumbers}
        attachedIds={attachedIds}
        onAttach={(ids) => {
          onChange(Array.from(new Set([...attachedIds, ...ids])));
          toast.success(
            (ids.length === 1
              ? t("trafficUI.numbers.poolDetail.attach.dialog.attached")
              : t("trafficUI.numbers.poolDetail.attach.dialog.attachedPlural")
            ).replace("{count}", String(ids.length)),
          );
        }}
      />
    </Card>
  );
}

function AttachNumbersDialog({
  open,
  onOpenChange,
  allNumbers,
  attachedIds,
  onAttach,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allNumbers: TrackingNumber[];
  attachedIds: string[];
  onAttach: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setQuery("");
    }
  }, [open]);

  const candidates = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return allNumbers.filter((n) => {
      if (attachedIds.includes(n.id)) return false;
      if (!q) return true;
      return `${n.number} ${deriveNumberName(n)} ${deriveDisplayName(n)}`.toLowerCase().includes(q);
    });
  }, [allNumbers, attachedIds, query]);

  const toggle = (id: string) => {
    setSelected((curr) => {
      const next = new Set(curr);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onSubmit = () => {
    if (selected.size === 0) return;
    onAttach(Array.from(selected));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("trafficUI.numbers.poolDetail.attach.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("trafficUI.numbers.poolDetail.attach.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("trafficUI.numbers.poolDetail.attach.dialog.searchPlaceholder")}
            className="h-9 pl-7 text-xs"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {candidates.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {t("trafficUI.numbers.poolDetail.attach.dialog.noMatching")}
            </div>
          ) : (
            candidates.map((n) => (
              <Label
                key={n.id}
                htmlFor={`attach-${n.id}`}
                className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-xs hover:bg-secondary/40 last:border-b-0"
              >
                <Checkbox
                  id={`attach-${n.id}`}
                  checked={selected.has(n.id)}
                  onCheckedChange={() => toggle(n.id)}
                />
                <span className="font-mono text-xs">{toE164(n.number)}</span>
                <span className="text-muted-foreground">· {deriveNumberName(n)}</span>
              </Label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("trafficUI.common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={selected.size === 0}>
            {t("trafficUI.numbers.poolDetail.attach.dialog.attachButton")} {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Vendor card (collapsible) ──────────────────────────────────────── */

function VendorCard({
  pool,
  onToggleEnabled,
  onChangeVendor,
}: {
  pool: NumberPool;
  onToggleEnabled: (enabled: boolean) => void;
  onChangeVendor: (vendorId: string) => void;
}) {
  const { t } = useTranslation();
  const enabled = pool.vendorEnabled ?? false;
  return (
    <Collapsible defaultOpen={enabled}>
      <Card className="p-5">
        <CollapsibleHeader
          title={t("trafficUI.numbers.poolDetail.vendor.title")}
          description={t("trafficUI.numbers.poolDetail.vendor.description")}
          enabled={enabled}
          onToggleEnabled={onToggleEnabled}
        />

        <CollapsibleContent>
          <div className="mt-4 h-px w-full bg-border" />
          <div className="mt-4">
            <Row label={t("trafficUI.numbers.poolDetail.vendor.choose")} hint={t("trafficUI.numbers.poolDetail.vendor.chooseHint")}>
              <Select value={pool.vendorId ?? ""} onValueChange={onChangeVendor}>
                <SelectTrigger>
                  <SelectValue placeholder={t("trafficUI.numbers.poolDetail.vendor.choosePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ─── Traffic Sources card (collapsible) ─────────────────────────────── */

function TrafficSourcesCard({
  pool,
  onToggleEnabled,
  onChangeSources,
}: {
  pool: NumberPool;
  onToggleEnabled: (enabled: boolean) => void;
  onChangeSources: (sources: TrafficSourceEntry[]) => void;
}) {
  const { t } = useTranslation();
  const enabled = pool.trafficSourcesEnabled ?? false;
  const sources = pool.trafficSources ?? [];
  const [query, setQuery] = React.useState("");
  const [pageSize, setPageSize] = React.useState<PageSize>(PAGE_SIZE_OPTIONS[1]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((s) => `${s.name} ${s.integration}`.toLowerCase().includes(q));
  }, [sources, query]);
  const visible = filtered.slice(0, pageSize);

  const onAdd = () => {
    const next: TrafficSourceEntry = {
      id: `ts_${Math.random().toString(36).slice(2, 8)}`,
      name: t("x5.pools.sourceN").replace("{n}", String(sources.length + 1)),
      integration: t("x5.pools.custom"),
      events: 0,
      conversions: 0,
    };
    onChangeSources([next, ...sources]);
    toast.success(t("trafficUI.numbers.poolDetail.trafficSources.added"));
  };

  const onRemove = (id: string) => {
    onChangeSources(sources.filter((s) => s.id !== id));
    toast.success(t("trafficUI.numbers.poolDetail.trafficSources.removed"));
  };

  return (
    <Collapsible defaultOpen={enabled}>
      <Card className="p-5">
        <CollapsibleHeader
          title={t("trafficUI.numbers.poolDetail.trafficSources.title")}
          description={t("trafficUI.numbers.poolDetail.trafficSources.description")}
          enabled={enabled}
          onToggleEnabled={onToggleEnabled}
        />

        <CollapsibleContent>
          <div className="mt-4 h-px w-full bg-border" />
          <p className="mt-3 text-xs text-muted-foreground">
            {t("trafficUI.numbers.poolDetail.trafficSources.longDescription")}{" "}
            <a className="text-accent hover:underline" href="#">
              {t("trafficUI.numbers.poolDetail.trafficSources.linkText")}
            </a>
            .
          </p>

          <div className="mt-3">
            <Toolbar
              query={query}
              onQuery={setQuery}
              pageSize={pageSize}
              onPageSize={setPageSize}
              ctaLabel={t("trafficUI.numbers.poolDetail.trafficSources.add")}
              onCta={onAdd}
            />

            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 w-10 text-left">
                      <Checkbox aria-label={t("trafficUI.common.selectAll")} />
                    </TableHead>
                    <TableHead>{t("trafficUI.numbers.poolDetail.trafficSources.headers.name")}</TableHead>
                    <TableHead>{t("trafficUI.numbers.poolDetail.trafficSources.headers.integration")}</TableHead>
                    <TableHead>{t("trafficUI.numbers.poolDetail.trafficSources.headers.events")}</TableHead>
                    <TableHead>{t("trafficUI.numbers.poolDetail.trafficSources.headers.conversions")}</TableHead>
                    <TableHead className="pr-4">{t("trafficUI.numbers.poolDetail.trafficSources.headers.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        {t("trafficUI.common.noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="pl-4 text-left">
                          <Checkbox aria-label={t("trafficUI.campaigns.table.selectRow").replace("{name}", s.name)} />
                        </TableCell>
                        <TableCell className="font-medium"><LocalName name={s.name} /></TableCell>
                        <TableCell className="text-muted-foreground">{s.integration}</TableCell>
                        <TableCell className="tabular-nums">{s.events}</TableCell>
                        <TableCell className="tabular-nums">{s.conversions}</TableCell>
                        <TableCell className="pr-4">
                          <Can area="number-pools" action="edit"><Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label={t("trafficUI.numbers.poolDetail.trafficSources.remove").replace("{name}", s.name)}
                            onClick={() => onRemove(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button></Can>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ─── Shared sub-components ──────────────────────────────────────────── */

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-3 py-2 sm:grid-cols-[1fr_minmax(0,1fr)]">
      <div>
        <Label className="text-sm">{label}</Label>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="my-2 h-px w-full bg-border" />;
}

function SecondsInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        step={5}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="pr-10 tabular-nums"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {t("trafficUI.common.sec")}
      </span>
    </div>
  );
}

function CollapsibleHeader({
  title,
  description,
  enabled,
  onToggleEnabled,
}: {
  title: string;
  description?: string;
  enabled: boolean;
  onToggleEnabled: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleEnabled(!enabled)}
          className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {enabled ? t("trafficUI.common.enabled") : t("trafficUI.common.disabled")}
        </button>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            aria-label={t("trafficUI.campaigns.settings.advancedShell.toggle").replace("{title}", title)}
          >
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
      </div>
    </div>
  );
}

/** Mini toolbar used by Attach Numbers and Traffic Sources cards.
 *  Mirrors the page-level TableToolbar but only the buttons these tables actually need. */
function Toolbar({
  query,
  onQuery,
  pageSize,
  onPageSize,
  ctaLabel,
  onCta,
}: {
  query: string;
  onQuery: (q: string) => void;
  pageSize: PageSize;
  onPageSize: (n: PageSize) => void;
  ctaLabel: string;
  onCta: () => void;
}) {
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = React.useState(false);

  return (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
      {searchOpen || query ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t("trafficUI.numbers.poolDetail.toolbar.searchPlaceholder")}
            className="h-9 w-56 pl-7 pr-7 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              onQuery("");
              setSearchOpen(false);
            }}
            aria-label={t("trafficUI.numbers.poolDetail.toolbar.closeSearch")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          aria-label={t("trafficUI.numbers.poolDetail.toolbar.search")}
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        aria-label={t("trafficUI.numbers.poolDetail.toolbar.filter")}
        onClick={() => toast(t("trafficUI.numbers.poolDetail.toolbar.filterSoon"))}
      >
        <ChevronRight className="h-4 w-4 rotate-90" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        aria-label={t("trafficUI.numbers.poolDetail.toolbar.columns")}
        onClick={() => toast(t("trafficUI.numbers.poolDetail.toolbar.columnsSoon"))}
      >
        <Settings className="h-4 w-4" />
      </Button>
      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSize(Number(v) as PageSize)}
      >
        <SelectTrigger size="sm" className="h-9 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {PAGE_SIZE_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {t("trafficUI.numbers.poolDetail.toolbar.onPage").replace("{n}", String(n))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Can area="number-pools" action="edit"><Button size="sm" className="h-9" onClick={onCta}>
        <Plus className="h-3.5 w-3.5" /> {ctaLabel}
      </Button></Can>
    </div>
  );
}

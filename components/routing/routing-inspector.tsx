"use client";

/**
 * Right-rail properties panel — edits config of the currently selected node.
 * Each kind has its own dedicated form; the inspector is the only place where
 * a routing node's data is mutated (apart from drag-drop instantiation).
 */

import { Trash2 } from "lucide-react";

import { NODE_META, TONE_STYLE } from "./node-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import type { RoutingNode, RoutingNodeData, RoutingNodeKind, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LocalName } from "@/lib/i18n/local-name";

const DAY_KEYS: Array<{ id: Weekday; key: string }> = [
  { id: 0, key: "trafficUI.common.days.sun" },
  { id: 1, key: "trafficUI.common.days.mon" },
  { id: 2, key: "trafficUI.common.days.tue" },
  { id: 3, key: "trafficUI.common.days.wed" },
  { id: 4, key: "trafficUI.common.days.thu" },
  { id: 5, key: "trafficUI.common.days.fri" },
  { id: 6, key: "trafficUI.common.days.sat" },
];

const US_STATES = ["TX", "CA", "FL", "NY", "PA", "OH", "IL", "GA", "NC", "MI", "WA", "AZ", "MA", "VA"];

interface RoutingInspectorProps {
  selected: RoutingNode | null;
  onPatch: (data: Partial<RoutingNodeData>) => void;
  onDelete: () => void;
  className?: string;
}

export function RoutingInspector({ selected, onPatch, onDelete, className }: RoutingInspectorProps) {
  const { t } = useTranslation();
  if (!selected) {
    return (
      <aside className={cn("flex h-full flex-col overflow-hidden", className)}>
        <div className="px-1">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("trafficUI.routing.inspector.title")}
          </h2>
        </div>
        <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            {t("trafficUI.routing.inspector.emptyHint")}
          </p>
        </div>
      </aside>
    );
  }

  const meta = NODE_META[selected.data.kind as RoutingNodeKind];
  const tone = TONE_STYLE[meta.tone];
  const Icon = meta.icon;
  const nodeLabel = t(`trafficUI.routing.nodes.${meta.kind}.label`);
  const nodeDescription = t(`trafficUI.routing.nodes.${meta.kind}.description`);

  return (
    <aside className={cn("flex h-full flex-col gap-3 overflow-hidden", className)}>
      <header className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md", tone.icon)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{nodeLabel}</div>
            <div className="truncate text-[10px] font-mono text-muted-foreground">
              {t("trafficUI.routing.inspector.idLabel")} {selected.id}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{nodeDescription}</p>
      </header>

      <div className="flex-1 space-y-3 overflow-auto rounded-lg border border-border bg-card p-3">
        <Form selected={selected} onPatch={onPatch} />
      </div>

      {/* Delete (disable for Inbound — the entry node is required) */}
      {meta.kind !== "inbound" && (
        <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> {t("trafficUI.routing.inspector.deleteNode")}
        </Button>
      )}
    </aside>
  );
}

function Form({
  selected,
  onPatch,
}: {
  selected: RoutingNode;
  onPatch: (data: Partial<RoutingNodeData>) => void;
}) {
  const kind = selected.data.kind;

  if (kind === "inbound") return <InboundForm data={selected.data} onPatch={onPatch} />;
  if (kind === "hoursFilter") return <HoursForm data={selected.data} onPatch={onPatch} />;
  if (kind === "geoFilter") return <GeoForm data={selected.data} onPatch={onPatch} />;
  if (kind === "tagFilter") return <TagForm data={selected.data} onPatch={onPatch} />;
  if (kind === "weightSplit") return <WeightForm data={selected.data} onPatch={onPatch} />;
  if (kind === "priority") return <PriorityForm data={selected.data} onPatch={onPatch} />;
  if (kind === "capCheck") return <CapForm data={selected.data} onPatch={onPatch} />;
  if (kind === "buyer") return <BuyerForm data={selected.data} onPatch={onPatch} />;
  if (kind === "deadEnd") return <DeadEndForm data={selected.data} onPatch={onPatch} />;
  return null;
}

type FormProps = { data: RoutingNodeData; onPatch: (data: Partial<RoutingNodeData>) => void };

function InboundForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const v = data.inbound?.campaignId ?? "none";
  return (
    <div className="space-y-2">
      <Label className="text-xs">{t("trafficUI.routing.inspector.forms.boundCampaign")}</Label>
      <Select
        value={v}
        onValueChange={(val) =>
          onPatch({ inbound: { campaignId: val === "none" ? undefined : val } })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("trafficUI.routing.inspector.forms.unbound")}</SelectItem>
          {campaigns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <LocalName name={c.name} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[10px] text-muted-foreground">
        {t("trafficUI.routing.inspector.forms.boundHint")}
      </p>
    </div>
  );
}

function HoursForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const cfg = data.hoursFilter!;
  const DAY_LABELS = DAY_KEYS.map((d) => ({ id: d.id, label: t(d.key) }));
  const toggleDay = (d: Weekday) => {
    const next = cfg.days.includes(d) ? cfg.days.filter((x) => x !== d) : [...cfg.days, d].sort((a, b) => a - b);
    onPatch({ hoursFilter: { ...cfg, days: next } });
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.activeDays")}</Label>
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d) => {
            const active = cfg.days.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDay(d.id)}
                className={cn(
                  "h-8 rounded text-[10px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                  active ? "border border-accent bg-accent/10 text-accent" : "border border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("trafficUI.routing.inspector.forms.startHour")}</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={cfg.startHour}
            onChange={(e) =>
              onPatch({ hoursFilter: { ...cfg, startHour: clamp(parseInt(e.target.value) || 0, 0, 23) } })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("trafficUI.routing.inspector.forms.endHour")}</Label>
          <Input
            type="number"
            min={1}
            max={24}
            value={cfg.endHour}
            onChange={(e) =>
              onPatch({ hoursFilter: { ...cfg, endHour: clamp(parseInt(e.target.value) || 0, 1, 24) } })
            }
          />
        </div>
      </div>
    </div>
  );
}

function GeoForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const cfg = data.geoFilter!;
  const toggleState = (s: string) => {
    const next = cfg.states.includes(s) ? cfg.states.filter((x) => x !== s) : [...cfg.states, s];
    onPatch({ geoFilter: { ...cfg, states: next } });
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.mode")}</Label>
        <Select
          value={cfg.mode}
          onValueChange={(v) => onPatch({ geoFilter: { ...cfg, mode: v as "allow" | "deny" } })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="allow">{t("trafficUI.routing.inspector.forms.modeAllow")}</SelectItem>
            <SelectItem value="deny">{t("trafficUI.routing.inspector.forms.modeDeny")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.states")}</Label>
        <div className="flex flex-wrap gap-1">
          {US_STATES.map((s) => {
            const active = cfg.states.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleState(s)}
                className={cn(
                  "h-7 w-9 rounded border text-[10px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TagForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const cfg = data.tagFilter!;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.tag")}</Label>
        <Input value={cfg.tag} onChange={(e) => onPatch({ tagFilter: { ...cfg, tag: e.target.value } })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.operator")}</Label>
        <Select
          value={cfg.operator}
          onValueChange={(v) => onPatch({ tagFilter: { ...cfg, operator: v as typeof cfg.operator } })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">{t("trafficUI.routing.inspector.forms.opEquals")}</SelectItem>
            <SelectItem value="contains">{t("trafficUI.routing.inspector.forms.opContains")}</SelectItem>
            <SelectItem value="starts-with">{t("trafficUI.routing.inspector.forms.opStartsWith")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.value")}</Label>
        <Input value={cfg.value} onChange={(e) => onPatch({ tagFilter: { ...cfg, value: e.target.value } })} />
      </div>
    </div>
  );
}

function WeightForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const cfg = data.weightSplit!;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.weightA")}</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={cfg.weightA}
          onChange={(e) =>
            onPatch({ weightSplit: { ...cfg, weightA: clamp(parseInt(e.target.value) || 0, 0, 100) } })
          }
        />
        <p className="text-[10px] text-muted-foreground">{t("trafficUI.routing.inspector.forms.weightHint").replace("{pct}", String(100 - cfg.weightA))}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("trafficUI.routing.inspector.forms.labelA")}</Label>
          <Input value={cfg.labelA ?? ""} onChange={(e) => onPatch({ weightSplit: { ...cfg, labelA: e.target.value } })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("trafficUI.routing.inspector.forms.labelB")}</Label>
          <Input value={cfg.labelB ?? ""} onChange={(e) => onPatch({ weightSplit: { ...cfg, labelB: e.target.value } })} />
        </div>
      </div>
    </div>
  );
}

function PriorityForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const cfg = data.priority!;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.primaryLabel")}</Label>
        <Input value={cfg.primaryLabel} onChange={(e) => onPatch({ priority: { ...cfg, primaryLabel: e.target.value } })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.fallbackLabel")}</Label>
        <Input value={cfg.fallbackLabel} onChange={(e) => onPatch({ priority: { ...cfg, fallbackLabel: e.target.value } })} />
      </div>
    </div>
  );
}

function CapForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const cfg = data.capCheck!;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.capKind")}</Label>
        <Select value={cfg.kind} onValueChange={(v) => onPatch({ capCheck: { ...cfg, kind: v as typeof cfg.kind } })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t("trafficUI.routing.inspector.forms.capDaily")}</SelectItem>
            <SelectItem value="monthly">{t("trafficUI.routing.inspector.forms.capMonthly")}</SelectItem>
            <SelectItem value="concurrency">{t("trafficUI.routing.inspector.forms.capConcurrency")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.limit")}</Label>
        <Input
          type="number"
          min={0}
          value={cfg.limit}
          onChange={(e) =>
            onPatch({ capCheck: { ...cfg, limit: Math.max(0, parseInt(e.target.value) || 0) } })
          }
        />
      </div>
    </div>
  );
}

function BuyerForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const cfg = data.buyer!;
  const buyers = useBuyersStore((s) => s.buyers);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.buyer")}</Label>
        <Select
          value={cfg.buyerId || "none"}
          onValueChange={(v) => {
            if (v === "none") return onPatch({ buyer: { ...cfg, buyerId: "", buyerName: "" } });
            const b = buyers.find((x) => x.id === v);
            onPatch({ buyer: { ...cfg, buyerId: v, buyerName: b?.name ?? "" } });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("trafficUI.routing.inspector.forms.buyerPick")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("trafficUI.routing.inspector.forms.buyerNone")}</SelectItem>
            {buyers.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                <LocalName name={b.name} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t("trafficUI.routing.inspector.forms.bidOverride")}</Label>
        <Input
          type="number"
          min={0}
          step="0.5"
          value={cfg.bidOverride ?? ""}
          placeholder={t("trafficUI.routing.inspector.forms.bidPlaceholder")}
          onChange={(e) =>
            onPatch({
              buyer: { ...cfg, bidOverride: e.target.value === "" ? undefined : parseFloat(e.target.value) },
            })
          }
        />
      </div>
    </div>
  );
}

function DeadEndForm({ data, onPatch }: FormProps) {
  const { t } = useTranslation();
  const cfg = data.deadEnd!;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{t("trafficUI.routing.inspector.forms.dropReason")}</Label>
      <Textarea
        value={cfg.reason}
        onChange={(e) => onPatch({ deadEnd: { ...cfg, reason: e.target.value } })}
        rows={3}
      />
      <p className="text-[10px] text-muted-foreground">{t("trafficUI.routing.inspector.forms.dropReasonHint")}</p>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

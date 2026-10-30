"use client";

/**
 * One campaign on the Routing page: where its calls ring, and an on/off switch.
 *
 * The operator types the TFN calls should go to - no need to create a
 * Destination first. Saved on the campaign's "Simple setup" routing rule
 * (see lib/api/services/campaign-routing.ts), which is what the call router
 * reads, so a call rings the number as soon as the campaign is Live.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Loader2,
  PhoneForwarded,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ADVANCED_ROUTING_HREF,
  campaignRouting,
  SIMPLE_TYPES,
  type Distribution,
  type RoutedDestination,
  type RuleSummary,
} from "@/lib/api/services/campaign-routing";
import { ROUTES } from "@/lib/constants";
import { toE164 } from "@/lib/format";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import type { Buyer, Campaign, Destination, TrackingNumber } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/my-permissions";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName } from "@/lib/i18n/local-name";

export const SHARE_LABEL: Record<Distribution, string> = {
  priority: "In order",
  weighted: "Split by %",
  round_robin: "Take turns",
};
const SHARE_HINT: Record<Distribution, string> = {
  priority: "#1 rings first. If it is busy, full or off, the next one takes the call.",
  weighted: "Calls are shared by the % next to each number.",
  round_robin: "Each number takes the next call in turn.",
};
const SHARE_OPTIONS: Distribution[] = ["priority", "weighted", "round_robin"];
const NO_BUYER = "__none__";

interface Props {
  campaign: Campaign;
  /** The campaign's Simple setup rule, or null when it has none yet. */
  rule: RuleSummary | null;
  /** Every routing rule of this campaign (the Simple setup is created after them). */
  campaignRules: RuleSummary[];
  /** The campaign's other (Advanced) rules. */
  advancedCount: number;
  routed: RoutedDestination[];
  trackingNumbers: TrackingNumber[];
  buyers: Buyer[];
  destinations: Destination[];
  open: boolean;
  onToggleOpen: () => void;
  onRuleChange: (rule: RuleSummary) => void;
  onRoutedChange: (ruleId: string, rows: RoutedDestination[]) => void;
  /** Reload everything from the server (after a failed multi-step change). */
  onReload: () => void;
}

export function SimpleRoutingRow({
  campaign,
  rule,
  campaignRules,
  advancedCount,
  routed,
  trackingNumbers,
  buyers,
  destinations,
  open,
  onToggleOpen,
  onRuleChange,
  onRoutedChange,
  onReload,
}: Props) {
  const setStatus = useCampaignsStore((s) => s.setStatus);
  // Where a campaign's calls ring needs both Call Flows Edit and Edit Forward Calls To.
  const { can } = usePermissions();
  const { t } = useTranslation();
  const canEdit = can("call-flows", "edit") && can("campaigns", "edit-forward");
  const buyerById = useMemo(() => new Map(buyers.map((b) => [b.id, b])), [buyers]);
  const destByNumber = useMemo(
    () => new Map(destinations.map((d) => [toE164(d.tfn), d])),
    [destinations],
  );

  const [tfn, setTfn] = useState("");
  const [buyerId, setBuyerId] = useState(NO_BUYER);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [weights, setWeights] = useState<Record<string, string>>({});

  const live = campaign.status === "active";
  const share: Distribution =
    rule && SIMPLE_TYPES.includes(rule.ruleType as Distribution) ? (rule.ruleType as Distribution) : "priority";
  const ready = routed.length > 0 || advancedCount > 0;

  /** The Simple setup's id, created the first time a TFN is added. */
  const ensureRule = async (): Promise<RuleSummary> => {
    if (rule) return rule;
    const created = await campaignRouting.createSimple(campaign.id, campaign.name, campaignRules);
    onRuleChange(created);
    return created;
  };

  // ─── Add a TFN ──────────────────────────────────────────────────────────
  const onTfnChange = (value: string) => {
    setTfn(value);
    // Typed a number that already exists under Destinations: take its buyer,
    // so revenue is credited, unless a buyer was already picked by hand.
    const known = destByNumber.get(toE164(value));
    if (known?.buyerId && buyerId === NO_BUYER) setBuyerId(known.buyerId);
  };

  const add = async () => {
    const digits = tfn.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      toast.error(t("y.rrow.enterFullNumber"));
      return;
    }
    const number = toE164(tfn);
    if (routed.some((r) => toE164(r.number) === number)) {
      toast.error(t("y.rrow.alreadyIn").replace("{number}", number));
      return;
    }
    setBusy(true);
    try {
      const r = await ensureRule();
      if (r.status !== "active") {
        await campaignRouting.setRuleStatus(r.id, "active");
        onRuleChange({ ...r, status: "active" });
      }
      const priority = routed.reduce((m, x) => Math.max(m, x.priority), 0) + 1;
      const row = await campaignRouting.addDestination(r.id, {
        number,
        buyerId: buyerId === NO_BUYER ? undefined : buyerId,
        priority,
      });
      onRoutedChange(r.id, [...routed, row].sort((a, b) => a.priority - b.priority));
      setTfn("");
      setBuyerId(NO_BUYER);
      toast.success(
        (live ? t("y.rrow.addedLive") : t("y.rrow.addedOff")).replace("{number}", number),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.rrow.addFailed"));
    } finally {
      setBusy(false);
    }
  };

  // ─── Edit the list ──────────────────────────────────────────────────────
  const remove = async (row: RoutedDestination) => {
    if (!rule) return;
    const before = routed;
    onRoutedChange(rule.id, routed.filter((r) => r.id !== row.id));
    try {
      await campaignRouting.removeDestination(rule.id, row.id);
      toast.success(t("y.rrow.removed").replace("{number}", toE164(row.number)).replace("{campaign}", campaign.name));
    } catch (e) {
      onRoutedChange(rule.id, before);
      toast.error(e instanceof Error ? e.message : t("y.rrow.removeFailed"));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!rule) return;
    const target = index + dir;
    if (target < 0 || target >= routed.length) return;
    const next = [...routed];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((r, i) => ({ ...r, priority: i + 1 }));
    const changed = renumbered.filter((r) => routed.find((o) => o.id === r.id)?.priority !== r.priority);
    onRoutedChange(rule.id, renumbered);
    try {
      for (const r of changed) await campaignRouting.updateDestination(rule.id, r.id, { priority: r.priority });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.rrow.orderFailed"));
      onReload();
    }
  };

  const saveWeight = async (row: RoutedDestination) => {
    if (!rule) return;
    const raw = weights[row.id];
    if (raw === undefined) return;
    const value = Math.max(0, Math.min(100, Math.floor(Number(raw) || 0)));
    setWeights((w) => {
      const { [row.id]: _drop, ...rest } = w;
      return rest;
    });
    if (value === row.weight) return;
    onRoutedChange(
      rule.id,
      routed.map((r) => (r.id === row.id ? { ...r, weight: value } : r)),
    );
    try {
      await campaignRouting.updateDestination(rule.id, row.id, { weight: value });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.rrow.splitFailed"));
      onReload();
    }
  };

  const changeShare = async (next: Distribution) => {
    if (next === share && rule) return;
    try {
      const r = await ensureRule();
      await campaignRouting.setDistribution(r.id, next);
      onRuleChange({ ...r, ruleType: next });
      toast.success(t("y.rrow.shareSaved").replace("{campaign}", campaign.name).replace("{mode}", t(`y.rrow.share.${next}`).toLowerCase()));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.rrow.shareFailed"));
    }
  };

  // ─── Live switch ────────────────────────────────────────────────────────
  const toggleLive = async (on: boolean) => {
    if (on && !ready) {
      toast.error(t("y.rrow.addTfnFirst"));
      if (!open) onToggleOpen();
      return;
    }
    setSwitching(true);
    try {
      await setStatus(campaign.id, on ? "active" : "paused");
      if (on && rule && rule.status !== "active") {
        await campaignRouting.setRuleStatus(rule.id, "active");
        onRuleChange({ ...rule, status: "active" });
      }
      toast.success((on ? t("y.rrow.nowLive") : t("y.rrow.paused")).replace("{campaign}", campaign.name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.rrow.changeFailed"));
    } finally {
      setSwitching(false);
    }
  };

  const shown = routed.slice(0, 3);
  const totalWeight = routed.reduce((s, r) => s + (r.weight || 0), 0);

  return (
    <Card className={cn("overflow-hidden p-0 transition-shadow", open && "shadow-md ring-1 ring-accent/20")}>
      {/* ── Summary line ── */}
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:gap-6">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex min-w-0 items-center gap-3 text-left lg:w-72 lg:shrink-0"
          aria-expanded={open}
        >
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              live && ready
                ? "bg-[color:var(--success)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_20%,transparent)]"
                : !ready
                  ? "bg-[color:var(--warning)]"
                  : "bg-muted-foreground/40",
            )}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold"><LocalName name={campaign.name} /></div>
            <div className="text-[11px] text-muted-foreground">
              {(trackingNumbers.length === 1 ? t("y.rrow.trackingOne") : t("y.rrow.trackingMany")).replace("{count}", String(trackingNumbers.length))}
              {routed.length > 1 && <> · {t(`y.rrow.share.${share}`)}</>}
            </div>
          </div>
        </button>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t("y.rrow.callsGoTo")}</span>
          {routed.length === 0 ? (
            advancedCount > 0 ? (
              <span className="text-[11px] text-muted-foreground">{t("y.rrow.advancedPlan")}</span>
            ) : (
              <button
                type="button"
                onClick={() => !open && onToggleOpen()}
                className="rounded-md border border-dashed border-[color:var(--warning)]/60 px-2 py-0.5 text-[11px] font-medium text-[color:var(--warning)] hover:bg-[color:var(--warning)]/10"
              >
                + {t("y.rrow.addATfn")}
              </button>
            )
          ) : (
            <>
              {shown.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-0.5 font-mono text-[11px] tabular-nums"
                >
                  <PhoneForwarded className="h-3 w-3 text-muted-foreground" />
                  {toE164(r.number)}
                </span>
              ))}
              {routed.length > shown.length && (
                <span className="text-[11px] text-muted-foreground">{t("y.rrow.more").replace("{count}", String(routed.length - shown.length))}</span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 self-end lg:self-auto">
          <span
            className={cn(
              "w-12 text-right text-[11px] font-medium",
              live ? "text-[color:var(--success)]" : "text-muted-foreground",
            )}
          >
            {live ? t("y.rrow.live") : t("y.rrow.off")}
          </span>
          <Switch
            className="data-[state=checked]:bg-accent"
            checked={live}
            disabled={switching || !canEdit}
            onCheckedChange={(on) => void toggleLive(on)}
            aria-label={(live ? t("y.rrow.turnOff") : t("y.rrow.turnOn")).replace("{campaign}", campaign.name)}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs text-muted-foreground"
            onClick={onToggleOpen}
            aria-label={open ? t("y.rrow.close") : t("y.rrow.editCampaign").replace("{campaign}", campaign.name)}
          >
            {open ? t("y.rrow.close") : t("y.rrow.edit")}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>

      {/* ── Editor ── */}
      {open && (
        <fieldset disabled={!canEdit} className="grid min-w-0 gap-6 border-t border-border bg-secondary/10 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-3">
            <div>
              <div className="text-xs font-semibold">{t("y.rrow.sendCallsTo")}</div>
              <p className="text-[11px] text-muted-foreground">
                {t("y.rrow.sendCallsHint")}
              </p>
            </div>

            {routed.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                {t("y.rrow.noTfnYet")}
              </div>
            ) : (
              <ol className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-card">
                {routed.map((r, i) => {
                  const known = destByNumber.get(toE164(r.number));
                  const buyerName = (r.buyerId && buyerById.get(r.buyerId)?.name) || r.buyerName || known?.buyerName;
                  const pct = totalWeight > 0 ? Math.round(((r.weight || 0) / totalWeight) * 100) : 0;
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 font-mono text-[11px] font-semibold text-accent">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-medium tabular-nums">{toE164(r.number)}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {known?.name && known.name !== r.number ? `${known.name} · ` : ""}
                          {buyerName ?? t("y.rrow.noBuyer")}
                        </div>
                      </div>
                      {share === "weighted" && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={weights[r.id] ?? String(r.weight)}
                            onChange={(e) => setWeights((w) => ({ ...w, [r.id]: e.target.value }))}
                            onBlur={() => void saveWeight(r)}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                            aria-label={t("y.rrow.shareFor").replace("{number}", toE164(r.number))}
                            className="h-7 w-16 px-2 text-center text-[11px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="w-9 text-right font-mono text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <IconButton label={t("y.rrow.moveUp")} disabled={i === 0} onClick={() => void move(i, -1)}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label={t("y.rrow.moveDown")} disabled={i === routed.length - 1} onClick={() => void move(i, 1)}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label={t("y.rrow.remove").replace("{number}", toE164(r.number))} tone="destructive" onClick={() => void remove(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Add a TFN */}
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <Input
                value={tfn}
                onChange={(e) => onTfnChange(e.target.value)}
                placeholder={t("y.rrow.tfnPlaceholder")}
                list={`tfn-suggestions-${campaign.id}`}
                inputMode="tel"
                className="h-9 font-mono text-xs sm:flex-1"
                aria-label={t("y.rrow.tfnAria")}
              />
              <datalist id={`tfn-suggestions-${campaign.id}`}>
                {destinations.map((d) => (
                  <option key={d.id} value={toE164(d.tfn)}>
                    {d.name}
                  </option>
                ))}
              </datalist>
              <Select value={buyerId} onValueChange={setBuyerId}>
                <SelectTrigger className="h-9 text-xs sm:w-48" aria-label={t("y.rrow.buyerOptional")}>
                  <SelectValue placeholder={t("y.rrow.buyerOptional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BUYER}>{t("y.rrow.noBuyer")}</SelectItem>
                  {buyers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <LocalName name={b.name} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={busy || !tfn.trim()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {t("y.rrow.addTfn")}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground">
              {t("y.rrow.buyerHint")}
            </p>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold">{t("y.rrow.shareCalls")}</div>
              <div className="space-y-1.5">
                {SHARE_OPTIONS.map((opt) => {
                  const active = opt === share;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => void changeShare(opt)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-accent/50 bg-accent/8 shadow-sm"
                          : "border-border bg-card hover:border-accent/30 hover:bg-secondary/40",
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span
                          className={cn(
                            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                            active ? "border-accent" : "border-muted-foreground/40",
                          )}
                        >
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                        </span>
                        {t(`y.rrow.share.${opt}`)}
                      </div>
                      <div className="mt-0.5 pl-5.5 text-[10px] leading-snug text-muted-foreground">{t(`y.rrow.shareHint.${opt}`)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold">{t("y.rrow.callersDial")}</div>
                <Link
                  href={`${ROUTES.campaigns}/${campaign.id}`}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-accent"
                >
                  {t("y.rrow.campaign")} <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {trackingNumbers.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("y.rrow.noTrackingYet")}{" "}
                  <Link href={ROUTES.numbers} className="font-medium text-accent hover:underline">
                    {t("y.rrow.attachOne")}
                  </Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {trackingNumbers.slice(0, 6).map((n) => (
                    <span
                      key={n.id}
                      className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[11px] tabular-nums"
                    >
                      {toE164(n.number)}
                    </span>
                  ))}
                  {trackingNumbers.length > 6 && (
                    <span className="text-[11px] text-muted-foreground">{t("y.rrow.more").replace("{count}", String(trackingNumbers.length - 6))}</span>
                  )}
                </div>
              )}
            </div>

            {advancedCount > 0 && (
              <Link
                href={ADVANCED_ROUTING_HREF}
                className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground hover:border-accent/30"
              >
                <SlidersHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {(advancedCount === 1 ? t("y.rrow.advancedOne") : t("y.rrow.advancedMany")).replace("{count}", String(advancedCount))}
                </span>
              </Link>
            )}
          </div>
        </fieldset>
      )}
    </Card>
  );
}

function IconButton({
  label,
  disabled,
  tone = "muted",
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  tone?: "muted" | "destructive";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-30",
        tone === "destructive"
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

"use client";

/**
 * CH-480 (Sir, 3 Nov): the Type column next to Priority on the group's
 * Destinations - what each line converts on (Incoming Call / Call Connected /
 * Call Length), as the campaign page shows it. Revenue is not shown in the
 * table (Sir: "don't give revenue, just give type"). Clicking it opens the
 * line's Rate and Convert ON to view and change, for every campaign of the
 * group it is in, through the group's own line endpoint, so the change is in
 * Change history like every other group edit.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignGroups } from "@/lib/api/services/campaign-groups.service";
import { cn } from "@/lib/utils";
import type { GroupRow } from "./model";
import { Pill, toInt } from "./ui";

type ConvertOn = "incoming" | "connected" | "length";
const KINDS: ConvertOn[] = ["incoming", "connected", "length"];

function label(t: (k: string) => string, on: string, secs: number) {
  if (on === "length") return `${t("cg.apply.length")} · ${secs}s`;
  if (on === "incoming" || on === "connected") return t(`cg.apply.${on}`);
  return "";
}

export function TypeCell({
  row,
  groupId,
  canEdit,
  onSaved,
}: {
  row: GroupRow;
  groupId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const camps = row.line.campaigns;
  const types = [...new Set(camps.filter((c) => c.convertOn).map((c) => label(t, c.convertOn, c.convertSeconds)))];
  const rates = [...new Set(camps.filter((c) => c.revenue != null).map((c) => Number(c.revenue).toFixed(2)))];
  const first = camps.find((c) => c.convertOn) ?? camps[0];

  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState("");
  const [on, setOn] = useState<ConvertOn | "">("");
  const [secs, setSecs] = useState("");
  const [saving, setSaving] = useState(false);

  const openEditor = (o: boolean) => {
    if (o) {
      setRate(rates.length === 1 ? rates[0] : "");
      setOn(KINDS.includes(first?.convertOn as ConvertOn) && types.length === 1 ? (first!.convertOn as ConvertOn) : "");
      setSecs(first?.convertOn === "length" ? String(first.convertSeconds || "") : "");
    }
    setOpen(o);
  };

  const ok =
    (rate.trim() !== "" || on !== "") &&
    (rate.trim() === "" || Number(rate) >= 0) &&
    (on !== "length" || (toInt(secs) ?? 0) > 0);

  const save = async () => {
    setSaving(true);
    try {
      await campaignGroups.setLine(groupId, {
        number: row.number,
        buyerId: row.buyerId ?? undefined,
        campaigns: camps.map((c) => ({ campaignId: c.campaignId, included: true })),
        ...(rate.trim() !== "" ? { revenue: Number(rate) } : {}),
        ...(on ? { convertOn: on, convertSeconds: on === "length" ? toInt(secs) ?? 0 : 0 } : {}),
      });
      toast.success(t("x480.saved"));
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const shown =
    types.length === 0 ? (
      <span className="text-xs text-muted-foreground">—</span>
    ) : (
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide">
          {types[0]}
        </span>
        {types.length > 1 && <Pill tone="amber">{t("x415.mixed")}</Pill>}
      </span>
    );

  if (camps.length === 0) return shown;

  return (
    <Popover open={open} onOpenChange={openEditor}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("rounded px-1 py-0.5 text-left transition-colors hover:bg-muted")}
          title={t("x480.viewEdit")}
        >
          {shown}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="text-xs font-semibold">{t("x480.title")}</div>
        {(types.length > 1 || rates.length > 1) && (
          <p className="text-[11px] text-amber-400">{t("x480.mixedNote")}</p>
        )}
        <div className="space-y-1">
          <div className="text-[11px] font-medium">{t("cg.apply.rate")}</div>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            disabled={!canEdit}
            onChange={(e) => setRate(e.target.value)}
            placeholder={rates.length > 1 ? rates.join(" / ") : "0.00"}
            className="h-8 font-mono"
          />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] font-medium">{t("cg.apply.convertOn")}</div>
          <div className="flex gap-1">
            <Select value={on || undefined} onValueChange={(v) => setOn(v as ConvertOn)} disabled={!canEdit}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder={types.length > 1 ? t("x415.mixed") : t("cg.apply.pick")} />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{t(`cg.apply.${k}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {on === "length" && (
              <Input
                type="number"
                min={1}
                value={secs}
                disabled={!canEdit}
                onChange={(e) => setSecs(e.target.value)}
                placeholder={t("cg.apply.secondsShort")}
                className="h-8 w-16 font-mono"
              />
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("x480.every").replace("{n}", String(camps.length))}
        </p>
        {canEdit && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
              {t("cg.cancel")}
            </Button>
            <Button size="sm" className="h-7 text-xs" disabled={!ok || saving} onClick={() => void save()}>
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("x415.saveChanges")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

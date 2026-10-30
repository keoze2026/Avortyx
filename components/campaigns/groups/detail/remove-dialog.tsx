"use client";

/**
 * CH-415 (Sir's design): removing a destination from the group - or pausing
 * it instead, which keeps its priority, limits and caps.
 *
 * Pause switches the line off on the Destinations page (the same switch the
 * table shows): routing skips it in every campaign until it is switched back
 * on. Remove deletes its row in the group's campaigns - all of them in one
 * transaction (POST /apply), or the ones picked (POST /{id}/line).
 */

import { useEffect, useMemo, useState } from "react";
import { Info, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignGroups, type CampaignGroup } from "@/lib/api/services/campaign-groups.service";
import { useLocalName } from "@/lib/i18n/local-name";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { cn } from "@/lib/utils";
import { fill } from "../shared";
import { formatUs, type GroupRow } from "./model";

type Choice = "pause" | "all" | "some";

export function RemoveDialog({
  rows,
  group,
  onClose,
  onDone,
}: {
  rows: GroupRow[] | null;
  group: CampaignGroup;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const setEnabled = useDestinationsStore((s) => s.setEnabled);
  const [choice, setChoice] = useState<Choice>("pause");
  const [some, setSome] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (rows) {
      setChoice(rows.some((r) => r.dest && r.enabled) ? "pause" : "all");
      setSome(new Set());
    }
  }, [rows]);

  // The group's campaigns these lines are in, in the group's order.
  const inCampaigns = useMemo(() => {
    const ids = new Set((rows ?? []).flatMap((r) => r.line.campaigns.map((c) => c.campaignId)));
    return group.campaigns.filter((c) => ids.has(c.id));
  }, [rows, group]);

  if (!rows) return null;
  const one = rows.length === 1 ? rows[0] : null;
  const canPause = rows.some((r) => r.dest && r.enabled);

  const go = async () => {
    setBusy(true);
    try {
      if (choice === "pause") {
        let failed = 0;
        for (const r of rows) {
          if (!r.dest || !r.enabled) continue;
          try {
            await setEnabled(r.dest.id, false);
          } catch {
            failed += 1;
          }
        }
        if (failed) toast.error(fill(t("x415.pauseFailed"), { n: failed }));
        else toast.success(one ? t("x415.pausedOne") : fill(t("x415.pausedN"), { n: rows.length }));
      } else if (choice === "all") {
        const res = await campaignGroups.apply({
          groupIds: [group.id],
          action: "remove",
          number: rows[0].number,
          numbers: rows.length > 1 ? rows.map((r) => ({ number: r.number, buyerId: r.buyerId ?? undefined })) : undefined,
        });
        toast.success(fill(t("x415.removedFrom"), { n: res.changed }));
      } else {
        if (!some.size) return;
        let changed = 0;
        for (const r of rows) {
          const where = r.line.campaigns.filter((c) => some.has(c.campaignId));
          if (!where.length) continue;
          const res = await campaignGroups.setLine(group.id, {
            number: r.number,
            buyerId: r.buyerId ?? undefined,
            campaigns: where.map((c) => ({ campaignId: c.campaignId, included: false })),
          });
          changed += res.changed;
        }
        toast.success(fill(t("x415.removedFrom"), { n: changed }));
      }
      onDone();
      onClose();
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const label =
    choice === "pause"
      ? t("x415.pauseDestination")
      : choice === "all"
        ? fill(t("x415.removeFromN"), { n: inCampaigns.length })
        : fill(t("x415.removeFromN"), { n: some.size });

  const Option = ({ id, title, desc, tag, children, disabled }: { id: Choice; title: string; desc: string; tag?: string; children?: React.ReactNode; disabled?: boolean }) => (
    <label
      className={cn(
        "block cursor-pointer rounded-lg border p-3 transition-colors",
        choice === id ? "border-accent bg-accent/10" : "border-border hover:bg-muted/30",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span className="flex items-start gap-2.5">
        <input
          type="radio"
          name="remove-choice"
          className="mt-0.5 accent-[var(--accent)]"
          checked={choice === id}
          onChange={() => setChoice(id)}
          disabled={disabled}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium">
            {title}
            {tag && <span className="text-[10px] font-medium text-accent">{tag}</span>}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
          {children}
        </span>
      </span>
    </label>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <Trash2 className="h-4 w-4" />
          </span>
          <DialogTitle>
            {one
              ? fill(t("x415.removeTitle"), { name: `${localName(one.buyerName)} · ${formatUs(one.number)}` })
              : fill(t("x415.removeTitleN"), { n: rows.length })}
          </DialogTitle>
          <DialogDescription>
            {fill(t("x415.removeIn"), {
              n: inCampaigns.length,
              group: group.name,
              names: inCampaigns.map((c) => localName(c.name)).join(", "),
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Option id="pause" title={t("x415.pauseInstead")} tag={t("x415.recommended")} desc={t("x415.pauseInsteadDesc")} disabled={!canPause} />
          <Option id="all" title={fill(t("x415.removeFromAll"), { n: inCampaigns.length })} desc={t("x415.removeFromAllDesc")} />
          <Option id="some" title={t("x415.removeFromSome")} desc={t("x415.removeFromSomeDesc")}>
            {choice === "some" && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {inCampaigns.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
                    <Checkbox
                      checked={some.has(c.id)}
                      onCheckedChange={(v) =>
                        setSome((s) => {
                          const n = new Set(s);
                          if (v) n.add(c.id);
                          else n.delete(c.id);
                          return n;
                        })
                      }
                      aria-label={c.name}
                    />
                    {localName(c.name)}
                  </span>
                ))}
              </span>
            )}
          </Option>
          <p className="flex gap-2 rounded-lg border border-accent/20 bg-accent/5 p-2.5 text-[11px] text-muted-foreground">
            <Info className="mt-px h-3.5 w-3.5 shrink-0 text-accent" /> {t("x415.liveFinish")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cg.cancel")}</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => void go()} disabled={busy || (choice === "some" && some.size === 0)}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

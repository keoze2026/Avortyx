"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
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
import type { BlockedNumberScope } from "@/lib/mock/suppression";
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { cn } from "@/lib/utils";
import { LocalName } from "@/lib/i18n/local-name";

type ChoiceType = "all" | "campaign";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new block on confirm. `campaignId` is undefined for All Campaigns. */
  onBlock: (input: {
    number: string;
    scope: BlockedNumberScope;
    campaignId?: string;
  }) => void;
}

/**
 * "Block a number" dialog — opened from the Blocked Numbers list page's
 * primary CTA. Matches the screenshot layout: Choose Type → Select Campaign
 * (when applicable) → Scope → Number → submit.
 */
export function BlockNumberDialog({ open, onOpenChange, onBlock }: Props) {
  const { t } = useTranslation();
  // Read live campaigns from the store (hydrated from GET /api/campaigns/
  // on app boot — see components/app-shell/store-hydrator.tsx). Previously
  // this dialog imported the static MOCK_CAMPAIGNS fixture and rendered
  // those 6 hardcoded entries regardless of backend state.
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const [choiceType, setChoiceType] = React.useState<ChoiceType>("all");
  const [campaignId, setCampaignId] = React.useState<string>("");
  const [scope, setScope] = React.useState<BlockedNumberScope>("number");
  const [number, setNumber] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setChoiceType("all");
      setCampaignId("");
      setScope("number");
      setNumber("");
    }
  }, [open]);

  const trimmedDigits = number.replace(/\D/g, "");
  const valid =
    trimmedDigits.length > 0 && (choiceType === "all" || campaignId !== "");

  const onSubmit = () => {
    if (!valid) return;
    onBlock({
      number: trimmedDigits,
      scope,
      campaignId: choiceType === "campaign" ? campaignId : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[13px] font-semibold uppercase tracking-wider">
            {t("toolsUI.suppression.blockedNumbers.block.dialogTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Choose Type — All Campaigns / Select Campaign */}
          <div className="space-y-2">
            <Label>{t("toolsUI.suppression.blockedNumbers.block.chooseType")}</Label>
            <Segmented
              options={[
                { id: "all", label: t("toolsUI.suppression.blockedNumbers.block.allCampaigns") },
                { id: "campaign", label: t("toolsUI.suppression.blockedNumbers.block.selectCampaign") },
              ]}
              value={choiceType}
              onChange={(v) => setChoiceType(v as ChoiceType)}
            />
          </div>

          {/* Campaign picker — only when "Select Campaign" is chosen */}
          {choiceType === "campaign" && (
            <div className="space-y-2">
              <Label htmlFor="bn-campaign">{t("toolsUI.suppression.blockedNumbers.block.selectCampaign")}</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger id="bn-campaign">
                  <SelectValue placeholder={t("toolsUI.suppression.blockedNumbers.block.choose")} />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {t("toolsUI.suppression.blockedNumbers.block.noCampaigns")}
                    </div>
                  ) : (
                    campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <LocalName name={c.name} />
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Scope — Number / Prefix */}
          <div className="space-y-2">
            <Label>{t("toolsUI.suppression.blockedNumbers.block.scope")}</Label>
            <Segmented
              options={[
                { id: "number", label: t("toolsUI.suppression.blockedNumbers.block.scopeNumber") },
                { id: "prefix", label: t("toolsUI.suppression.blockedNumbers.block.scopePrefix") },
              ]}
              value={scope}
              onChange={(v) => setScope(v as BlockedNumberScope)}
            />
          </div>

          {/* Number */}
          <div className="space-y-2">
            <Label htmlFor="bn-number">{t("toolsUI.suppression.blockedNumbers.block.numberLabel")}</Label>
            <Input
              id="bn-number"
              autoFocus
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              placeholder={t("toolsUI.suppression.blockedNumbers.block.numberPlaceholder")}
              inputMode="tel"
            />
          </div>
        </div>

        <div className="my-2 h-px w-full bg-border" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("toolsUI.suppression.blockedNumbers.block.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!valid}>
            {t("toolsUI.suppression.blockedNumbers.block.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Tiny segmented-control used inside both Block / Update dialogs ──── */

interface SegmentedProps<T extends string> {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-md border border-border bg-secondary/40 p-0.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

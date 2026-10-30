"use client";

import * as React from "react";

import { Segmented } from "./block-number-dialog";
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
import type { BlockedNumberEntry } from "@/lib/mock/suppression";
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { LocalName } from "@/lib/i18n/local-name";

type ChoiceType = "all" | "campaign";

interface Props {
  /** When non-null the dialog is open and seeded with this entry. */
  entry: BlockedNumberEntry | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { id: string; number: string; campaignId?: string }) => void;
}

/** "Update a number" dialog — opened from the row pencil icon. */
export function UpdateNumberDialog({ entry, onOpenChange, onSave }: Props) {
  const { t } = useTranslation();
  // Live campaigns from the real store (replaces the previous MOCK_CAMPAIGNS import).
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const open = entry !== null;
  const [choiceType, setChoiceType] = React.useState<ChoiceType>("all");
  const [campaignId, setCampaignId] = React.useState<string>("");
  const [number, setNumber] = React.useState("");

  // Seed when the dialog opens with a new row.
  React.useEffect(() => {
    if (entry) {
      setChoiceType(entry.campaignId ? "campaign" : "all");
      setCampaignId(entry.campaignId ?? "");
      setNumber(entry.number);
    }
  }, [entry]);

  const trimmedDigits = number.replace(/\D/g, "");
  const valid =
    trimmedDigits.length > 0 && (choiceType === "all" || campaignId !== "");

  const onSubmit = () => {
    if (!entry || !valid) return;
    onSave({
      id: entry.id,
      number: trimmedDigits,
      campaignId: choiceType === "campaign" ? campaignId : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[13px] font-semibold uppercase tracking-wider">
            {t("toolsUI.suppression.blockedNumbers.update.dialogTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t("toolsUI.suppression.blockedNumbers.update.chooseType")}</Label>
            <Segmented
              options={[
                { id: "all", label: t("toolsUI.suppression.blockedNumbers.update.allCampaigns") },
                { id: "campaign", label: t("toolsUI.suppression.blockedNumbers.update.selectCampaign") },
              ]}
              value={choiceType}
              onChange={(v) => setChoiceType(v as ChoiceType)}
            />
          </div>

          {choiceType === "campaign" && (
            <div className="space-y-2">
              <Label htmlFor="un-campaign">{t("toolsUI.suppression.blockedNumbers.update.selectCampaign")}</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger id="un-campaign" autoFocus>
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

          {/* Phone number is intentionally immutable after creation — confirmed
              by the backend dev (2026-06-23). Sending a `phone_number` change
              via PATCH now returns 400 with an error. Show the existing value
              read-only so the operator has context, and surface a one-line
              hint that explains the constraint + suggests the workaround
              (delete + re-add). */}
          <div className="space-y-2">
            <Label htmlFor="un-number">{t("toolsUI.suppression.blockedNumbers.update.numberLabel")}</Label>
            <Input
              id="un-number"
              value={number}
              disabled
              readOnly
              aria-readonly
              className="cursor-not-allowed opacity-70"
              inputMode="tel"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("toolsUI.suppression.blockedNumbers.update.numberImmutableHint")}
            </p>
          </div>
        </div>

        <div className="my-2 h-px w-full bg-border" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("toolsUI.suppression.blockedNumbers.update.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!valid}>
            {t("toolsUI.suppression.blockedNumbers.update.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

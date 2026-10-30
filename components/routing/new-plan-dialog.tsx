"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { GitFork, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useRoutingStore } from "@/lib/store/routing-store";
import { LocalName } from "@/lib/i18n/local-name";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a campaign when opening from a campaign context. */
  defaultCampaignId?: string;
}

export function NewPlanDialog({ open, onOpenChange, defaultCampaignId }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const add = useRoutingStore((s) => s.add);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [campaignId, setCampaignId] = useState<string>(defaultCampaignId ?? "none");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setCampaignId(defaultCampaignId ?? "none");
    setSubmitting(false);
  };

  const onClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const campaign = campaignId !== "none" ? campaigns.find((c) => c.id === campaignId) : undefined;
      const created = await add({
        name: name.trim(),
        description: description.trim() || undefined,
        campaignId: campaign?.id,
        campaignName: campaign?.name,
        status: "draft",
        nodes: [
          {
            id: "n_inbound",
            type: "inbound",
            position: { x: 80, y: 200 },
            data: { kind: "inbound", inbound: { campaignId: campaign?.id } },
          },
        ],
        edges: [],
      });
      toast.success(t("trafficUI.routing.newDialog.created").replace("{name}", created.name));
      onClose(false);
      router.push(`${ROUTES.routing}/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.err.planCreate"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <GitFork className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("trafficUI.routing.newDialog.title")}</DialogTitle>
              <DialogDescription>{t("trafficUI.routing.newDialog.description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="plan-name">{t("trafficUI.routing.newDialog.name")}</Label>
            <Input
              id="plan-name"
              autoFocus
              placeholder={t("trafficUI.routing.newDialog.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("trafficUI.routing.newDialog.campaign")}</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder={t("trafficUI.routing.newDialog.unboundPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("trafficUI.routing.newDialog.unboundItem")}</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <LocalName name={c.name} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-desc">{t("trafficUI.routing.newDialog.description2")}</Label>
            <Textarea
              id="plan-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("trafficUI.routing.newDialog.descPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            {t("trafficUI.common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !name.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("trafficUI.routing.newDialog.creating")}
              </>
            ) : (
              t("trafficUI.routing.newDialog.create")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

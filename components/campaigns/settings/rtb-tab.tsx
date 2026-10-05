"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignSettingsStore } from "@/lib/store/campaign-settings-store";

export function RtbTab({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const get = useCampaignSettingsStore((s) => s.get);
  const update = useCampaignSettingsStore((s) => s.update);
  const initial = get(campaignId).rtb;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    update(campaignId, "rtb", form);
    toast.success(t("trafficUI.campaigns.settings.rtb.saved"));
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("trafficUI.campaigns.settings.rtb.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("trafficUI.campaigns.settings.rtb.description")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
          <div>
            <div className="text-sm font-medium">{t("trafficUI.campaigns.settings.rtb.enableTitle")}</div>
            <div className="text-xs text-muted-foreground">
              {t("trafficUI.campaigns.settings.rtb.enableHint")}
            </div>
          </div>
          <Switch className="data-[state=checked]:bg-accent"
            checked={form.enabled}
            onCheckedChange={(enabled) => setForm((f) => ({ ...f, enabled }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.rtb.endpointUrl")}</Label>
            <Input
              placeholder={t("trafficUI.campaigns.settings.rtb.endpointPlaceholder")}
              value={form.endpoint}
              onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.rtb.authToken")}</Label>
            <Input
              type="password"
              placeholder={t("trafficUI.campaigns.settings.rtb.bearerToken")}
              value={form.authToken}
              onChange={(e) => setForm((f) => ({ ...f, authToken: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.rtb.timeoutMs")}</Label>
            <Input
              type="number"
              min={100}
              step={50}
              value={form.timeoutMs}
              onChange={(e) => setForm((f) => ({ ...f, timeoutMs: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("trafficUI.campaigns.settings.rtb.minBid")}</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={form.minBid}
              onChange={(e) => setForm((f) => ({ ...f, minBid: Number(e.target.value) || 0 }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? t("trafficUI.common.saving") : t("trafficUI.common.saveChanges")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
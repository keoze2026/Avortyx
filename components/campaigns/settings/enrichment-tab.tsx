"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignSettingsStore } from "@/lib/store/campaign-settings-store";
import type { EnrichmentUrl } from "@/lib/types";

function makeId() {
  return `en_${Math.random().toString(36).slice(2, 8)}`;
}

export function EnrichmentTab({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const get = useCampaignSettingsStore((s) => s.get);
  const update = useCampaignSettingsStore((s) => s.update);
  const urls = get(campaignId).enrichmentUrls;

  const [draft, setDraft] = useState<Omit<EnrichmentUrl, "id">>({
    label: "",
    url: "",
    hook: "pre-route",
    timeoutMs: 500,
    enabled: true,
  });

  const addUrl = () => {
    if (!draft.label.trim() || !draft.url.trim()) {
      toast.error(t("trafficUI.campaigns.settings.enrichment.required"));
      return;
    }
    update(campaignId, "enrichmentUrls", [...urls, { ...draft, id: makeId() }]);
    setDraft({ label: "", url: "", hook: "pre-route", timeoutMs: 500, enabled: true });
    toast.success(t("trafficUI.campaigns.settings.enrichment.added"));
  };

  const removeUrl = (id: string) => {
    update(
      campaignId,
      "enrichmentUrls",
      urls.filter((u) => u.id !== id),
    );
    toast.success(t("trafficUI.campaigns.settings.enrichment.removed"));
  };

  const toggleUrl = (id: string, enabled: boolean) => {
    update(
      campaignId,
      "enrichmentUrls",
      urls.map((u) => (u.id === id ? { ...u, enabled } : u)),
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("trafficUI.campaigns.settings.enrichment.title")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("trafficUI.campaigns.settings.enrichment.description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("trafficUI.campaigns.settings.enrichment.label")}</Label>
              <Input
                placeholder={t("trafficUI.campaigns.settings.enrichment.labelPlaceholder")}
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("trafficUI.campaigns.settings.enrichment.hook")}</Label>
              <Select
                value={draft.hook}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, hook: v as EnrichmentUrl["hook"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre-route">{t("trafficUI.campaigns.settings.enrichment.hooks.preRoute")}</SelectItem>
                  <SelectItem value="post-connect">{t("trafficUI.campaigns.settings.enrichment.hooks.postConnect")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label className="text-xs">{t("trafficUI.campaigns.settings.enrichment.url")}</Label>
              <Input
                placeholder={t("trafficUI.campaigns.settings.enrichment.urlPlaceholder")}
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{t("trafficUI.campaigns.settings.enrichment.timeout")}</Label>
              <Input
                type="number"
                min={50}
                step={50}
                value={draft.timeoutMs}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, timeoutMs: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addUrl}>
                <Plus className="h-4 w-4" /> {t("trafficUI.campaigns.settings.enrichment.addUrl")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {urls.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-6 py-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("trafficUI.campaigns.settings.enrichment.configured").replace("{count}", String(urls.length))}
          </div>
          <ul className="divide-y divide-border">
            {urls.map((u) => (
              <li key={u.id} className="flex items-center gap-4 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.label}</span>
                    <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {u.hook}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t("trafficUI.campaigns.settings.enrichment.timeoutSuffix").replace("{ms}", String(u.timeoutMs))}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {u.url}
                  </div>
                </div>
                <Switch className="data-[state=checked]:bg-accent"
                  checked={u.enabled}
                  onCheckedChange={(v) => toggleUrl(u.id, v)}
                  aria-label={t("trafficUI.campaigns.settings.enrichment.toggle").replace("{label}", u.label)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeUrl(u.id)}
                  aria-label={t("trafficUI.campaigns.settings.enrichment.remove").replace("{label}", u.label)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
"use client";

import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Hash, Loader2, Phone, Plus, Search } from "lucide-react";

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
import { useTranslation } from "@/hooks/use-translation";
import { API_BASE_URL } from "@/lib/api/env";
import { getAccessToken } from "@/lib/api/tokens";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedCampaignId?: string;
}

interface AvailableNumber {
  phone_number: string;
  friendly_name?: string;
  region?: string;
  locality?: string;
  monthly_price?: string | number;
}

type NumberType = "toll_free" | "local";

export function ProvisionNumberDialog({ open, onOpenChange, lockedCampaignId }: Props) {
  const { t } = useTranslation();
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const lockedCampaign =
    lockedCampaignId ? campaigns.find((c) => c.id === lockedCampaignId) : undefined;

  // Step 1: criteria form
  const [numberType, setNumberType] = useState<NumberType>("toll_free");
  const [areaCode, setAreaCode] = useState("");
  const [limit, setLimit] = useState(10);
  const [campaignId, setCampaignId] = useState<string>(lockedCampaignId ?? "none");
  const [searching, setSearching] = useState(false);

  // Step 2: results
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [provisioning, setProvisioning] = useState(false);

  const step = results.length > 0 ? "results" : "form";

  React.useEffect(() => {
    if (lockedCampaignId) setCampaignId(lockedCampaignId);
  }, [lockedCampaignId]);

  const reset = () => {
    setNumberType("toll_free");
    setAreaCode("");
    setLimit(10);
    setCampaignId(lockedCampaignId ?? "none");
    setResults([]);
    setSelected(new Set());
    setSearching(false);
    setProvisioning(false);
  };

  const onClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const authHeaders = (): Record<string, string> => {
    const token = getAccessToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const onSearch = async () => {
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    try {
      const body: Record<string, unknown> = {
        country_code: "US",
        number_type: numberType,
        contains: null,
        limit,
      };
      if (areaCode.trim()) body.area_code = areaCode.trim();

      const res = await fetch(`${API_BASE_URL}/api/numbers/search`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `Search failed (${res.status})`);
      }

      const data: unknown = await res.json();
      const items: AvailableNumber[] = Array.isArray(data)
        ? (data as AvailableNumber[])
        : ((data as Record<string, unknown>).results as AvailableNumber[] | undefined) ??
          ((data as Record<string, unknown>).items as AvailableNumber[] | undefined) ??
          [];

      if (items.length === 0) {
        toast.warning("No numbers found. Try a different area code or type.");
        return;
      }
      setResults(items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (phone: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const onProvision = async () => {
    if (selected.size === 0) {
      toast.warning("Select at least one number to provision.");
      return;
    }
    setProvisioning(true);
    const toProvision = results.filter((r) => selected.has(r.phone_number));
    let provisioned = 0;
    const errors: string[] = [];

    for (const num of toProvision) {
      const last4 = num.phone_number.replace(/\D/g, "").slice(-4);
      try {
        const res = await fetch(`${API_BASE_URL}/api/numbers/purchase`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            phone_number: num.phone_number,
            friendly_name: `DID-${last4}`,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          errors.push((err as { detail?: string }).detail ?? `Failed: ${num.phone_number}`);
        } else {
          provisioned++;
        }
      } catch {
        errors.push(`Network error for ${num.phone_number}`);
      }
    }

    if (provisioned > 0) {
      const campaign = campaignId !== "none"
        ? campaigns.find((c) => c.id === campaignId)
        : undefined;
      toast.success(
        `Provisioned ${provisioned} number${provisioned > 1 ? "s" : ""}`,
        {
          description: campaign
            ? `Attached to ${campaign.name}`
            : "No campaign attached",
        },
      );
    }
    if (errors.length > 0) {
      toast.error(errors.join("; "));
    }

    if (provisioned > 0) {
      onClose(false);
      window.location.reload();
    } else {
      setProvisioning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Hash className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>
                {step === "form"
                  ? t("trafficUI.numbers.provision.title")
                  : "Available Numbers"}
              </DialogTitle>
              <DialogDescription>
                {step === "form"
                  ? t("trafficUI.numbers.provision.description")
                  : `${results.length} numbers found — select to provision`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4 py-2">
            {/* Number type */}
            <div className="space-y-2">
              <Label>{t("trafficUI.numbers.provision.type")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["local", "toll_free"] as NumberType[]).map((nt) => (
                  <button
                    key={nt}
                    type="button"
                    onClick={() => setNumberType(nt)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      numberType === nt
                        ? "border-accent bg-accent/10"
                        : "border-border bg-secondary/30 hover:border-border/80"
                    }`}
                  >
                    <div className="text-sm font-medium capitalize">
                      {nt === "toll_free"
                        ? t("trafficUI.numbers.provision.tollfree")
                        : t("trafficUI.numbers.provision.local")}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {nt === "toll_free"
                        ? t("trafficUI.numbers.provision.tollfreeHint")
                        : t("trafficUI.numbers.provision.localHint")}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Area code */}
            <div className="space-y-2">
              <Label htmlFor="prov-area">
                {numberType === "toll_free" ? "Toll-Free Prefix (optional)" : "Area Code (optional)"}
              </Label>
              <Input
                id="prov-area"
                type="text"
                inputMode="numeric"
                placeholder={numberType === "toll_free" ? "e.g. 844, 800, 888" : "e.g. 512, 213"}
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                className="font-mono"
              />
            </div>

            {/* How many results to fetch */}
            <div className="space-y-2">
              <Label htmlFor="prov-limit">Results to fetch</Label>
              <Input
                id="prov-limit"
                type="number"
                min={1}
                max={20}
                value={limit}
                onChange={(e) =>
                  setLimit(Math.max(1, Math.min(20, parseInt(e.target.value) || 10)))
                }
                className="font-mono"
              />
            </div>

            {/* Campaign attachment */}
            {lockedCampaign ? (
              <div className="space-y-2">
                <Label>{t("trafficUI.numbers.provision.attachCampaign")}</Label>
                <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
                  <Hash className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="font-medium text-foreground">{lockedCampaign.name}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t("trafficUI.numbers.provision.attachCampaign")}</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("trafficUI.numbers.provision.leaveUnassigned")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("trafficUI.numbers.provision.leaveUnassignedItem")}
                    </SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          /* Results list */
          <div className="max-h-72 space-y-1.5 overflow-y-auto py-2 pr-1">
            {results.map((num) => {
              const isSelected = selected.has(num.phone_number);
              const location = num.locality ?? num.region ?? "";
              return (
                <button
                  key={num.phone_number}
                  type="button"
                  onClick={() => toggleSelect(num.phone_number)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-secondary/20 hover:border-border/80",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-transparent",
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="font-mono text-sm font-medium">{num.phone_number}</span>
                    {location && (
                      <span className="ml-2 text-xs text-muted-foreground">{location}</span>
                    )}
                  </span>
                  {num.monthly_price != null && (
                    <span className="text-xs text-muted-foreground">
                      ${Number(num.monthly_price).toFixed(2)}/mo
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => onClose(false)}>
                {t("trafficUI.common.cancel")}
              </Button>
              <Button onClick={onSearch} disabled={searching}>
                {searching ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" /> Search Numbers
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => { setResults([]); setSelected(new Set()); }}
                disabled={provisioning}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                onClick={onProvision}
                disabled={provisioning || selected.size === 0}
              >
                {provisioning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                    {t("trafficUI.numbers.provision.provisioning")}
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />{" "}
                    {selected.size > 1
                      ? `Provision ${selected.size} Numbers`
                      : "Provision Number"}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

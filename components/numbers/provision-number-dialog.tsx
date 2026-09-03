"use client";

import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Hash, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { numbersService, type PhoneNumberSearchResult } from "@/lib/api/services/numbers.service";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { NumberType } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When set, the provisioned number is auto-attached to this campaign and
   * the campaign picker is hidden.
   */
  lockedCampaignId?: string;
}

const STATE_OPTIONS = [
  { code: "TX", city: "Austin", area: "512" },
  { code: "CA", city: "Los Angeles", area: "213" },
  { code: "FL", city: "Miami", area: "305" },
  { code: "NY", city: "New York", area: "212" },
  { code: "IL", city: "Chicago", area: "312" },
  { code: "GA", city: "Atlanta", area: "404" },
];

export function ProvisionNumberDialog({ open, onOpenChange, lockedCampaignId }: Props) {
  const { t } = useTranslation();
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const provisionNumber = useNumbersStore((s) => s.provisionNumber);
  const lockedCampaign =
    lockedCampaignId ? campaigns.find((c) => c.id === lockedCampaignId) : undefined;

  // Step 1 — configure search
  const [type, setType] = useState<NumberType>("local");
  const [region, setRegion] = useState(STATE_OPTIONS[0].code);
  const [campaignId, setCampaignId] = useState<string>(lockedCampaignId ?? "none");

  // Step 2 — pick from search results
  const [step, setStep] = useState<"configure" | "pick">("configure");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PhoneNumberSearchResult[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);

  React.useEffect(() => {
    if (lockedCampaignId) setCampaignId(lockedCampaignId);
  }, [lockedCampaignId]);

  const reset = () => {
    setType("local");
    setRegion(STATE_OPTIONS[0].code);
    setCampaignId(lockedCampaignId ?? "none");
    setStep("configure");
    setSearching(false);
    setSearchResults([]);
    setSelectedNumber(null);
    setProvisioning(false);
  };

  const onClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const onSearch = async () => {
    setSearching(true);
    try {
      const areaOption = STATE_OPTIONS.find((s) => s.code === region);
      const results = await numbersService.phoneNumberSearch({
        numberType: type === "tollfree" ? "toll_free" : "local",
        countryCode: "US",
        limit: 5,
        areaCode: type === "local" ? areaOption?.area : undefined,
      });
      setSearchResults(results);
      setSelectedNumber(results[0]?.phoneNumber ?? null);
      setStep("pick");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const onProvision = async () => {
    if (!selectedNumber) return;
    setProvisioning(true);
    const campaign =
      campaignId !== "none" ? campaigns.find((c) => c.id === campaignId) : undefined;
    try {
      await provisionNumber({
        phoneNumber: selectedNumber,
        numberType: type === "tollfree" ? "toll_free" : "local",
        campaignId: campaign?.id,
        campaignName: campaign?.name,
      });
      toast.success(t("trafficUI.numbers.provision.toast.one"), {
        description: campaign
          ? t("trafficUI.numbers.provision.toast.attachedTo").replace("{name}", campaign.name)
          : t("trafficUI.numbers.provision.toast.unattached"),
      });
      onClose(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to provision number");
      setProvisioning(false);
    }
  };

  const selectedResult = searchResults.find((r) => r.phoneNumber === selectedNumber);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Hash className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("trafficUI.numbers.provision.title")}</DialogTitle>
              <DialogDescription>
                {t("trafficUI.numbers.provision.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "configure" ? (
          <div className="space-y-4 py-2">
            {/* Number type */}
            <div className="space-y-2">
              <Label>{t("trafficUI.numbers.provision.type")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["local", "tollfree"] as NumberType[]).map((nt) => (
                  <button
                    key={nt}
                    type="button"
                    onClick={() => setType(nt)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      type === nt
                        ? "border-accent bg-accent/10"
                        : "border-border bg-secondary/30 hover:border-border/80"
                    }`}
                  >
                    <div className="text-sm font-medium capitalize">
                      {nt === "tollfree"
                        ? t("trafficUI.numbers.provision.tollfree")
                        : t("trafficUI.numbers.provision.local")}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {nt === "tollfree"
                        ? t("trafficUI.numbers.provision.tollfreeHint")
                        : t("trafficUI.numbers.provision.localHint")}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Region picker for local numbers */}
            {type === "local" && (
              <div className="space-y-2">
                <Label>{t("trafficUI.numbers.provision.region")}</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATE_OPTIONS.map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {o.city}, {o.code} · ({o.area})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campaign picker */}
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
                    <SelectValue
                      placeholder={t("trafficUI.numbers.provision.leaveUnassigned")}
                    />
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
          /* Step 2 — pick a number from search results */
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Available numbers — select one to provision
            </p>
            {searchResults.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No numbers found. Try a different type or region.
              </p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((r) => {
                  const isSelected = r.phoneNumber === selectedNumber;
                  return (
                    <button
                      key={r.phoneNumber}
                      type="button"
                      onClick={() => setSelectedNumber(r.phoneNumber)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border bg-secondary/20 hover:border-border/70"
                      }`}
                    >
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? "text-accent" : "text-muted-foreground/30"
                        }`}
                      />
                      <span className="flex-1 font-mono text-sm">
                        {r.friendlyName ?? r.phoneNumber}
                      </span>
                      {r.monthlyCost != null && (
                        <span className="text-xs text-muted-foreground">
                          ${r.monthlyCost.toFixed(2)}/mo
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "configure" ? (
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
                    <Search className="h-3.5 w-3.5" /> Search Available Numbers
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("configure")}
                disabled={provisioning}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button
                onClick={onProvision}
                disabled={!selectedNumber || provisioning}
              >
                {provisioning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                    {t("trafficUI.numbers.provision.provisioning")}
                  </>
                ) : (
                  <>
                    <Hash className="h-3.5 w-3.5" />{" "}
                    Provision{" "}
                    {selectedResult?.friendlyName ?? selectedNumber ?? "number"}
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

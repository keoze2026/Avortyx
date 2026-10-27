"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { COUNTRY_NAMES } from "@/lib/countries";
import { countryLabel } from "@/components/numbers/country-label";

export interface CreatePoolInput {
  name: string;
  country: string;
  closedBrowserDelaySec: number;
  idleTimeSec: number;
  autoBuy: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreatePoolInput) => void;
}

/** "Create number pool" dialog launched from the Phone Numbers → Number pools tab. */
const DEFAULT_COUNTRY = "United States";

export function CreateNumberPoolDialog({ open, onOpenChange, onCreate }: Props) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState<string>(DEFAULT_COUNTRY);
  const [countryQuery, setCountryQuery] = React.useState("");
  const [closedBrowserDelaySec, setClosedBrowserDelaySec] = React.useState(30);
  const [idleTimeSec, setIdleTimeSec] = React.useState(300);
  const [autoBuy, setAutoBuy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setCountry(DEFAULT_COUNTRY);
      setCountryQuery("");
      setClosedBrowserDelaySec(30);
      setIdleTimeSec(300);
      setAutoBuy(false);
    }
  }, [open]);

  // Filter the country list as the operator types in the dropdown's search box.
  const filteredCountries = React.useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRY_NAMES;
    return COUNTRY_NAMES.filter((c) => c.toLowerCase().includes(q));
  }, [countryQuery]);

  const trimmed = name.trim();
  const onSubmit = () => {
    if (!trimmed) return;
    onCreate({
      name: trimmed,
      country,
      closedBrowserDelaySec,
      idleTimeSec,
      autoBuy,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-[13px] font-semibold uppercase tracking-wider">
            {t("trafficUI.numbers.createPool.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="np-name">{t("trafficUI.numbers.createPool.poolName")}</Label>
            <Input
              id="np-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              placeholder={t("trafficUI.numbers.createPool.poolNamePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("trafficUI.numbers.createPool.country")}</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <div className="sticky top-0 z-10 border-b border-border bg-popover px-2 py-1.5">
                  <input
                    type="text"
                    value={countryQuery}
                    onChange={(e) => setCountryQuery(e.target.value)}
                    placeholder={t("trafficUI.numbers.createPool.searchCountries")}
                    className="w-full bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none"
                    /* Stop the Select's own keyboard handling from stealing typing. */
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                {filteredCountries.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {t("trafficUI.numbers.createPool.noMatches")}
                  </div>
                ) : (
                  filteredCountries.map((c) => (
                    <SelectItem key={c} value={c}>
                      {countryLabel(c)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SecondsField
              id="np-cbd"
              label={t("trafficUI.numbers.createPool.closedBrowserDelay")}
              value={closedBrowserDelaySec}
              onChange={setClosedBrowserDelaySec}
            />
            <SecondsField
              id="np-idle"
              label={t("trafficUI.numbers.createPool.idleTime")}
              value={idleTimeSec}
              onChange={setIdleTimeSec}
            />
          </div>

          {/* Auto Buy — collapsible section, matches the screenshot's chevron toggle. */}
          <Collapsible>
            <div className="my-2 h-px w-full bg-border" />
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  {t("trafficUI.numbers.createPool.autoBuy")}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {autoBuy ? t("trafficUI.common.enabled") : t("trafficUI.common.disabled")}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
                <div>
                  <div className="text-xs font-medium">{t("trafficUI.numbers.createPool.autoProvision")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t("trafficUI.numbers.createPool.autoProvisionHint")}
                  </div>
                </div>
                <Switch
                  checked={autoBuy}
                  onCheckedChange={(v) => setAutoBuy(Boolean(v))}
                  aria-label={t("trafficUI.numbers.createPool.toggleAutoBuy")}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="my-2 h-px w-full bg-border" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("trafficUI.common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!trimmed}>
            {t("trafficUI.common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Seconds input with a "SEC" suffix matching the screenshot ────────── */

function SecondsField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={0}
          step={5}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="pr-10 tabular-nums"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {t("trafficUI.common.sec")}
        </span>
      </div>
    </div>
  );
}

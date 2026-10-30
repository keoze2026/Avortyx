"use client";

import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { cn } from "@/lib/utils";
import { LocalName } from "@/lib/i18n/local-name";

interface Props {
  selectedIds: string[];
  onAdd: (campaignId: string) => void;
  onRemove: (campaignId: string) => void;
  /** Override the subtitle text shown under the section heading. */
  description?: string;
}

/** Card on the shield detail page — chip list of attached campaigns + popover picker. */
export function ProtectedCampaignsCard({
  selectedIds,
  onAdd,
  onRemove,
  description,
}: Props) {
  const { t } = useTranslation();
  const desc = description ?? t("toolsUI.suppression.protectedCampaigns.defaultDescription");
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("");

  // Live campaigns from the real store (was previously MOCK_CAMPAIGNS).
  // Hydrated from GET /api/campaigns/ on app boot via StoreHydrator.
  const campaigns = useCampaignsStore((s) => s.campaigns);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const choices = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    return campaigns.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [campaigns, filter]);

  return (
    <Card className="p-5">
      <div className="mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          {t("toolsUI.suppression.protectedCampaigns.title")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      </div>

      <div className="my-4 h-px w-full bg-border" />

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const c = campaigns.find((x) => x.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-md border border-accent/45 bg-accent/12 px-2 py-1 text-xs font-medium text-foreground"
              >
                {c?.name ?? id}
                <button
                  type="button"
                  onClick={() => {
                    onRemove(id);
                    toast.success(t("toolsUI.suppression.protectedCampaigns.toastRemoved"));
                  }}
                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive"
                  aria-label={t("toolsUI.suppression.protectedCampaigns.removeAria").replace("{name}", c?.name ?? id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-accent hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" /> {t("toolsUI.suppression.protectedCampaigns.addCampaign")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="border-b border-border px-3 py-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("toolsUI.suppression.protectedCampaigns.searchPlaceholder")}
              className="w-full bg-transparent text-xs focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {choices.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                {t("toolsUI.suppression.protectedCampaigns.noMatches")}
              </div>
            ) : (
              choices.map((c) => {
                const checked = selectedSet.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (checked) onRemove(c.id);
                      else {
                        onAdd(c.id);
                        toast.success(t("toolsUI.suppression.protectedCampaigns.toastProtected").replace("{name}", c.name));
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary/50",
                      checked && "text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center",
                        checked ? "text-accent" : "text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="truncate"><LocalName name={c.name} /></span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </Card>
  );
}

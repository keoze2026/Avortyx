"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface AdvancedSettingShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children?: React.ReactNode;
  /** Open the body by default (used by tests / deep links). */
  defaultOpen?: boolean;
}

export function AdvancedSettingShell({
  icon: Icon,
  title,
  description,
  enabled,
  onEnabledChange,
  children,
  defaultOpen = false,
}: AdvancedSettingShellProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  // A card whose only control is its own switch (Auto Record, since the
  // client asked for the extra fields to go) has nothing to expand — it
  // renders as a plain row rather than a button with a chevron that opens
  // an empty panel.
  const expandable = Boolean(children);
  const Header = expandable ? "button" : "div";

  return (
    <Card className="overflow-hidden p-0">
      <Header
        {...(expandable ? { type: "button" as const, onClick: () => setOpen((v) => !v) } : {})}
        className={cn(
          "flex w-full items-center gap-4 p-4 text-left",
          expandable && "transition-colors hover:bg-muted/40",
        )}
      >
        <span
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            enabled ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider">{title}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
        </div>
        <div
          className="flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={cn(
              "text-[11px] uppercase tracking-wider",
              enabled ? "text-[color:var(--success)]" : "text-muted-foreground",
            )}
          >
            {enabled ? t("trafficUI.campaigns.settings.advancedShell.enabled") : t("trafficUI.campaigns.settings.advancedShell.disabled")}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label={t("trafficUI.campaigns.settings.advancedShell.toggle").replace("{title}", title)}
          />
          {expandable && (
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          )}
        </div>
      </Header>

      {open && children && (
        <div className="border-t border-border bg-muted/20 p-5">{children}</div>
      )}
    </Card>
  );
}

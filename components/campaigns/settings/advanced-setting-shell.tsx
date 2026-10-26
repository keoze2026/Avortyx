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
  // The options stay in the page once opened, so closing can slide shut
  // instead of vanishing (CH-272).
  const [opened, setOpened] = useState(defaultOpen);
  // A card whose only control is its own switch (Auto Record, since the
  // client asked for the extra fields to go) has nothing to expand — it
  // renders as a plain row rather than a row with an arrow that opens an
  // empty panel.
  const expandable = Boolean(children);
  const toggle = () => {
    setOpened(true);
    setOpen((v) => !v);
  };

  // CH-272 (Sir, 24 and 26 Oct: "few down arrows still not working, and
  // going back up is not smooth"):
  // - The arrow sat inside the area that stops clicks reaching the row (so a
  //   click on the switch doesn't also open the card), so clicking the arrow
  //   itself did nothing. It is now its own button.
  // - The row was one big button with the switch, another button, inside it.
  //   A button inside a button is not allowed, and phone browsers ignored
  //   taps on parts of it. The title and the arrow are now separate buttons
  //   beside the switch.
  // - The options appeared and vanished in one jump; they now slide open and
  //   shut.
  return (
    <Card className="overflow-hidden p-0">
      <div
        className={cn(
          "flex w-full items-center gap-4 p-4",
          expandable && "transition-colors hover:bg-muted/40",
        )}
      >
        {expandable ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-4 text-left"
          >
            <ShellTitle icon={Icon} title={title} description={description} enabled={enabled} />
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <ShellTitle icon={Icon} title={title} description={description} enabled={enabled} />
          </div>
        )}
        <div className="flex shrink-0 items-center gap-3">
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            // Blue when the setting is enabled; off is unchanged.
            className="data-[state=checked]:bg-accent"
            aria-label={t("trafficUI.campaigns.settings.advancedShell.toggle").replace("{title}", title)}
          />
          {expandable ? (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={title}
              // A 32px target around the 16px arrow, so it is easy to hit on a phone.
              className="-m-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
              />
            </button>
          ) : (
            // Same size as the arrow, so cards without options (e.g. Auto
            // Record Calls) keep their status and switch lined up with the rest.
            <span aria-hidden className="h-4 w-4 shrink-0" />
          )}
        </div>
      </div>

      {expandable && opened && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          // Closed options can't be tabbed into or read out.
          inert={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-border bg-muted/20 p-5">{children}</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ShellTitle({
  icon: Icon,
  title,
  description,
  enabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <>
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
    </>
  );
}

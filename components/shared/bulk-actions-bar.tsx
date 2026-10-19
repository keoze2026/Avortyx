"use client";

import * as React from "react";
import { Pause, Play, Trash2 } from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  count: number;
  onPlay: () => void;
  onPause: () => void;
  /** Leave out to hide the delete button (the role has no Delete tick). */
  onDelete?: () => void;
  onClear?: () => void;
  /** Optional label that names what's being selected (e.g. "campaigns"). */
  entity?: string;
  className?: string;
}

/**
 * Compact Play / Pause / Delete icon cluster that surfaces above tables when
 * one or more rows are selected. Reused on the Campaigns, Destinations, and
 * Buyers list pages so the bulk-action UX is identical across the network +
 * traffic surfaces. When `count === 0` the buttons render disabled.
 */
export function BulkActionsBar({
  count,
  onPlay,
  onPause,
  onDelete,
  onClear,
  entity,
  className,
}: BulkActionsBarProps) {
  const { t } = useTranslation();
  const disabled = count === 0;

  const tplPlay = t("common.bulk.playAria");
  const tplPause = t("common.bulk.pauseAria");
  const tplDelete = t("common.bulk.deleteAria");
  const fill = (s: string) =>
    s.replace("{count}", String(count)).replace("{entity}", entity ?? "");

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center gap-0.5 rounded-md border border-border bg-card px-1",
        className,
      )}
    >
      <BulkBtn
        icon={Play}
        label={fill(tplPlay)}
        onClick={onPlay}
        disabled={disabled}
        tone="success"
      />
      <BulkBtn
        icon={Pause}
        label={fill(tplPause)}
        onClick={onPause}
        disabled={disabled}
        tone="muted"
      />
      {onDelete && (
        <BulkBtn
          icon={Trash2}
          label={fill(tplDelete)}
          onClick={onDelete}
          disabled={disabled}
          tone="destructive"
        />
      )}
      {count > 0 && (
        <>
          <span
            aria-hidden
            className="ml-1 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--success,#10B981)]"
          />
          <span className="ml-1 mr-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="mr-1 rounded px-1 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {t("common.bulk.clear")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function BulkBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone: "muted" | "success" | "destructive";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled
          ? "cursor-not-allowed text-muted-foreground/40"
          : tone === "success"
            ? "text-[color:var(--success,#10B981)] hover:bg-[color:var(--success,#10B981)]/10"
            : tone === "destructive"
              ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

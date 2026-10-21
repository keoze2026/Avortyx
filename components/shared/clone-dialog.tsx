"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cloneName } from "@/lib/api/services/clone";
import { useTranslation } from "@/hooks/use-translation";

interface CloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in the title and text, e.g. "campaign" or "destination". */
  entity: string;
  /** Name of the thing being cloned. */
  sourceName: string;
  /** Short explanation of anything that is NOT copied or starts switched off. */
  note?: ReactNode;
  /**
   * Does the cloning. If it throws, the dialog stays open so the user can
   * try again - the caller is expected to show the error message.
   */
  onConfirm: () => Promise<void>;
}

/**
 * "Clone this campaign / destination?" confirmation, opened from the + icon
 * in the Campaigns and Destinations tables.
 */
export function CloneDialog({
  open,
  onOpenChange,
  entity,
  sourceName,
  note,
  onConfirm,
}: CloneDialogProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const entityKey = `y.clone.entity.${entity}`;
  const entityLabel = t(entityKey) === entityKey ? entity : t(entityKey);

  const confirm = async (e: MouseEvent) => {
    // Keep the dialog open while the clone is being created.
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller shows the error; stay open so it can be retried.
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("y.clone.title").replace("{entity}", entityLabel)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("y.clone.description").split("{name}")[0]}
            <span className="font-medium text-foreground">{cloneName(sourceName)}</span>
            {t("y.clone.description").split("{name}")[1]}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {note ? (
          <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            {note}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("y.common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={busy}>
            {busy ? t("y.clone.cloning") : t("y.clone.clone")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
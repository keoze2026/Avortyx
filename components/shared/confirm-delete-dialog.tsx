"use client";

/**
 * "Delete this ...?" with Cancel and Confirm (CH-488). Deleting from a list,
 * one row or many from the bulk bar, asks first - as Campaigns (CH-331) and
 * Buyers (CH-484) do. Nothing is deleted until Confirm.
 */

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
import { useTranslation } from "@/hooks/use-translation";

export function ConfirmDeleteDialog({
  names,
  title,
  titleMany,
  desc,
  descMany,
  onCancel,
  onConfirm,
}: {
  /** What would be deleted; null = closed. */
  names: string[] | null;
  /** Translation keys; {name} and {count} are filled in. */
  title: string;
  titleMany: string;
  desc: string;
  descMany: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const many = !!names && names.length > 1;
  return (
    <AlertDialog open={names !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {many ? t(titleMany).replace("{count}", String(names!.length)) : t(title)}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {many ? t(descMany) : t(desc).replace("{name}", names?.[0] ?? "")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {many && <p className="max-h-32 overflow-y-auto text-sm font-medium">{names!.join(", ")}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cdel.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-white hover:bg-destructive/90">
            {t("cdel.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

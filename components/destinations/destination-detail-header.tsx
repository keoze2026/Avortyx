"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Target,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName, useLocalName } from "@/lib/i18n/local-name";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { ROUTES } from "@/lib/constants";
import { toE164 } from "@/lib/format";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import type { Destination } from "@/lib/types";
import { Can } from "@/components/shared/can";
import { usePermissions } from "@/lib/my-permissions";

interface DestinationDetailHeaderProps {
  destination: Destination;
  onEdit: () => void;
}

export function DestinationDetailHeader({
  destination,
  onEdit,
}: DestinationDetailHeaderProps) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const { can } = usePermissions();
  const router = useRouter();
  const setEnabled = useDestinationsStore((s) => s.setEnabled);
  const remove = useDestinationsStore((s) => s.remove);
  const buyer = useBuyersStore((s) => s.buyers.find((b) => b.id === destination.buyerId));

  const onToggle = async () => {
    try {
      await setEnabled(destination.id, !destination.enabled);
      toast.success(
        destination.enabled
          ? t("networkUI.destinations.toast.paused").replace("{name}", localName(destination.name))
          : t("networkUI.destinations.toast.enabled").replace("{name}", localName(destination.name)),
      );
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("y.err.destUpdate")));
    }
  };

  const onRemove = async () => {
    try {
      await remove(destination.id);
      toast.success(t("networkUI.destinations.toast.removed").replace("{name}", localName(destination.name)));
      router.push(ROUTES.destinations);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("y.err.destDelete")));
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "rgba(0, 230, 184, 0.18)" }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push(ROUTES.destinations)}
          >
            <ArrowLeft className="h-3 w-3" /> {t("networkUI.destinations.detail.back")}
          </Button>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3 w-3" />
              <span className="font-mono">{toE164(destination.tfn)}</span>
            </span>
            {buyer && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <Link
                  href={`${ROUTES.buyers}/${buyer.id}`}
                  className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-accent"
                >
                  <Building2 className="h-3 w-3" /> <LocalName name={buyer.name} />
                </Link>
              </>
            )}
          </div>

          <h1 className="mt-1 font-sans text-xl font-semibold tracking-tight sm:text-2xl">
            <LocalName name={destination.name} />
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {destination.enabled ? (
            <Badge variant="success">{t("networkUI.destinations.detail.active")}</Badge>
          ) : (
            <Badge variant="outline">{t("networkUI.destinations.detail.disabled")}</Badge>
          )}
          <Can area="destinations" action="edit"><Button
            size="sm"
            variant={destination.enabled ? "outline" : "default"}
            onClick={onToggle}
          >
            {destination.enabled ? (
              <>
                <Pause className="h-3.5 w-3.5" /> {t("networkUI.destinations.detail.pause")}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> {t("networkUI.destinations.detail.enable")}
              </>
            )}
          </Button></Can>
          <Can area="destinations" action="edit"><Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> {t("networkUI.destinations.detail.edit")}
          </Button></Can>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("networkUI.destinations.detail.actionsAria")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {can("destinations", "edit") && (<><DropdownMenuItem onSelect={onEdit}>
                <Pencil className="h-4 w-4" /> {t("networkUI.destinations.detail.editSettings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator /></>)}
              {can("destinations", "delete") && (<DropdownMenuItem
                onSelect={onRemove}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> {t("networkUI.destinations.detail.removeDestination")}
              </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

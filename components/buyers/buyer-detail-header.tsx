"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Building2, Mail, MoreVertical, Pause, Play, Send, Trash2 } from "lucide-react";

import { BuyerInviteDialog } from "@/components/buyers/buyer-invite-dialog";
import { BuyerStatsRow } from "@/components/buyers/buyer-stats-row";
import { PartnerStatusBadge } from "@/components/network/partner-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useBuyersStore } from "@/lib/store/buyers-store";
import type { Buyer } from "@/lib/types";
import { Can } from "@/components/shared/can";
import { usePermissions } from "@/lib/my-permissions";

export function BuyerDetailHeader({ buyer }: { buyer: Buyer }) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const router = useRouter();
  const setStatus = useBuyersStore((s) => s.setStatus);
  const remove = useBuyersStore((s) => s.remove);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isActive = buyer.status === "active";

  const onToggle = () => {
    const next = isActive ? "paused" : "active";
    setStatus(buyer.id, next);
    toast.success(
      next === "active"
        ? t("networkUI.buyers.toast.activated").replace("{name}", buyer.name)
        : t("networkUI.buyers.toast.paused").replace("{name}", buyer.name),
    );
  };
  const onRemove = () => {
    remove(buyer.id);
    toast.success(t("networkUI.buyers.toast.removed").replace("{name}", buyer.name));
    router.push(ROUTES.buyers);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "rgba(40, 175, 110, 0.22)" }}
      />
      <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push(ROUTES.buyers)}
          >
            <ArrowLeft className="h-3 w-3" /> {t("networkUI.buyers.detail.back")}
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="font-mono">{buyer.organization}</span>
            </span>
            {buyer.contactName && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="font-mono text-muted-foreground">{buyer.contactName}</span>
              </>
            )}
            {buyer.email && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <a
                  href={`mailto:${buyer.email}`}
                  className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-accent"
                >
                  <Mail className="h-3 w-3" /> {buyer.email}
                </a>
              </>
            )}
          </div>
          <h1 className="mt-1 font-sans text-xl font-semibold tracking-tight sm:text-2xl">{buyer.name}</h1>
          {buyer.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{buyer.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <PartnerStatusBadge status={buyer.status} />
          <Can area="buyers" action="edit"><Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            <Send className="h-3.5 w-3.5" /> {t("y.bdh.invite")}
          </Button></Can>
          <Can area="buyers" action="edit"><Button size="sm" variant={isActive ? "outline" : "default"} onClick={onToggle}>
            {isActive ? (
              <>
                <Pause className="h-3.5 w-3.5" /> {t("networkUI.common.pause")}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> {t("networkUI.common.activate")}
              </>
            )}
          </Button></Can>
          {can("buyers", "delete") && (<DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("networkUI.buyers.detail.actionsAria")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> {t("networkUI.buyers.detail.removeBuyer")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>)}
        </div>
      </div>

      <BuyerInviteDialog
        buyer={inviteOpen ? buyer : null}
        onOpenChange={(open) => setInviteOpen(open)}
      />

      {/* Compact KPI strip docked to the bottom of the header card. Sits on a
          divider so the identity block above and the metrics below visually
          read as one panel. */}
      <div className="relative border-t border-border/60">
        <BuyerStatsRow buyer={buyer} />
      </div>
    </div>
  );
}

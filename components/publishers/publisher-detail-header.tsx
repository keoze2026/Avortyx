"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Mail, MoreVertical, Pause, Pencil, Play, Trash2, Users } from "lucide-react";

import { EditPublisherDialog } from "@/components/publishers/edit-publisher-dialog";
import { PartnerStatusBadge } from "@/components/network/partner-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { usePublishersStore } from "@/lib/store/publishers-store";
import type { Publisher } from "@/lib/types";

export function PublisherDetailHeader({ publisher }: { publisher: Publisher }) {
  const { t } = useTranslation();
  const router = useRouter();
  const setStatus = usePublishersStore((s) => s.setStatus);
  const remove = usePublishersStore((s) => s.remove);
  const [editOpen, setEditOpen] = useState(false);

  const isActive = publisher.status === "active";

  const onToggle = () => {
    const next = isActive ? "paused" : "active";
    setStatus(publisher.id, next);
    toast.success(
      next === "active"
        ? t("networkUI.publishers.toast.activated").replace("{name}", publisher.name)
        : t("networkUI.publishers.toast.paused").replace("{name}", publisher.name),
    );
  };
  const onRemove = () => {
    remove(publisher.id);
    toast.success(t("networkUI.publishers.toast.removed").replace("{name}", publisher.name));
    router.push(ROUTES.publishers);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "rgba(150, 95, 220, 0.22)" }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push(ROUTES.publishers)}
          >
            <ArrowLeft className="h-3 w-3" /> {t("networkUI.publishers.detail.back")}
          </Button>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3 w-3" />
              <span className="font-mono">{publisher.organization}</span>
            </span>
            {publisher.contactName && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="font-mono text-muted-foreground">{publisher.contactName}</span>
              </>
            )}
            {publisher.email && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <a
                  href={`mailto:${publisher.email}`}
                  className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-accent"
                >
                  <Mail className="h-3 w-3" /> {publisher.email}
                </a>
              </>
            )}
          </div>
          <h1 className="mt-1 font-sans text-xl font-semibold tracking-tight sm:text-2xl">{publisher.name}</h1>
          {publisher.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{publisher.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <PartnerStatusBadge status={publisher.status} />
          <Button size="sm" variant={isActive ? "outline" : "default"} onClick={onToggle}>
            {isActive ? (
              <>
                <Pause className="h-3.5 w-3.5" /> {t("networkUI.common.pause")}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> {t("networkUI.common.activate")}
              </>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("networkUI.publishers.detail.actionsAria")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> {t("networkUI.common.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> {t("networkUI.publishers.detail.removePublisher")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditPublisherDialog
        publisherId={editOpen ? publisher.id : null}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

"use client";

import { ArrowLeft, BookOpen, Loader2, PlayCircle, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveBadge } from "@/components/shared/live-badge";
import { useTranslation } from "@/hooks/use-translation";
import { ADVANCED_ROUTING_HREF } from "@/lib/api/services/campaign-routing";
import { formatRelativeTime } from "@/lib/format";
import type { RoutingPlan, RoutingPlanStatus } from "@/lib/types";
import { Can } from "@/components/shared/can";

interface Props {
  plan: RoutingPlan;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onPublishToggle: () => void;
  onDelete: () => void;
  onTest: () => void;
}

export function RoutingToolbar({ plan, dirty, saving, onSave, onPublishToggle, onDelete, onTest }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const published = plan.status === "published";
  const statusLabel: Record<RoutingPlanStatus, string> = {
    published: t("trafficUI.routing.statusFilter.live"),
    draft: t("trafficUI.routing.statusFilter.draft"),
    archived: t("trafficUI.routing.statusFilter.archived"),
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-1 h-8 text-muted-foreground"
        onClick={() => router.push(ADVANCED_ROUTING_HREF)}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("trafficUI.routing.toolbar.allPlans")}
      </Button>
      <div className="mx-1 h-5 w-px bg-border" />

      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold">{plan.name}</span>
        <Badge variant={published ? "success" : "outline"} className="capitalize">
          {published && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {statusLabel[plan.status]}
        </Badge>
        {dirty && (
          <Badge variant="warning">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {t("trafficUI.routing.toolbar.unsaved")}
          </Badge>
        )}
        {!dirty && <LiveBadge label={t("trafficUI.routing.toolbar.savedAt").replace("{time}", formatRelativeTime(plan.updatedAt))} className="hidden md:inline-flex" />}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onTest}>
          <PlayCircle className="h-3.5 w-3.5" /> {t("trafficUI.routing.toolbar.testCall")}
        </Button>
        <Can area="call-flows" action="delete"><Button variant="outline" size="sm" onClick={onDelete} className="text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button></Can>
        <Can area="call-flows" action="edit"><Button variant={dirty ? "default" : "outline"} size="sm" onClick={onSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("trafficUI.routing.toolbar.save")}
        </Button></Can>
        <Can area="call-flows" action="edit"><Button size="sm" onClick={onPublishToggle} className="gap-1">
          <BookOpen className="h-3.5 w-3.5" />
          {published ? t("trafficUI.routing.toolbar.unpublish") : t("trafficUI.routing.toolbar.publish")}
        </Button></Can>
      </div>
    </div>
  );
}

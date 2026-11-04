"use client";

/**
 * Campaign Groups (CH-328; Sir, 28 Oct): 10-14 live campaigns and two or three
 * people to run them. A destination added, removed, or given a new priority
 * or weight is changed here once, in every campaign of the group, instead of
 * campaign by campaign during the shift.
 *
 * CH-421 (Sir, 30 Oct: "No changes at our end yet - under Campaign Group"):
 * this page IS the group page in Sir's design (CH-415). It used to list each
 * group as a plain table with an "Open Group" button to the new page; now the
 * picked group shows here directly, with a picker when there are several.
 *
 * Internal: publisher and buyer logins never get here (the server answers
 * them 403 too).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Layers, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ApplyChangeDialog, type ApplyStart } from "@/components/campaigns/groups/apply-change-dialog";
import { GroupDetail } from "@/components/campaigns/groups/detail/group-detail";
import { GroupEditorDialog } from "@/components/campaigns/groups/group-editor-dialog";
import { fill } from "@/components/campaigns/groups/shared";
import { EmptyState } from "@/components/shared/empty-state";
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
import { Button } from "@/components/ui/button";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignGroups, type CampaignGroup, type GroupLine } from "@/lib/api/services/campaign-groups.service";
import { ROUTES } from "@/lib/constants";
import { useLocalName } from "@/lib/i18n/local-name";
import { usePermissions } from "@/lib/my-permissions";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { cn } from "@/lib/utils";

export default function CampaignGroupsPage() {
  const { t } = useTranslation();
  const localName = useLocalName();
  const { isPartner } = usePartnerPermissions();
  const canEdit = usePermissions().can("campaigns", "edit-campaign");

  const campaigns = useCampaignsStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignsStore((s) => s.fetch);

  const [groups, setGroups] = useState<CampaignGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; group: CampaignGroup | null }>({ open: false, group: null });
  const [apply, setApply] = useState<{ open: boolean; start: ApplyStart }>({ open: false, start: { action: "update" } });
  const [applyLines, setApplyLines] = useState<Record<string, GroupLine[]>>({});
  const [deleting, setDeleting] = useState<CampaignGroup | null>(null);
  // Bumped after a change made outside the group view (Change a Destination
  // across groups), so the view reloads its rows.
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      setGroups(await campaignGroups.list());
    } catch (e) {
      setError(friendlyErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (isPartner) return;
    void load();
    void fetchCampaigns();
  }, [isPartner, load, fetchCampaigns]);

  // The picked group sits in the address (?group=<id>) so a refresh or a
  // shared link opens the same group; read once the page is in the browser.
  const [wanted, setWanted] = useState("");
  useEffect(() => {
    setWanted(new URLSearchParams(window.location.search).get("group") ?? "");
  }, []);
  const selected = useMemo(() => {
    if (!groups?.length) return null;
    return groups.find((g) => g.id === wanted) ?? groups[0];
  }, [groups, wanted]);

  const ungrouped = useMemo(() => {
    if (!groups) return [];
    const inGroup = new Set(groups.flatMap((g) => g.campaigns.map((c) => c.id)));
    return campaigns.filter((c) => c.status !== "archived" && !inGroup.has(c.id));
  }, [groups, campaigns]);

  if (isPartner) {
    return <EmptyState icon={Layers} title={t("cg.title")} description={t("cg.notAllowed")} />;
  }

  const pick = (id: string) => {
    setWanted(id);
    window.history.replaceState(null, "", `${ROUTES.campaigns}/groups?group=${id}`);
  };

  // The cross-group tool needs every group's lines; fetched when it opens.
  const openApply = async (start: ApplyStart) => {
    try {
      const entries = await Promise.all(
        (groups ?? []).map(async (g) => [g.id, g.campaigns.length ? await campaignGroups.destinations(g.id) : []] as const),
      );
      setApplyLines(Object.fromEntries(entries));
      setApply({ open: true, start });
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const name = deleting.name;
    try {
      await campaignGroups.remove(deleting.id);
      toast.success(fill(t("cg.deleted"), { name }));
      setDeleting(null);
      setWanted("");
      window.history.replaceState(null, "", `${ROUTES.campaigns}/groups`);
      void load();
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    }
  };

  // Back to Campaigns, and the group picker when there is more than one.
  const switcher = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Link href={ROUTES.campaigns} className="inline-flex items-center gap-1 text-accent hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("nav.campaigns")}
      </Link>
      <span className="text-muted-foreground">/</span>
      <span className="text-muted-foreground">{t("cg.title")}</span>
      {groups && groups.length > 1 && (
        <div className="ml-1 flex flex-wrap gap-1">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pick(g.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 transition-colors",
                g.id === selected?.id
                  ? "border-accent/50 bg-accent/10 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {g.name} <span className="text-muted-foreground">{g.campaigns.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {error ? (
        <EmptyState
          icon={Layers}
          title={t("cg.loadFailed")}
          description={error}
          actions={<Button size="sm" variant="outline" onClick={() => void load()}>{t("cg.retry")}</Button>}
        />
      ) : groups === null ? (
        <p className="text-sm text-muted-foreground">{t("cg.loading")}</p>
      ) : !selected ? (
        <EmptyState
          icon={Layers}
          title={t("cg.empty.title")}
          description={t("cg.empty.desc")}
          actions={
            canEdit ? (
              <Button size="sm" onClick={() => setEditor({ open: true, group: null })}>
                <Plus className="h-4 w-4" /> {t("cg.newGroup")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <GroupDetail
            key={`${selected.id}:${refresh}`}
            groupId={selected.id}
            switcher={switcher}
            onChanged={() => void load()}
            extraActions={
              canEdit ? (
                <>
                  {groups.length > 1 && (
                    <Button size="sm" variant="outline" onClick={() => void openApply({ action: "update" })}>
                      <SlidersHorizontal className="h-4 w-4" /> {t("cg.change")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditor({ open: true, group: null })}>
                    <Plus className="h-4 w-4" /> {t("cg.newGroup")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleting(selected)} aria-label={t("cg.delete")} title={t("cg.delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : undefined
            }
          />
          {ungrouped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {fill(t("cg.ungrouped"), { names: ungrouped.map((c) => localName(c.name)).join(", ") })}
            </p>
          )}
        </>
      )}

      <GroupEditorDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        group={editor.group}
        groups={groups ?? []}
        campaigns={campaigns}
        onSaved={() => void load()}
      />
      <ApplyChangeDialog
        open={apply.open}
        onOpenChange={(open) => setApply((s) => ({ ...s, open }))}
        groups={groups ?? []}
        linesByGroup={applyLines}
        start={apply.start}
        onApplied={() => {
          void load();
          setRefresh((n) => n + 1);
        }}
      />
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fill(t("cg.deleteTitle"), { name: deleting?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("cg.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cg.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>{t("cg.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

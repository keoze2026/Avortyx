"use client";

/**
 * Campaign Groups (CH-328; Sir, 28 Oct): 10-14 live campaigns and two or three
 * people to run them. A destination added, removed, or given a new priority
 * or weight is changed here once, in every campaign of the group(s) picked,
 * instead of campaign by campaign during the shift.
 *
 * Internal: publisher and buyer logins never get here (the server answers
 * them 403 too).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Layers, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ApplyChangeDialog, type ApplyStart } from "@/components/campaigns/groups/apply-change-dialog";
import { GroupEditorDialog } from "@/components/campaigns/groups/group-editor-dialog";
import { fill, StatusDot } from "@/components/campaigns/groups/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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

export default function CampaignGroupsPage() {
  const { t } = useTranslation();
  const localName = useLocalName();
  const { isPartner } = usePartnerPermissions();
  const staffCan = usePermissions().can;
  const canEdit = staffCan("campaigns", "edit-campaign");

  const campaigns = useCampaignsStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignsStore((s) => s.fetch);

  const [groups, setGroups] = useState<CampaignGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, GroupLine[]>>({});
  const [editor, setEditor] = useState<{ open: boolean; group: CampaignGroup | null }>({ open: false, group: null });
  const [apply, setApply] = useState<{ open: boolean; start: ApplyStart }>({ open: false, start: { action: "update" } });
  const [deleting, setDeleting] = useState<CampaignGroup | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await campaignGroups.list();
      setGroups(list);
      const entries = await Promise.all(
        list.map(async (g) => [g.id, g.campaigns.length ? await campaignGroups.destinations(g.id) : []] as const),
      );
      setLines(Object.fromEntries(entries));
    } catch (e) {
      setError(friendlyErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (isPartner) return;
    void load();
    void fetchCampaigns();
  }, [isPartner, load, fetchCampaigns]);

  const ungrouped = useMemo(() => {
    if (!groups) return [];
    const inGroup = new Set(groups.flatMap((g) => g.campaigns.map((c) => c.id)));
    return campaigns.filter((c) => c.status !== "archived" && !inGroup.has(c.id));
  }, [groups, campaigns]);

  if (isPartner) {
    return <EmptyState icon={Layers} title={t("cg.title")} description={t("cg.notAllowed")} />;
  }

  const openApply = (start: ApplyStart) => setApply({ open: true, start });

  const confirmDelete = async () => {
    if (!deleting) return;
    const name = deleting.name;
    try {
      await campaignGroups.remove(deleting.id);
      toast.success(fill(t("cg.deleted"), { name }));
      setDeleting(null);
      void load();
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={ROUTES.campaigns} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("nav.campaigns")}
        </Link>
      </div>
      <PageHeader
        title={t("cg.title")}
        description={t("cg.description")}
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!groups?.length} onClick={() => openApply({ action: "update" })}>
                <SlidersHorizontal className="h-4 w-4" /> {t("cg.change")}
              </Button>
              <Button size="sm" onClick={() => setEditor({ open: true, group: null })}>
                <Plus className="h-4 w-4" /> {t("cg.newGroup")}
              </Button>
            </div>
          ) : undefined
        }
      />

      {error ? (
        <EmptyState
          icon={Layers}
          title={t("cg.loadFailed")}
          description={error}
          actions={<Button size="sm" variant="outline" onClick={() => void load()}>{t("cg.retry")}</Button>}
        />
      ) : groups === null ? (
        <p className="text-sm text-muted-foreground">{t("cg.loading")}</p>
      ) : groups.length === 0 ? (
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
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.id} className="rounded-lg border bg-card">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-baseline gap-2">
                    {/* CH-415: each group has its own page in Sir's design. */}
                    <Link href={`${ROUTES.campaigns}/groups/${g.id}`} className="text-base font-semibold hover:underline">
                      {g.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {g.campaigns.length === 1 ? t("cg.campaignsCountOne") : fill(t("cg.campaignsCount"), { n: g.campaigns.length })}
                    </span>
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {g.campaigns.map((c) => (
                      <Link
                        key={c.id}
                        href={`${ROUTES.campaigns}/${c.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs hover:bg-muted/50"
                      >
                        <StatusDot status={c.status} /> {localName(c.name)}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`${ROUTES.campaigns}/groups/${g.id}`}>
                    <Button size="sm">
                      {t("x415.openGroup")} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openApply({ action: "add", groupIds: [g.id] })}>
                      <Plus className="h-4 w-4" /> {t("cg.apply.add")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditor({ open: true, group: g })} aria-label={t("cg.edit")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(g)} aria-label={t("cg.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                </div>
              </header>
              <GroupLines
                group={g}
                lines={lines[g.id]}
                canEdit={canEdit}
                onAction={(action, number) => openApply({ action, number, groupIds: [g.id] })}
              />
            </section>
          ))}
          {ungrouped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {fill(t("cg.ungrouped"), { names: ungrouped.map((c) => localName(c.name)).join(", ") })}
            </p>
          )}
        </div>
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
        linesByGroup={lines}
        start={apply.start}
        onApplied={() => void load()}
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

function GroupLines({
  group,
  lines,
  canEdit,
  onAction,
}: {
  group: CampaignGroup;
  lines: GroupLine[] | undefined;
  canEdit: boolean;
  onAction: (action: "add" | "update" | "remove", number: string) => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  if (group.campaigns.length === 0) return <p className="p-4 text-sm text-muted-foreground">{t("cg.noCampaigns")}</p>;
  if (!lines) return <p className="p-4 text-sm text-muted-foreground">{t("cg.loading")}</p>;
  if (lines.length === 0) return <p className="p-4 text-sm text-muted-foreground">{t("cg.noLines")}</p>;

  const values = (list: number[]) =>
    list.length === 1 ? (
      <span className="font-mono tabular-nums">{list[0]}</span>
    ) : (
      <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400" title={t("cg.mixed")}>
        {list.join(" / ")}
      </span>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t("cg.col.destination")}</th>
            <th className="px-4 py-2 font-medium">{t("cg.col.priority")}</th>
            <th className="px-4 py-2 font-medium">{t("cg.col.weight")}</th>
            <th className="px-4 py-2 font-medium">{t("cg.col.campaigns")}</th>
            {canEdit && <th className="px-4 py-2 text-right font-medium">{t("cg.col.actions")}</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const missing = l.missingIn.length > 0;
            return (
              <tr key={l.number} className="border-b last:border-b-0">
                <td className="px-4 py-2.5">
                  <div className="font-mono tabular-nums">{l.number}</div>
                  {l.buyerName && <div className="text-xs text-muted-foreground">{localName(l.buyerName)}</div>}
                </td>
                <td className="px-4 py-2.5">{values(l.priorities)}</td>
                <td className="px-4 py-2.5">{values(l.weights)}</td>
                <td className="px-4 py-2.5">
                  {/* CH-374, Sir 29 Oct: "Missing in - then long messages, I
                      don't understand this". The campaigns the destination IS
                      in, as the same chips the group header uses, and a short
                      count. The long "missing in ..." list is gone. */}
                  {missing ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {[...l.campaigns]
                        .sort((a, b) => a.campaignName.localeCompare(b.campaignName, undefined, { numeric: true }))
                        .map((c) => (
                          <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {localName(c.campaignName)}
                          </span>
                        ))}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {fill(t("cg.inSome"), { in: l.inCount, of: l.ofCount })}
                      </span>
                    </div>
                  ) : (
                    <span>{fill(t("cg.inAll"), { n: l.ofCount })}</span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onAction("update", l.number)} title={t("cg.action.editLine")} aria-label={t("cg.action.editLine")}>
                        <SlidersHorizontal className="h-4 w-4" />
                      </Button>
                      {missing && (
                        <Button size="sm" variant="ghost" onClick={() => onAction("add", l.number)} title={t("cg.action.addMissing")} aria-label={t("cg.action.addMissing")}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => onAction("remove", l.number)} title={t("cg.action.removeLine")} aria-label={t("cg.action.removeLine")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

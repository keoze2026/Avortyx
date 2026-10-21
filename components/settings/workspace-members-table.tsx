"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EditMemberDialog } from "./edit-member-dialog";
import { InviteMemberDialog } from "./invite-member-dialog";
import { Pagination } from "@/components/shared/pagination";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { workspaceService } from "@/lib/api/services/workspace.service";
import type { Member, MemberRole, MemberStatus } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";

/** Sir's order: Admin, Manager, Billing, Viewer, Publisher, Buyer, each group
 *  kept together. Billing is the billing login (a Viewer by role), shown right
 *  after the Managers. Other roles, custom ones included, sit with the Viewers. */
const ROLE_RANK: Record<string, number> = {
  admin: 0,
  reseller: 0,
  manager: 1,
  viewer: 3,
  agent: 3,
  publisher: 4,
  buyer: 5,
};
const BILLING_RANK = 2;
const OTHER_STAFF_RANK = 3;

function isBillingLogin(m: Member): boolean {
  return m.name.trim().toLowerCase() === "billing" || m.email.split("@")[0].toLowerCase() === "billing";
}

function memberRank(m: Member): number {
  if (m.role === "viewer" && isBillingLogin(m)) return BILLING_RANK;
  return ROLE_RANK[m.role] ?? OTHER_STAFF_RANK;
}

interface WorkspaceMembersTableProps {
  members: Member[];
  onMembersChange: (next: Member[]) => void;
  loading?: boolean;
}

export function WorkspaceMembersTable({ members, onMembersChange, loading = false }: WorkspaceMembersTableProps) {
  const { t } = useTranslation();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Member | null>(null);
  const [removing, setRemoving] = React.useState<Member | null>(null);
  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(0);
  React.useEffect(() => {
    setPage(0);
  }, [pageSize, members.length]);
  const ordered = React.useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          memberRank(a) - memberRank(b) || a.name.localeCompare(b.name),
      ),
    [members],
  );

  const onInvite = async ({ email, role }: { name?: string; email: string; role: MemberRole }) => {
    try {
      const created = await workspaceService.invite({ email, role });
      onMembersChange([created, ...members]);
      toast.success(t("y.members.invited").replace("{email}", created.email));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.err.inviteSend"));
    }
  };

  const onUpdate = async ({
    id,
    role,
    status,
  }: {
    id: string;
    name?: string;
    email?: string;
    role: MemberRole;
    status: MemberStatus;
  }) => {
    try {
      const updated = await workspaceService.updateMember(id, { role, status });
      onMembersChange(members.map((m) => (m.id === id ? updated : m)));
      toast.success(t("workspaceUI.members.updated").replace("{name}", updated.name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("y.err.memberUpdate"));
    }
  };

  const onRemove = async (m: Member) => {
    const prev = members;
    onMembersChange(members.filter((x) => x.id !== m.id));
    setRemoving(null);
    try {
      await workspaceService.remove(m.id);
      toast.success(t("workspaceUI.members.removed").replace("{name}", m.name));
    } catch (e) {
      onMembersChange(prev);
      toast.error(e instanceof Error ? e.message : t("y.err.memberRemove"));
    }
  };

  const activeCount = members.filter((m) => m.status === "active").length;
  const suspendedCount = members.filter((m) => m.status === "suspended").length;

  return (
    <>
      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border bg-secondary/20 px-4 py-3 space-y-0">
          <div>
            <CardTitle className="text-base">{t("workspaceUI.members.title")}</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("y.members.active").replace("{count}", String(activeCount))}{suspendedCount > 0 ? ` · ${t("y.members.suspendedCount").replace("{count}", String(suspendedCount))}` : ""}
            </p>
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> {t("workspaceUI.members.invite")}
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              <p className="text-xs text-muted-foreground">{t("y.members.loading")}</p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-sm font-semibold">{t("y.members.emptyTitle")}</h4>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  {t("y.members.emptyHint")}
                </p>
              </div>
            </div>
          ) : (
          <>
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-left">{t("workspaceUI.members.columnName")}</TableHead>
                  <TableHead className="text-left">{t("workspaceUI.members.columnEmail")}</TableHead>
                  <TableHead className="w-32 pl-6 text-left">{t("workspaceUI.members.columnRole")}</TableHead>
                  <TableHead className="w-32 text-center">{t("workspaceUI.members.columnStatus")}</TableHead>
                  <TableHead className="pr-4">{t("workspaceUI.members.columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered
                  .slice(page * pageSize, page * pageSize + pageSize)
                  .map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-4 text-left">
                      <div className="flex items-center gap-3">
                        {/* One colour for everyone: the portal's blue, as on the top bar. */}
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent ring-1 ring-accent/30">
                          {m.initials}
                        </span>
                        <span className="truncate text-sm font-medium">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-left font-mono text-[11px] text-muted-foreground">
                      {m.email}
                    </TableCell>
                    <TableCell className="w-32 pl-6 text-left">{t(`workspaceUI.members.role.${m.role}`)}</TableCell>
                    <TableCell className="w-32 text-center">
                      {/* One width for every status, so the boxes line up. */}
                      <Badge
                        variant={m.status === "active" ? "success" : "destructive"}
                        className="inline-flex w-24 justify-center"
                      >
                        {m.status === "active" ? t("y.members.statusActive") : t("y.members.statusSuspended")}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditing(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> {t("workspaceUI.members.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setRemoving(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {t("workspaceUI.members.remove")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {members.length > pageSize && (
            <div className="border-t border-border px-4 py-2.5">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={members.length}
                onPage={setPage}
                onPageSize={setPageSize}
              />
            </div>
          )}
          </>
          )}
        </CardContent>
      </Card>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvite={onInvite} />

      <EditMemberDialog
        member={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        onSave={onUpdate}
      />

      <AlertDialog open={removing !== null} onOpenChange={(next) => !next && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workspaceUI.members.removeConfirmTitle").replace("{name}", removing?.name ?? "")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("workspaceUI.members.removeConfirmDescription").replace("{name}", removing?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("workspaceUI.members.removeCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && onRemove(removing)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("workspaceUI.members.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
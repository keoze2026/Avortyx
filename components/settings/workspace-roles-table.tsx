"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck } from "lucide-react";

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
import { ROLES_IN_ORDER } from "@/lib/mock/settings";
import { ROUTES } from "@/lib/constants";
import { useWorkspaceMetaStore } from "@/lib/store/workspace-meta-store";
import {
  countEnabledPermissions,
  PERMISSION_GROUPS,
  seedForRole,
  TOTAL_PERMISSIONS,
} from "@/lib/workspace-permissions";

/** Every tick on the Roles screen, as the dotted keys the server stores. */
const ALL_KEYS = new Set(PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => `${g.id}.${p.id}`)));

/** How many of the 55 ticks a saved role has, or null when the server only
 *  has the old broad rights ("view", "edit", ...) that don't map to ticks.
 *  Counting those broad rights is what showed Manager as "7 / 55". */
function countTicks(caps: string[] | undefined): number | null {
  if (!caps || !caps.some((c) => c.includes("."))) return null;
  return caps.filter((c) => ALL_KEYS.has(c)).length;
}
import type { Member, MemberRole } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName } from "@/lib/i18n/local-name";

interface WorkspaceRolesTableProps {
  members: Member[];
}

export function WorkspaceRolesTable({ members }: WorkspaceRolesTableProps) {
  const router = useRouter();
  const { t } = useTranslation();

  // Count active members per role so the table tells the operator who has what.
  const memberCounts = useMemo<Record<MemberRole, number>>(() => {
    const counts: Record<MemberRole, number> = {
      admin: 0,
      manager: 0,
      agent: 0,
      buyer: 0,
      publisher: 0,
      viewer: 0,
    };
    for (const m of members) {
      if (m.status === "active") counts[m.role] += 1;
    }
    return counts;
  }, [members]);

  // Permission count per role — prefer the backend's authoritative
  // capabilities[] count when /api/accounts/roles has returned, otherwise
  // fall back to the FE-side seed so the table never blanks out.
  const backendRoles = useWorkspaceMetaStore((s) => s.roles);
  const permissionCounts = useMemo<Record<MemberRole, number>>(() => {
    const counts: Record<MemberRole, number> = {
      admin: 0,
      manager: 0,
      agent: 0,
      buyer: 0,
      publisher: 0,
      viewer: 0,
    };
    const beById = new Map(backendRoles.map((r) => [r.id, r]));
    for (const role of ROLES_IN_ORDER) {
      const saved = countTicks(beById.get(role)?.capabilities);
      counts[role] = saved ?? (role === "admin" ? TOTAL_PERMISSIONS : countEnabledPermissions(seedForRole(role)));
    }
    return counts;
  }, [backendRoles]);

  // Roles created with "New role" (not one of the built-in ones).
  const customRoles = useMemo(
    () => backendRoles.filter((r) => !r.isBuiltin && !(ROLES_IN_ORDER as string[]).includes(r.id)),
    [backendRoles],
  );

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border bg-secondary/20 px-4 py-3 space-y-0">
        <div>
          <CardTitle className="text-base">{t("workspaceUI.roles.title")}</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("workspaceUI.roles.description")}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => router.push(`${ROUTES.workspace}/roles/new`)}
        >
          <Plus className="h-3.5 w-3.5" /> {t("y.roles.new")}
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-left">{t("workspaceUI.roles.columnRole")}</TableHead>
                <TableHead className="text-left">{t("workspaceUI.roles.columnDescription")}</TableHead>
                <TableHead>{t("workspaceUI.roles.columnMembers")}</TableHead>
                <TableHead>{t("workspaceUI.roles.columnPermissions")}</TableHead>
                <TableHead className="pr-4">{t("workspaceUI.roles.columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES_IN_ORDER.map((role) => (
                <TableRow key={role}>
                  <TableCell className="pl-4 text-left">
                    <div className="inline-flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      {t(`workspaceUI.members.role.${role}`)}
                    </div>
                  </TableCell>
                  <TableCell className="text-left text-[12px] text-muted-foreground">
                    {t(`workspaceUI.roles.descriptions.${role}`)}
                  </TableCell>
                  <TableCell className="tabular-nums">{memberCounts[role]}</TableCell>
                  <TableCell className="tabular-nums">
                    {permissionCounts[role]} / {TOTAL_PERMISSIONS}
                  </TableCell>
                  <TableCell className="pr-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => router.push(`${ROUTES.workspace}/roles/${role}`)}
                    >
                      {t("workspaceUI.roles.edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {customRoles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4 text-left">
                    <div className="inline-flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                      <LocalName name={r.name} />
                    </div>
                  </TableCell>
                  <TableCell className="text-left text-[12px] text-muted-foreground">{r.description}</TableCell>
                  <TableCell className="tabular-nums">
                    {members.filter((m) => m.status === "active" && (m.role as string) === r.id).length}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {countTicks(r.capabilities) ?? 0} / {TOTAL_PERMISSIONS}
                  </TableCell>
                  <TableCell className="pr-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => router.push(`${ROUTES.workspace}/roles/${r.id}`)}
                    >
                      {t("workspaceUI.roles.edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

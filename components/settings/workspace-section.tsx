"use client";

import * as React from "react";
import {
  Activity,
  Building2,
  Clock,
  Inbox,
  Lock,
  Mail,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceAccessRequestsTable } from "./workspace-access-requests-table";
import { WorkspaceActivityLog } from "./workspace-activity-log";
import { WorkspaceMembersTable } from "./workspace-members-table";
import { WorkspaceRolesTable } from "./workspace-roles-table";
import {
  WorkspaceSupportRequestDialog,
  type SupportTopic,
} from "./workspace-support-request-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { workspaceService, type Workspace } from "@/lib/api/services/workspace.service";
import type { Member } from "@/lib/types";
import { useAuthStore } from "@/lib/store/auth-store";
import { useAutoScheduleStore } from "@/lib/store/auto-schedule-store";
import { TIMEZONES } from "@/lib/timezones";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

type TabId = "general" | "members" | "roles" | "access-requests" | "activity";

const TABS: Array<{ id: TabId; labelKey: string; fallbackLabel: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "general", labelKey: "workspaceUI.tabs.general", fallbackLabel: "General", icon: SettingsIcon },
  { id: "members", labelKey: "workspaceUI.tabs.members", fallbackLabel: "Members", icon: Users },
  { id: "roles", labelKey: "workspaceUI.tabs.roles", fallbackLabel: "Roles", icon: ShieldCheck },
  { id: "access-requests", labelKey: "workspaceUI.tabs.accessRequests", fallbackLabel: "Access requests", icon: Inbox },
  { id: "activity", labelKey: "workspaceUI.tabs.activity", fallbackLabel: "Activity", icon: Activity },
];

export function WorkspaceSection() {
  const { t } = useTranslation();
  const orgName = useAuthStore((s) => s.user?.organization ?? "");
  // The access-request queue is platform-wide: GET /api/accounts/access-
  // requests/ and approve/reject answer 401 to a customer org admin, so the
  // tab only exists for platform staff.
  const isPlatformStaff = useAuthStore((s) => s.user?.isStaff === true || s.user?.isSuperuser === true);
  const visibleTabs = isPlatformStaff ? TABS : TABS.filter((tab_) => tab_.id !== "access-requests");

  // Workspace is loaded once on mount. Until it arrives, the display name
  // falls back to the user's `organization` field (cached from /me) so the
  // form isn't blank during the first paint.
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [name, setName] = React.useState(orgName);
  const [savingWorkspace, setSavingWorkspace] = React.useState(false);

  // Portal timezone is the single source of truth for the auto-schedule runtime,
  // so write it straight to the auto-schedule store rather than local state.
  const tz = useAutoScheduleStore((s) => s.portalTimezone);
  const setTz = useAutoScheduleStore((s) => s.setPortalTimezone);

  // Members fetched on first switch to Members or Roles tab so the workspace
  // page is fast on initial paint.
  const [members, setMembers] = React.useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = React.useState(false);
  const membersLoadedRef = React.useRef(false);

  const [tab, setTab] = React.useState<TabId>("general");
  const [supportTopic, setSupportTopic] = React.useState<SupportTopic | null>(null);

  // Hydrate the workspace once.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ws = await workspaceService.get();
        if (cancelled) return;
        setWorkspace(ws);
        setName(ws.name);
      } catch {
        // Backend unavailable — keep the auth-store fallback name.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load members lazily — only when the Members or Roles tab is opened.
  React.useEffect(() => {
    if (tab !== "members" && tab !== "roles") return;
    if (membersLoadedRef.current) return;
    membersLoadedRef.current = true;
    setMembersLoading(true);
    void (async () => {
      try {
        const list = await workspaceService.listMembers();
        setMembers(list);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't load members");
        membersLoadedRef.current = false; // allow retry
      } finally {
        setMembersLoading(false);
      }
    })();
  }, [tab]);

  const saveWorkspace = async () => {
    setSavingWorkspace(true);
    try {
      const trimmed = name.trim();
      const updated = await workspaceService.update({ name: trimmed });
      setWorkspace(updated);
      setName(updated.name);
      toast.success(t("workspaceUI.identity.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingWorkspace(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Underline-style tab strip — matches the Campaign Settings + Call Summary tabs. */}
      <div className="no-scrollbar flex overflow-x-auto border-b border-border">
        {visibleTabs.map((tab_) => {
          const Icon = tab_.icon;
          const active = tab === tab_.id;
          // If the i18n key is missing, t() returns the key itself — fall back
          // to a plain English label so new tabs don't render the raw key.
          const translated = t(tab_.labelKey);
          const label = translated === tab_.labelKey ? tab_.fallbackLabel : translated;
          return (
            <button
              key={tab_.id}
              type="button"
              onClick={() => setTab(tab_.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none",
                active
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-0.5 bg-accent"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── General: Identity + Danger zone ─── */}
      {tab === "general" && (
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("workspaceUI.identity.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ws-name" className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    {t("workspaceUI.identity.displayName")}
                  </Label>
                  <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {t("workspaceUI.identity.defaultTimezone")}
                  </Label>
                  <Select value={tz} onValueChange={setTz}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {TIMEZONES.map((z) => (
                        <SelectItem key={z.iana} value={z.iana}>
                          {z.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setName(workspace?.name ?? orgName)}
                  disabled={savingWorkspace}
                >
                  {t("workspaceUI.identity.cancel")}
                </Button>
                <Button onClick={saveWorkspace} disabled={savingWorkspace || !name.trim()}>
                  {savingWorkspace ? "Saving…" : t("workspaceUI.identity.save")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-destructive">{t("workspaceUI.danger.title")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("workspaceUI.danger.description")}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Transfer ownership — locked behind a support gate so
                  attackers / fraudulent buyers can't quietly hand off the
                  workspace after spinning up a clean KYC. */}
              <LockedDangerRow
                title={t("workspaceUI.danger.transferTitle")}
                description={t("workspaceUI.danger.transferDescription")}
                lockedLabel={t("workspaceUI.danger.lockedBadge")}
                lockedHint={t("workspaceUI.danger.lockedHint")}
                contactLabel={t("workspaceUI.danger.contactSupport")}
                onContact={() => setSupportTopic("transfer-ownership")}
              />
              {/* Delete workspace — same lock for the same reason. Wiping a
                  panel out from under the owner needs explicit verification. */}
              <LockedDangerRow
                title={t("workspaceUI.danger.deleteTitle")}
                description={t("workspaceUI.danger.deleteDescription")}
                lockedLabel={t("workspaceUI.danger.lockedBadge")}
                lockedHint={t("workspaceUI.danger.lockedHint")}
                contactLabel={t("workspaceUI.danger.contactSupport")}
                onContact={() => setSupportTopic("delete-workspace")}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "members" && (
        <WorkspaceMembersTable
          members={members}
          onMembersChange={setMembers}
          loading={membersLoading}
        />
      )}

      {tab === "roles" && <WorkspaceRolesTable members={members} />}

      {tab === "access-requests" && isPlatformStaff && <WorkspaceAccessRequestsTable />}

      {tab === "activity" && <WorkspaceActivityLog />}

      <WorkspaceSupportRequestDialog
        topic={supportTopic}
        onOpenChange={(open) => !open && setSupportTopic(null)}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  LockedDangerRow                                                     */
/*  ----------------------------------------------------------------    */
/*  A danger-zone row whose destructive action is gated behind a        */
/*  "Contact support" hand-off. The row shows a lock icon, a "Locked"   */
/*  badge, and a hint explaining why. The button itself doesn't perform */
/*  the action — clicking it fires `onContact` (we treat that as the    */
/*  user opening a support ticket / dispatching an email).              */
/* ─────────────────────────────────────────────────────────────────── */

function LockedDangerRow({
  title,
  description,
  lockedLabel,
  lockedHint,
  contactLabel,
  onContact,
}: {
  title: string;
  description: string;
  lockedLabel: string;
  lockedHint: string;
  contactLabel: string;
  onContact: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Lock className="h-2.5 w-2.5" />
            {lockedLabel}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        <div className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground/85">
          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/70" />
          <span>{lockedHint}</span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onContact}
        className="shrink-0"
      >
        <Mail className="h-3.5 w-3.5" />
        {contactLabel}
      </Button>
    </div>
  );
}

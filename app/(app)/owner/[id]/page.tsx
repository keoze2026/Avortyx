"use client";

/**
 * Owner — one organization's page (CH-675, Sir 13 Nov: "Org page - the
 * updated version with more details").
 *
 * Header: name, Main badge, slug and health; Message client, Adjust balance,
 * Open their portal (read-only, every view in the audit log), and the other
 * actions of the list (Edit rates & fees, Suspend / Activate, Delete).
 * Tabs: Overview, Traffic, Numbers, Caller & TFN lookup, Users, Billing.
 * Owner only, like the list. Backend: /api/owner/organizations/{id}/...
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MoreHorizontal, ShieldX, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { errText, useOrgActions } from "@/components/owner/org-actions";
import { HEALTH_KEY, HEALTH_STYLE, MainBadge, OrgTile, type Health } from "@/components/owner/org-format";
import {
  BillingTab,
  LookupTab,
  NumbersTab,
  OverviewTab,
  TrafficTab,
  UsersTab,
  type OrgUser,
  type Overview,
} from "@/components/owner/org-tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBreadcrumbOverride } from "@/hooks/use-breadcrumb-override";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { formatRelativeTime } from "@/lib/format";
import { LocalName } from "@/lib/i18n/local-name";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

/** Underlined tabs, as on Sir's design. */
const TAB =
  "-mb-px h-auto flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-1 text-sm font-normal text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-foreground dark:data-[state=active]:bg-transparent";

interface Detail {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  maxConcurrentCalls: number;
  isMainAccount: boolean;
  tfnRisk: string;
  billing: Record<string, string>;
  users: OrgUser[];
}

type TabId = "overview" | "traffic" | "numbers" | "lookup" | "users" | "billing";

export default function OrganizationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const isSuperuser = useAuthStore((s) => s.user?.isSuperuser === true);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [reloadKey, setReloadKey] = useState(0);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [d, o] = await Promise.all([
        http.get<Detail>(`/api/owner/organizations/${id}`),
        http.get<Overview>(`/api/owner/organizations/${id}/overview`),
      ]);
      setDetail(d);
      setOverview(o);
    } catch (e) {
      setMissing(true);
      toast.error(errText(e));
    }
  }, [id]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
    void load();
  }, [load]);
  const actions = useOrgActions(reload, () => router.push("/owner"));

  useEffect(() => {
    if (isSuperuser) void load();
  }, [isSuperuser, load]);

  useBreadcrumbOverride(detail?.name);

  if (!isSuperuser) {
    return (
      <div className="mx-auto w-full max-w-[560px] pt-24 text-center">
        <ShieldX className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">{t("owner.notYours.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("owner.notYours.body")}</p>
      </div>
    );
  }

  if (missing && !detail) {
    return (
      <div className="mx-auto w-full max-w-[560px] pt-24 text-center text-sm text-muted-foreground">
        <Link href="/owner" className="text-accent hover:underline">← {t("owner.orgs.title")}</Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  const org = { id: detail.id, name: detail.name, isActive: detail.isActive };
  const health: Health = overview?.health ?? (detail.isActive ? "ok" : "suspended");
  // Our own account: the buttons are there, but there is no client to
  // message and no portal to open (the server refuses both).
  const own = detail.isMainAccount;
  const canView = !own && detail.isActive;
  const viewTitle = own ? t("x675.view.ownAccount") : detail.isActive ? undefined : t("x675.view.suspended");

  async function openPortal() {
    // Opened at once (inside the click), filled once the pass arrives - a
    // tab opened after a wait is blocked as a pop-up.
    const w = window.open("about:blank", "_blank");
    setOpening(true);
    try {
      const r = await http.post<{ access: string; minutes: number; account: string }>(
        `/api/owner/organizations/${detail!.id}/view-token`,
        { body: {} },
      );
      const until = Date.now() + r.minutes * 60_000;
      const url =
        `${window.location.origin}/owner-view#t=${encodeURIComponent(r.access)}` +
        `&a=${encodeURIComponent(r.account)}&u=${until}`;
      if (w) {
        w.opener = null;
        w.location.href = url;
      } else {
        toast.error(t("x675.view.popupBlocked"));
      }
    } catch (e) {
      w?.close();
      toast.error(errText(e));
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/owner" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("owner.orgs.title")}
        </Link>
        <span aria-hidden>/</span>
        <LocalName name={detail.name} />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <OrgTile name={detail.name} className="h-11 w-11 text-sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                <LocalName name={detail.name} />
              </h1>
              {detail.isMainAccount && <MainBadge t={t} />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono">{detail.slug}</span>
              <span aria-hidden>·</span>
              <span className={cn("inline-flex items-center gap-1", HEALTH_STYLE[health])}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                {t(HEALTH_KEY[health])}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => actions.openMessage(org)}
            disabled={own}
            title={own ? t("x675.view.ownAccount") : undefined}
          >
            {t("x675.message.title")}
          </Button>
          <Button variant="outline" onClick={() => actions.openMoney(org, "credit")}>
            {t("x675.adjustBalance")}
          </Button>
          <Button onClick={openPortal} disabled={!canView || opening} title={viewTitle}>
            {t("x675.view.open")} <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("x675.actions")} title={t("x675.actions")}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.openFees(org)}>{t("owner.orgs.editRates")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.openMoney(org, "credit")}>{t("owner.orgs.credit")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.openMoney(org, "debit")}>{t("owner.orgs.debit")}</DropdownMenuItem>
              <DropdownMenuItem className={org.isActive ? "text-destructive" : ""} onClick={() => actions.openSuspend(org)}>
                {org.isActive ? t("owner.orgs.suspend") : t("owner.orgs.activate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => actions.openDelete(org)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("owner.orgs.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2.5 text-[13px] sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
          <span>
            {t("x675.view.ownerView")} {t("x675.view.note")}
          </span>
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {t("x675.lastCall")}{" "}
          {overview?.lastCallAt ? formatRelativeTime(new Date(overview.lastCallAt).getTime()) : t("x675.us.never")}
        </span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-6 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="overview" className={TAB}>{t("x675.tab.overview")}</TabsTrigger>
          <TabsTrigger value="traffic" className={TAB}>{t("x675.tab.traffic")}</TabsTrigger>
          <TabsTrigger value="numbers" className={TAB}>{t("x675.tab.numbers")}</TabsTrigger>
          <TabsTrigger value="lookup" className={TAB}>{t("x675.tab.lookup")}</TabsTrigger>
          <TabsTrigger value="users" className={TAB}>{t("x675.tab.users")}</TabsTrigger>
          <TabsTrigger value="billing" className={TAB}>{t("x675.tab.billing")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-5">
          <OverviewTab data={overview} />
        </TabsContent>
        <TabsContent value="traffic" className="mt-5">
          {tab === "traffic" && <TrafficTab orgId={detail.id} />}
        </TabsContent>
        <TabsContent value="numbers" className="mt-5">
          {tab === "numbers" && <NumbersTab orgId={detail.id} />}
        </TabsContent>
        <TabsContent value="lookup" className="mt-5">
          <LookupTab />
        </TabsContent>
        <TabsContent value="users" className="mt-5">
          <UsersTab users={detail.users} />
        </TabsContent>
        <TabsContent value="billing" className="mt-5">
          {tab === "billing" && (
            <BillingTab
              orgId={detail.id}
              billing={detail.billing}
              tfnRisk={detail.tfnRisk}
              callLimit={detail.maxConcurrentCalls}
              isMain={detail.isMainAccount}
              onEditRates={() => actions.openFees(org)}
              onAdjust={() => actions.openMoney(org, "credit")}
              reloadKey={reloadKey}
            />
          )}
        </TabsContent>
      </Tabs>

      {actions.dialogs}
    </div>
  );
}

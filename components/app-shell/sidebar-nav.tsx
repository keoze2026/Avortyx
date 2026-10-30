"use client";

/**
 * Avortyx sidebar (CH-424, Sir's sidebar design, 30 Oct).
 *
 * Our logo and wordmark stay; from Workspace down it follows the design:
 *   - plain group headings (Overview, Traffic, Network, Suppression,
 *     Insights, Markets, Account) and a soft pill for the open page
 *   - Live Monitor carries a full "● LIVE" pill instead of a green dot
 *   - the account at the foot: initials, "My account" and the role
 *   - collapsed: icons only, a line between groups, and a tooltip with the
 *     page name and its shortcut (G then a key: G R = Reports)
 *   - no drag strip on the edge: the button by the logo opens and closes it
 * The old footer's "247 active · 14 ms" were fixed numbers, not live - gone.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, CreditCard, LogOut, PanelLeft, Settings, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/use-translation";
import { BRAND, ROUTES } from "@/lib/constants";
import { usePermissions } from "@/lib/my-permissions";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { tFor } from "@/lib/i18n";
import { NAV_GROUPS, type NavItem } from "@/lib/nav";
import { useAuthStore } from "@/lib/store/auth-store";
import { useLocaleStore } from "@/lib/store/locale-store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

function isVisibleForRole(item: NavItem, role: Role | undefined, isSuperuser: boolean) {
  if (!role) return false;
  // Owner-only entries never render for anyone else - the item simply does
  // not exist in a workspace admin's sidebar, same as partner-hidden pages.
  if (item.superuserOnly && !isSuperuser) return false;
  return item.roles.includes(role);
}

/** Typing in a field never triggers a shortcut. */
function typingIn(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const isSuperuser = useAuthStore((s) => s.user?.isSuperuser === true);
  // Workspace role permissions (employees only): an area with nothing ticked
  // is left out of the menu, and opening its page directly goes back to the
  // Dashboard. Until the backend sends permissions, nothing changes.
  const { canSeePath } = usePermissions();
  // Buyer / publisher logins: an item tied to one of their Permissions toggles
  // (Blocked Numbers <- Block Numbers) shows only while that toggle is on.
  const partner = usePartnerPermissions();
  React.useEffect(() => {
    if (!canSeePath(pathname)) {
      toast.error(tFor(useLocaleStore.getState().locale, "x5.sidebar.noAccess"));
      router.replace(ROUTES.dashboard);
    }
  }, [pathname, canSeePath, router]);
  const { state, isMobile, setOpenMobile } = useSidebar();
  // On a phone the menu closes once a page is chosen (CH-231): the button
  // only opens it now, so it must not stay open over the new page.
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);
  const collapsed = state === "collapsed";
  const { t } = useTranslation();

  const groups = NAV_GROUPS.map((group) => ({
    group,
    visible: group.items.filter(
      (i) =>
        isVisibleForRole(i, role, isSuperuser) &&
        canSeePath(i.href) &&
        (!i.partnerPermission || !partner.isPartner || partner.can(i.partnerPermission)),
    ),
  })).filter((g) => g.visible.length > 0);

  // G then a key opens a page (G R = Reports) - only pages this login sees.
  const shortcuts = React.useRef<Record<string, string>>({});
  shortcuts.current = Object.fromEntries(
    groups.flatMap((g) => g.visible.filter((i) => i.shortcut).map((i) => [i.shortcut!.toLowerCase(), i.href] as const)),
  );
  React.useEffect(() => {
    let armed = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return;
      const key = e.key.toLowerCase();
      if (armed && Date.now() - armed < 1200) {
        armed = 0;
        const href = shortcuts.current[key];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      armed = key === "g" ? Date.now() : 0;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="!bg-sidebar">
      <SidebarHeader className="p-0">
        <BrandHeader collapsed={collapsed && !isMobile} />
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3 pb-3 group-data-[collapsible=icon]:px-1.5">
        {groups.map(({ group, visible }, idx) => (
          <section key={group.label ?? `g-${idx}`} className="pt-3 first:pt-1 group-data-[collapsible=icon]:pt-0">
            {/* Collapsed: a thin line between groups. */}
            {idx > 0 && (
              <div aria-hidden className="mx-2 my-2 hidden h-px bg-sidebar-border group-data-[collapsible=icon]:block" />
            )}
            {group.label && (
              <div className="px-2.5 pb-1.5 text-[11px] font-medium text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
                {group.labelKey ? t(group.labelKey) : group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {visible.map((item) => {
                // Owner and Owner > Carrier Costs share a prefix: the longer match wins.
                const active =
                  (pathname === item.href || pathname.startsWith(`${item.href}/`)) &&
                  !visible.some(
                    (o) =>
                      o.href.length > item.href.length &&
                      (pathname === o.href || pathname.startsWith(`${o.href}/`)),
                  );
                return <SidebarItem key={item.href} item={item} active={active} collapsed={collapsed && !isMobile} />;
              })}
            </ul>
          </section>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <AccountFooter collapsed={collapsed && !isMobile} />
      </SidebarFooter>
    </Sidebar>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function BrandHeader({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { toggleSidebar, isMobile } = useSidebar();
  const toggle = (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={collapsed ? t("x424.expand") : t("x424.collapse")}
      title={collapsed ? t("x424.expand") : t("x424.collapse")}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
  return (
    <div className="flex flex-col gap-1 px-3 pt-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
      <div className="flex h-10 items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
        <Link href="/dashboard" aria-label={BRAND.name} className="flex min-w-0 items-center gap-2">
          <Logo className="h-6 w-6 shrink-0" />
          {!collapsed && (
            <span
              className="truncate text-base font-bold tracking-tight"
              style={{
                // Reads the theme ramp rather than fixed hexes, so the wordmark
                // tracks the selected accent like the mark beside it already did.
                background:
                  "linear-gradient(120deg, var(--vortyx-deep, #2A3F6B) 0%, var(--vortyx-teal, #4F8CFF) 55%, var(--vortyx-bright, #7FAEFF) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {BRAND.name}
            </span>
          )}
        </Link>
        {!collapsed && !isMobile && toggle}
      </div>
      {collapsed && !isMobile && toggle}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function LivePill() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-[color:var(--success)] group-data-[collapsible=icon]:hidden">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      {t("sharedUI.liveBadge.live")}
    </span>
  );
}

function SidebarItem({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const { t } = useTranslation();
  const label = t(item.nameKey);
  const live = item.badge === "Live";

  const link = (
    <Link
      href={item.href}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-8 items-center gap-3 rounded-lg px-2.5 transition-colors",
        "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
        active
          ? "bg-[color:var(--nav-active-bg)] font-medium text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "opacity-80")} />
      <span className="flex-1 truncate text-[13px] group-data-[collapsible=icon]:hidden">{label}</span>
      {live && <LivePill />}
      {/* Collapsed: the live page keeps a small green dot on its icon. */}
      {live && (
        <span className="absolute right-1.5 top-1.5 hidden h-1.5 w-1.5 rounded-full bg-[color:var(--success)] group-data-[collapsible=icon]:block" />
      )}
    </Link>
  );

  if (!collapsed) return <li>{link}</li>;
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="flex items-center gap-2">
          {label}
          {item.shortcut && (
            <kbd className="rounded border border-border/60 px-1 font-mono text-[10px] text-muted-foreground">
              G {item.shortcut}
            </kbd>
          )}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 1)).toUpperCase();
}

/** The signed-in account at the foot: initials, "My account" and the role. */
function AccountFooter({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  if (!user) return null;

  const roleLabel = user.isSuperuser
    ? t("x424.role.owner")
    : user.role === "buyer"
      ? t("x424.role.buyer")
      : user.role === "publisher"
        ? t("x424.role.publisher")
        : t("x424.role.admin");

  const onLogout = () => {
    logout();
    toast.success(t("userMenu.signedOut"));
    router.push(ROUTES.login);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("x424.myAccount")}
          className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent/60 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {initials(user.name || user.email || "")}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-foreground">{t("x424.myAccount")}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{roleLabel}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className="w-60">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{user.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(ROUTES.settings)}>
          <UserIcon className="h-4 w-4" /> {t("userMenu.profile")}
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem onSelect={() => router.push(ROUTES.billing)}>
            <CreditCard className="h-4 w-4" /> {t("userMenu.billing")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => router.push(ROUTES.settings)}>
          <Settings className="h-4 w-4" /> {t("userMenu.settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> {t("userMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

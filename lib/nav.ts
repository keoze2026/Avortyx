/**
 * Navigation configuration for the authenticated app shell.
 * Group → items. Each item has a `roles` allowlist for RBAC.
 *
 * `nameKey` / `labelKey` are dotted i18n keys resolved by `useTranslation()`
 * at render time. The literal English `label` stays as a fallback for code
 * paths that read the nav without an active translation context (e.g. the
 * breadcrumb lookup table).
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Radio,
  Megaphone,
  Hash,
  GitFork,
  Building2,
  Briefcase,
  Target,
  Users,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  BarChart3,
  Store,
  Sparkles,
  Palette,
  Plug,
  CreditCard,
  Settings,
  Shield,
  ShieldAlert,
  PhoneOff,
  Bitcoin,
  Newspaper,
  Gift,
  ScanFace,
} from "lucide-react";

import { ROUTES } from "./constants";
import type { Role } from "./types/auth";

export interface NavItem {
  /** English fallback used by code that runs outside React (breadcrumbs etc.). */
  label: string;
  /** Dotted translation key under `nav.*`. */
  nameKey: string;
  href: string;
  icon: LucideIcon;
  roles: readonly Role[];
  /** Optional badge text (e.g. "Live", "New") */
  badge?: string;
}

export interface NavGroup {
  /** English fallback for the group heading. */
  label?: string;
  /** Dotted translation key under `nav.section.*`. */
  labelKey?: string;
  items: NavItem[];
}

const ALL_ROLES = ["admin", "buyer", "publisher"] as const;

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Workspace", nameKey: "nav.workspace", href: ROUTES.workspace, icon: Briefcase, roles: ["admin"] },
    ],
  },
  {
    label: "Overview",
    labelKey: "nav.section.overview",
    items: [
      { label: "Dashboard",    nameKey: "nav.dashboard",   href: ROUTES.dashboard, icon: LayoutDashboard, roles: ALL_ROLES },
      { label: "Live Monitor", nameKey: "nav.liveMonitor", href: ROUTES.live,      icon: Radio,           roles: ALL_ROLES, badge: "Live" },
      { label: "Reports",      nameKey: "nav.reports",     href: ROUTES.reports,   icon: BarChart3,       roles: ALL_ROLES },
    ],
  },
  {
    label: "Traffic",
    labelKey: "nav.section.traffic",
    items: [
      { label: "Campaigns",     nameKey: "nav.campaigns",    href: ROUTES.campaigns, icon: Megaphone,       roles: ["admin", "publisher"] },
      { label: "Phone Numbers", nameKey: "nav.phoneNumbers", href: ROUTES.numbers,   icon: Hash,            roles: ["admin"] },
      { label: "Routing",       nameKey: "nav.routing",      href: ROUTES.routing,   icon: GitFork,         roles: ["admin"] },
      { label: "IVR",           nameKey: "nav.ivr",          href: ROUTES.ivr,       icon: PhoneForwarded,  roles: ["admin"] },
      { label: "Call Queue",    nameKey: "nav.callQueue",    href: ROUTES.queue,     icon: PhoneIncoming,   roles: ["admin"] },
    ],
  },
  {
    label: "Network",
    labelKey: "nav.section.network",
    items: [
      { label: "Buyers",       nameKey: "nav.buyers",       href: ROUTES.buyers,       icon: Building2, roles: ["admin", "buyer"] },
      { label: "Destinations", nameKey: "nav.destinations", href: ROUTES.destinations, icon: Target,    roles: ["admin", "buyer"] },
      { label: "Publishers",   nameKey: "nav.publishers",   href: ROUTES.publishers,   icon: Users,     roles: ["admin", "publisher"] },
    ],
  },
  {
    label: "Suppression List",
    labelKey: "nav.section.suppressionList",
    items: [
      { label: "VoIP Shield",     nameKey: "nav.voipShield",     href: ROUTES.voipShield,     icon: Shield,      roles: ["admin"] },
      { label: "TCPA Shield",     nameKey: "nav.tcpaShield",     href: ROUTES.tcpaShield,     icon: ShieldAlert, roles: ["admin"] },
      { label: "Blocked Numbers", nameKey: "nav.blockedNumbers", href: ROUTES.blockedNumbers, icon: PhoneOff,    roles: ["admin"] },
    ],
  },
  {
    label: "Insights",
    labelKey: "nav.section.insights",
    items: [
      { label: "Call Logs",   nameKey: "nav.callLogs",    href: ROUTES.calls,       icon: PhoneCall, roles: ALL_ROLES },
      { label: "Marketplace", nameKey: "nav.marketplace", href: ROUTES.marketplace, icon: Store,     roles: ["admin", "buyer"] },
      { label: "AI Insights", nameKey: "nav.aiInsights",  href: ROUTES.insights,    icon: Sparkles,  roles: ["admin"], badge: "AI" },
    ],
  },
  {
    label: "News",
    labelKey: "nav.section.news",
    items: [
      { label: "Coin Market", nameKey: "nav.coinMarket", href: ROUTES.cryptoNews, icon: Bitcoin,   roles: ALL_ROLES },
      { label: "Daily News",  nameKey: "nav.dailyNews",  href: ROUTES.dailyNews,  icon: Newspaper, roles: ALL_ROLES },
    ],
  },
  {
    label: "Account",
    labelKey: "nav.section.account",
    items: [
      { label: "Referrals",    nameKey: "nav.referrals",    href: ROUTES.referrals,    icon: Gift,        roles: ALL_ROLES },
      { label: "Trust Engine", nameKey: "nav.trustEngine",  href: ROUTES.kyc,          icon: ScanFace,    roles: ALL_ROLES },
      { label: "Integrations", nameKey: "nav.integrations", href: ROUTES.integrations, icon: Plug,        roles: ["admin"] },
      { label: "White Label",  nameKey: "nav.whiteLabel",   href: ROUTES.whiteLabel,   icon: Palette,     roles: ["admin"] },
      { label: "Billing",      nameKey: "nav.billing",      href: ROUTES.billing,      icon: CreditCard,  roles: ["admin"] },
      { label: "Settings",     nameKey: "nav.settings",     href: ROUTES.settings,     icon: Settings,    roles: ALL_ROLES },
    ],
  },
];

/** Flat lookup table for breadcrumb labels (English fallback). */
export const NAV_LABEL_BY_PATH: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.href, i.label] as const)),
);

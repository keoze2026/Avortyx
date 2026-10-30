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
// CH-419 (Sir, 30 Oct): sidebar icons from his reference picture where ours
// differed; every other icon unchanged.
import {
  Crown,
  Landmark,
  Send,
  LayoutGrid,
  Radio,
  Megaphone,
  Hash,
  SearchCheck,
  GitFork,
  Building,
  Briefcase,
  Target,
  Users,
  Phone,
  List,
  BarChart3,
  Store,
  Sparkle,
  Palette,
  Plug,
  CreditCard,
  Cog,
  Shield,
  ShieldCheck,
  Ban,
  FileText,
  Bitcoin,
  Newspaper,
  Gift,
  ScanFace,
  CirclePlay,
} from "lucide-react";

import { ROUTES } from "./constants";
import type { Role } from "./types/auth";
import type { PartnerPermissionKey } from "@/hooks/use-partner-permissions";

export interface NavItem {
  /** Shown only to the system owner (is_superuser), whatever the role says. */
  superuserOnly?: boolean;
  /** English fallback used by code that runs outside React (breadcrumbs etc.). */
  label: string;
  /** Dotted translation key under `nav.*`. */
  nameKey: string;
  href: string;
  icon: LucideIcon;
  roles: readonly Role[];
  /** Buyer / publisher logins see the item only when the admin turned this toggle on for them. */
  partnerPermission?: PartnerPermissionKey;
  /** Optional badge text (e.g. "Live", "New") */
  badge?: string;
  /** CH-424: keyboard shortcut - press G, then this key (shown in the
   *  collapsed sidebar's tooltip, e.g. "G R" for Reports). */
  shortcut?: string;
}

export interface NavGroup {
  /** English fallback for the group heading. */
  label?: string;
  /** Dotted translation key for the group heading. */
  labelKey?: string;
  items: NavItem[];
}

const ALL_ROLES = ["admin", "buyer", "publisher"] as const;

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Workspace", nameKey: "nav.workspace", href: ROUTES.workspace, icon: Building, roles: ["admin"], shortcut: "W" },
      // Sir, 27 Oct: the demo video, right below Workspace.
      { label: "Getting Started", nameKey: "nav.gettingStarted", href: ROUTES.gettingStarted, icon: CirclePlay, roles: ["admin"] },
    ],
  },
  {
    label: "Overview",
    labelKey: "x424.section.overview",
    items: [
      { label: "Dashboard",    nameKey: "nav.dashboard",   href: ROUTES.dashboard, icon: LayoutGrid, roles: ALL_ROLES, shortcut: "D" },
      { label: "Live Monitor", nameKey: "nav.liveMonitor", href: ROUTES.live,      icon: Radio,           roles: ALL_ROLES, badge: "Live", shortcut: "L" },
      { label: "Reports",      nameKey: "nav.reports",     href: ROUTES.reports,   icon: BarChart3,       roles: ALL_ROLES, shortcut: "R" },
      // CH-261 (Sir, 25 Oct): every automated report in one place.
      { label: "Automated Report", nameKey: "nav.automatedReports", href: ROUTES.automatedReports, icon: Send, roles: ["admin"], shortcut: "A" },
    ],
  },
  {
    label: "Traffic",
    labelKey: "x424.section.traffic",
    items: [
      { label: "Campaigns",     nameKey: "nav.campaigns",    href: ROUTES.campaigns, icon: Megaphone,       roles: ["admin", "publisher"], shortcut: "C" },
      { label: "Phone Numbers", nameKey: "nav.phoneNumbers", href: ROUTES.numbers,   icon: Hash,            roles: ["admin"], shortcut: "N" },
      // Publishers see it only with "TFN Test Calls" on in their Publisher Access (CH-240).
      { label: "TFN Check",     nameKey: "nav.tfnCheck",     href: ROUTES.tfnCheck,  icon: SearchCheck,     roles: ["admin", "publisher"], partnerPermission: "tfn_test", shortcut: "T" },
      { label: "Routing",       nameKey: "nav.routing",      href: ROUTES.routing,   icon: GitFork,         roles: ["admin"], shortcut: "O" },
      { label: "IVR",           nameKey: "nav.ivr",          href: ROUTES.ivr,       icon: Phone,  roles: ["admin"], shortcut: "I" },
      { label: "Call Queue",    nameKey: "nav.callQueue",    href: ROUTES.queue,     icon: List,   roles: ["admin"], shortcut: "Q" },
    ],
  },
  {
    label: "Network",
    labelKey: "x424.section.network",
    items: [
      { label: "Buyers",       nameKey: "nav.buyers",       href: ROUTES.buyers,       icon: Briefcase, roles: ["admin", "buyer"], shortcut: "B" },
      { label: "Destinations", nameKey: "nav.destinations", href: ROUTES.destinations, icon: Target,    roles: ["admin", "buyer"], shortcut: "E" },
      { label: "Publishers",   nameKey: "nav.publishers",   href: ROUTES.publishers,   icon: Users,     roles: ["admin", "publisher"], shortcut: "P" },
    ],
  },
  {
    label: "Suppression",
    labelKey: "x424.section.suppression",
    items: [
      { label: "VoIP Shield",     nameKey: "nav.voipShield",     href: ROUTES.voipShield,     icon: Shield,      roles: ["admin"], shortcut: "V" },
      { label: "TCPA Shield",     nameKey: "nav.tcpaShield",     href: ROUTES.tcpaShield,     icon: ShieldCheck, roles: ["admin"] },
      { label: "Blocked Numbers", nameKey: "nav.blockedNumbers", href: ROUTES.blockedNumbers, icon: Ban,    roles: ["admin", "publisher"], partnerPermission: "block_numbers", shortcut: "K" },
    ],
  },
  {
    label: "Insights",
    labelKey: "x424.section.insights",
    items: [
      { label: "Call Logs",   nameKey: "nav.callLogs",    href: ROUTES.calls,       icon: FileText, roles: ALL_ROLES },
      { label: "Marketplace", nameKey: "nav.marketplace", href: ROUTES.marketplace, icon: Store,     roles: ["admin", "buyer"], shortcut: "M" },
      { label: "AI Insights", nameKey: "nav.aiInsights",  href: ROUTES.insights,    icon: Sparkle,  roles: ["admin"] },
    ],
  },
  {
    label: "Markets",
    labelKey: "x424.section.markets",
    items: [
      { label: "Coin Market", nameKey: "nav.coinMarket", href: ROUTES.cryptoNews, icon: Bitcoin,   roles: ALL_ROLES },
      { label: "Daily News",  nameKey: "nav.dailyNews",  href: ROUTES.dailyNews,  icon: Newspaper, roles: ALL_ROLES },
    ],
  },
  {
    label: "Account",
    labelKey: "x424.section.account",
    items: [
      // CH-424 (Sir's sidebar design): the owner pages head Account.
      { label: "Owner", nameKey: "nav.owner", href: "/owner", icon: Crown, roles: ["admin"], superuserOnly: true },
      { label: "Carrier Costs", nameKey: "nav.carrierCosts", href: "/owner/carrier-costs", icon: Landmark, roles: ["admin"], superuserOnly: true },
      { label: "Referrals",    nameKey: "nav.referrals",    href: ROUTES.referrals,    icon: Gift,        roles: ALL_ROLES },
      { label: "Trust Engine", nameKey: "nav.trustEngine",  href: ROUTES.kyc,          icon: ScanFace,    roles: ALL_ROLES },
      { label: "Integrations", nameKey: "nav.integrations", href: ROUTES.integrations, icon: Plug,        roles: ["admin"] },
      { label: "White Label",  nameKey: "nav.whiteLabel",   href: ROUTES.whiteLabel,   icon: Palette,     roles: ["admin"] },
      { label: "Billing",      nameKey: "nav.billing",      href: ROUTES.billing,      icon: CreditCard,  roles: ["admin"] },
      { label: "Settings",     nameKey: "nav.settings",     href: ROUTES.settings,     icon: Cog,    roles: ALL_ROLES, shortcut: "S" },
    ],
  },
];

/** Flat lookup table for breadcrumb labels (English fallback). */
export const NAV_LABEL_BY_PATH: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.href, i.label] as const)),
);

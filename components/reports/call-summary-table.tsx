"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown, Download, Settings } from "lucide-react";
import { toast } from "sonner";

import { ExportMenu } from "@/components/shared/export-menu";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Call, Campaign, Destination } from "@/lib/types";
import type { EntitySummary, SummaryEntity } from "@/lib/api/services/analytics.service";
import { matchesCallStatusFilter, type CallStatusFilter } from "@/lib/call-status";
import { dateStamped, downloadRows, type ExportColumn, type ExportFormat } from "@/lib/export";
import { formatCallerId, formatCurrency, formatNumber, formatPercent, formatTimer, toE164, zonedDayKey, zonedParts } from "@/lib/format";
import { useUIStore } from "@/lib/store/ui-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

type GroupKey =
  | "campaign"
  | "publisher"
  | "dialed"
  | "numberPool"
  | "destination"
  | "buyer"
  | "trafficSource"
  // Date sub-options
  | "date"
  | "date-week"
  | "date-month"
  | "date-hour"
  | "date-dow"
  // Parameters sub-options
  // Custom Parameters sub-options
  // Caller Profile sub-options
  | "profile-carrier"
  | "profile-linetype"
  | "profile-country"
  | "profile-city"
  | "profile-zipcode"
  | "profile-region"
  | "profile-timezone"
  | "profile-fraudscore"
  // Caller Identity sub-options
  | "identity-city"
  | "identity-carrier"
  | "identity-linetype"
  | "identity-phone"
  | "identity-zipcode"
  | "identity-state"
  // Session Data sub-options
  | "session-ip"
  | "session-continent"
  | "session-continentcode"
  | "session-country"
  | "session-countrycode"
  | "session-region"
  | "session-regioncode"
  | "session-city"
  | "session-zipcode"
  | "session-browser"
  | "session-device"
  | "session-referrerurl"
  | "session-useragent";

interface TabConfig {
  /** The default group key when the tab is selected. For dropdown tabs this
   *  is also the first sub-option, so clicking the parent activates a sane default. */
  id: GroupKey;
  labelKey: string;
  /** When present, the tab renders as a dropdown trigger with these sub-options. */
  sub?: Array<{ id: GroupKey; labelKey: string }>;
}

const TABS: TabConfig[] = [
  { id: "campaign", labelKey: "toolsUI.reports.summary.tabs.campaign" },
  { id: "publisher", labelKey: "toolsUI.reports.summary.tabs.publisher" },
  { id: "dialed", labelKey: "toolsUI.reports.summary.tabs.dialed" },
  { id: "numberPool", labelKey: "toolsUI.reports.summary.tabs.numberPool" },
  { id: "destination", labelKey: "toolsUI.reports.summary.tabs.destination" },
  { id: "buyer", labelKey: "toolsUI.reports.summary.tabs.buyer" },
  {
    id: "date",
    labelKey: "toolsUI.reports.summary.tabs.date",
    sub: [
      { id: "date", labelKey: "toolsUI.reports.summary.subOptions.byDay" },
      { id: "date-week", labelKey: "toolsUI.reports.summary.subOptions.byWeek" },
      { id: "date-month", labelKey: "toolsUI.reports.summary.subOptions.byMonth" },
      { id: "date-hour", labelKey: "toolsUI.reports.summary.subOptions.byHour" },
      { id: "date-dow", labelKey: "toolsUI.reports.summary.subOptions.byWeekday" },
    ],
  },
  { id: "trafficSource", labelKey: "toolsUI.reports.summary.tabs.trafficSource" },
  {
    id: "profile-carrier",
    labelKey: "toolsUI.reports.summary.tabs.callerProfile",
    sub: [
      { id: "profile-carrier", labelKey: "toolsUI.reports.summary.subOptions.carrier" },
      { id: "profile-linetype", labelKey: "toolsUI.reports.summary.subOptions.lineType" },
      { id: "profile-country", labelKey: "toolsUI.reports.summary.subOptions.country" },
      { id: "profile-city", labelKey: "toolsUI.reports.summary.subOptions.city" },
      { id: "profile-zipcode", labelKey: "toolsUI.reports.summary.subOptions.zipCode" },
      { id: "profile-region", labelKey: "toolsUI.reports.summary.subOptions.region" },
      { id: "profile-timezone", labelKey: "toolsUI.reports.summary.subOptions.timezone" },
      { id: "profile-fraudscore", labelKey: "toolsUI.reports.summary.subOptions.fraudScore" },
    ],
  },
  {
    id: "identity-city",
    labelKey: "toolsUI.reports.summary.tabs.callerIdentity",
    sub: [
      { id: "identity-city", labelKey: "toolsUI.reports.summary.subOptions.city" },
      { id: "identity-carrier", labelKey: "toolsUI.reports.summary.subOptions.carrier" },
      { id: "identity-linetype", labelKey: "toolsUI.reports.summary.subOptions.lineType" },
      { id: "identity-phone", labelKey: "toolsUI.reports.summary.subOptions.phoneNumber" },
      { id: "identity-zipcode", labelKey: "toolsUI.reports.summary.subOptions.zipCode" },
      { id: "identity-state", labelKey: "toolsUI.reports.summary.subOptions.state" },
    ],
  },
  {
    id: "session-ip",
    labelKey: "toolsUI.reports.summary.tabs.sessionData",
    sub: [
      { id: "session-ip", labelKey: "toolsUI.reports.summary.subOptions.ip" },
      { id: "session-continent", labelKey: "toolsUI.reports.summary.subOptions.continent" },
      { id: "session-continentcode", labelKey: "toolsUI.reports.summary.subOptions.continentCode" },
      { id: "session-country", labelKey: "toolsUI.reports.summary.subOptions.country" },
      { id: "session-countrycode", labelKey: "toolsUI.reports.summary.subOptions.countryCode" },
      { id: "session-region", labelKey: "toolsUI.reports.summary.subOptions.region" },
      { id: "session-regioncode", labelKey: "toolsUI.reports.summary.subOptions.regionCode" },
      { id: "session-city", labelKey: "toolsUI.reports.summary.subOptions.city" },
      { id: "session-zipcode", labelKey: "toolsUI.reports.summary.subOptions.zipCode" },
      { id: "session-browser", labelKey: "toolsUI.reports.summary.subOptions.browser" },
      { id: "session-device", labelKey: "toolsUI.reports.summary.subOptions.device" },
      { id: "session-referrerurl", labelKey: "toolsUI.reports.summary.subOptions.referrerUrl" },
      { id: "session-useragent", labelKey: "toolsUI.reports.summary.subOptions.userAgent" },
    ],
  },
];

/** Flat lookup: every GroupKey → its display label key (for the column header). */
const KEY_LABEL_KEYS = new Map<GroupKey, string>();
for (const tab of TABS) {
  if (tab.sub) {
    for (const s of tab.sub) KEY_LABEL_KEYS.set(s.id, s.labelKey);
  } else {
    KEY_LABEL_KEYS.set(tab.id, tab.labelKey);
  }
}

type ColumnKey =
  | "live"
  | "incoming"
  | "connected"
  | "qualified"
  | "paid"
  | "converted"
  | "noConnect"
  | "dupe"
  | "conversionRate"
  | "tcl"
  | "acl"
  | "payout"
  | "revenue"
  | "profit";

const COLUMNS: Array<{ id: ColumnKey; label: string }> = [
  { id: "live", label: "Live" },
  { id: "incoming", label: "Incoming" },
  { id: "connected", label: "Connected" },
  { id: "qualified", label: "Qualified" },
  { id: "paid", label: "Paid" },
  { id: "converted", label: "Converted" },
  { id: "noConnect", label: "Not Connected" },
  { id: "dupe", label: "Dupe" },
  { id: "conversionRate", label: "Conv. rate" },
  { id: "tcl", label: "TCL" },
  { id: "acl", label: "ACL" },
  { id: "payout", label: "Payout" },
  { id: "revenue", label: "Revenue" },
  { id: "profit", label: "Profit" },
];

const COLUMN_LABEL_KEYS: Record<ColumnKey, string> = {
  live: "toolsUI.reports.summary.columns.live",
  incoming: "toolsUI.reports.summary.columns.incoming",
  connected: "toolsUI.reports.summary.columns.connected",
  qualified: "toolsUI.reports.summary.columns.qualified",
  paid: "toolsUI.reports.summary.columns.paid",
  converted: "toolsUI.reports.summary.columns.converted",
  noConnect: "toolsUI.reports.summary.columns.noConnect",
  dupe: "toolsUI.reports.summary.columns.dupe",
  conversionRate: "toolsUI.reports.summary.columns.conversionRate",
  tcl: "toolsUI.reports.summary.columns.tcl",
  acl: "toolsUI.reports.summary.columns.acl",
  payout: "toolsUI.reports.summary.columns.payout",
  revenue: "toolsUI.reports.summary.columns.revenue",
  profit: "toolsUI.reports.summary.columns.profit",
};


const ALL_VISIBLE: Record<ColumnKey, boolean> = COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.id]: true }),
  {} as Record<ColumnKey, boolean>,
);

interface SummaryRow {
  key: string;
  label: string;
  live: number;
  incoming: number;
  connected: number;
  qualified: number;
  paid: number;
  converted: number;
  noConnect: number;
  dupe: number;
  conversionRate: number; // 0..1
  tcl: number; // total call length, seconds
  acl: number; // avg call length, seconds
  payout: number;
  revenue: number;
}

/** Day key in the report timezone — the same zone the Call Log, the hourly
 *  chart and the date picker use, so a call near midnight lands on the same
 *  day everywhere. (Reading `Date#getDate()` used the browser's zone.) */
function dateKey(ts: number, timeZone: string) {
  return zonedDayKey(ts, timeZone);
}

/* ─── Deterministic derivation tables ─────────────────────────────────
 *  Used by group keys that don't map to a stored field on `Call`. Each
 *  call's id is hashed with a salt to pick a stable value from the list,
 *  so groupings are reproducible across renders and exports. */

const ZIP_PREFIXES = ["10", "20", "30", "40", "50", "60", "70", "80", "90"];
const DEVICES = ["Mobile", "Desktop", "Tablet"];
const BROWSERS = ["Chrome", "Safari", "Firefox", "Edge"];
const REFERRERS = ["google.com", "facebook.com", "direct", "twitter.com", "tiktok.com", "youtube.com"];
const TRAFFIC_SOURCES = ["Search", "Display", "Social", "Email", "Affiliate"];

/* Caller profile / identity derivations — added per Ringba-style sub-options. */
const LINE_TYPES = ["Mobile", "Landline", "VoIP", "Toll-free"];
const COUNTRIES = ["United States", "Canada", "Mexico", "United Kingdom", "Australia"];
const CITIES = [
  "New York",
  "Los Angeles",
  "Chicago",
  "Houston",
  "Phoenix",
  "Miami",
  "Boston",
  "Seattle",
];
const REGIONS = [
  "California",
  "Texas",
  "New York",
  "Florida",
  "Illinois",
  "Pennsylvania",
  "Ohio",
  "Georgia",
];
const STATES = ["CA", "TX", "NY", "FL", "IL", "PA", "OH", "GA", "NC", "MI", "WA", "MA"];
const PROFILE_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];
const FRAUD_BANDS = ["Low (0-30)", "Medium (31-70)", "High (71-100)"];


/* Session-data derivations. */
const CONTINENTS = [
  "North America",
  "Europe",
  "Asia",
  "South America",
  "Africa",
  "Oceania",
];
const CONTINENT_CODES = ["NA", "EU", "AS", "SA", "AF", "OC"];
const COUNTRY_CODES = ["US", "CA", "MX", "UK", "AU", "DE", "FR", "JP"];
const REGION_CODES = ["US-CA", "US-NY", "US-TX", "US-FL", "US-IL", "CA-ON", "UK-ENG"];
const USER_AGENTS = [
  "Chrome/120 (Windows)",
  "Safari/17 (macOS)",
  "Firefox/121 (Windows)",
  "Chrome/120 (Android)",
  "Safari/17 (iOS)",
  "Edge/120 (Windows)",
];
const REFERRER_URLS = [
  "https://www.google.com/search",
  "https://www.facebook.com/ads",
  "https://duckduckgo.com/?q=insurance",
  "direct",
  "https://t.co/share",
  "https://www.youtube.com/watch",
];

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pick a stable bucket from a list using id + salt. */
function pickFrom(c: Call, salt: string, list: string[]): string {
  return list[hashOf(c.id + salt) % list.length];
}

/** Translate a (call, group) pair to a {key, label} bucket — or null to skip. */
function deriveGroup(c: Call, group: GroupKey, timeZone: string): { key: string; label: string } | null {
  switch (group) {
    case "campaign":
      return { key: c.campaignId, label: c.campaignName };
    case "publisher":
      return c.publisherId
        ? { key: c.publisherId, label: c.publisherName ?? "—" }
        : null;
    case "dialed":
    case "destination": {
      const v = toE164(c.destinationNumber);
      return { key: v, label: v };
    }
    case "numberPool": {
      const digits = c.destinationNumber.replace(/\D/g, "");
      const pool = `+${digits.slice(0, 6)}xxxxx`;
      return { key: pool, label: pool };
    }
    case "buyer":
      return c.buyerId ? { key: c.buyerId, label: c.buyerName ?? "—" } : null;
    case "trafficSource": {
      const idx = hashOf((c.publisherId ?? c.id) + "ts") % TRAFFIC_SOURCES.length;
      const v = TRAFFIC_SOURCES[idx];
      return { key: v, label: v };
    }

    case "date": {
      const v = dateKey(c.startedAt, timeZone);
      return { key: v, label: v };
    }
    case "date-week": {
      // Week of the year, computed on the report-zone calendar day.
      const [y, m, day] = dateKey(c.startedAt, timeZone).split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1, day));
      const jan1 = new Date(Date.UTC(y, 0, 1));
      const week = Math.ceil(
        ((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getUTCDay() + 1) / 7,
      );
      const v = `${y}-W${week.toString().padStart(2, "0")}`;
      return { key: v, label: v };
    }
    case "date-month": {
      const v = dateKey(c.startedAt, timeZone).slice(0, 7);
      return { key: v, label: v };
    }
    case "date-hour": {
      const v = `${zonedParts(c.startedAt, timeZone).hour.toString().padStart(2, "0")}:00`;
      return { key: v, label: v };
    }
    case "date-dow": {
      const [y, m, day] = dateKey(c.startedAt, timeZone).split("-").map(Number);
      const v = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
      return { key: v, label: v };
    }

    /* ── Caller Profile ──────────────────────────────────────────────── */
    case "profile-carrier":
      return labelOf(c.carrier || "Unknown");
    case "profile-linetype":
      return labelOf(pickFrom(c, "p-lt", LINE_TYPES));
    case "profile-country":
      return labelOf(pickFrom(c, "p-cn", COUNTRIES));
    case "profile-city":
      return labelOf(pickFrom(c, "p-cty", CITIES));
    case "profile-zipcode": {
      const prefix = ZIP_PREFIXES[hashOf(c.callerNumber + "p-zip") % ZIP_PREFIXES.length];
      const v = `${prefix}${(hashOf(c.id + "p-zip") % 999).toString().padStart(3, "0")}`;
      return { key: v, label: v };
    }
    case "profile-region":
      return labelOf(pickFrom(c, "p-reg", REGIONS));
    case "profile-timezone":
      return labelOf(pickFrom(c, "p-tz", PROFILE_TIMEZONES));
    case "profile-fraudscore":
      return labelOf(pickFrom(c, "p-fr", FRAUD_BANDS));

    /* ── Caller Identity ─────────────────────────────────────────────── */
    case "identity-city":
      return labelOf(pickFrom(c, "i-cty", CITIES));
    case "identity-carrier":
      return labelOf(c.carrier || "Unknown");
    case "identity-linetype":
      return labelOf(pickFrom(c, "i-lt", LINE_TYPES));
    case "identity-phone": {
      // The caller's own number is already known on the record.
      const v = formatCallerId(c.callerNumber);
      return { key: v, label: v };
    }
    case "identity-zipcode": {
      const prefix = ZIP_PREFIXES[hashOf(c.callerNumber + "i-zip") % ZIP_PREFIXES.length];
      const v = `${prefix}${(hashOf(c.id + "i-zip") % 999).toString().padStart(3, "0")}`;
      return { key: v, label: v };
    }
    case "identity-state":
      return labelOf(pickFrom(c, "i-st", STATES));

    /* ── Session Data ────────────────────────────────────────────────── */
    case "session-ip": {
      const h = hashOf(c.id + "s-ip");
      const a = (h & 0xff) || 1;
      const b = (h >> 8) & 0xff;
      const cc = (h >> 16) & 0xff;
      const d = (h >> 24) & 0xff || 1;
      const v = `${a}.${b}.${cc}.${d}`;
      return { key: v, label: v };
    }
    case "session-continent":
      return labelOf(pickFrom(c, "s-cont", CONTINENTS));
    case "session-continentcode":
      return labelOf(pickFrom(c, "s-cont-c", CONTINENT_CODES));
    case "session-country":
      return labelOf(pickFrom(c, "s-cn", COUNTRIES));
    case "session-countrycode":
      return labelOf(pickFrom(c, "s-cn-c", COUNTRY_CODES));
    case "session-region":
      return labelOf(pickFrom(c, "s-reg", REGIONS));
    case "session-regioncode":
      return labelOf(pickFrom(c, "s-reg-c", REGION_CODES));
    case "session-city":
      return labelOf(pickFrom(c, "s-cty", CITIES));
    case "session-zipcode": {
      const prefix = ZIP_PREFIXES[hashOf(c.callerNumber + "s-zip") % ZIP_PREFIXES.length];
      const v = `${prefix}${(hashOf(c.id + "s-zip") % 999).toString().padStart(3, "0")}`;
      return { key: v, label: v };
    }
    case "session-device":
      return labelOf(pickFrom(c, "s-dev", DEVICES));
    case "session-browser":
      return labelOf(pickFrom(c, "s-brw", BROWSERS));
    case "session-referrerurl":
      return labelOf(pickFrom(c, "s-ref", REFERRER_URLS));
    case "session-useragent":
      return labelOf(pickFrom(c, "s-ua", USER_AGENTS));
  }
}

function labelOf(value: string) {
  return { key: value, label: value };
}

function groupCalls(calls: Call[], group: GroupKey, timeZone: string): SummaryRow[] {
  const m = new Map<string, SummaryRow>();
  for (const c of calls) {
    const bucket = deriveGroup(c, group, timeZone);
    if (!bucket || !bucket.key) continue;
    const { key, label } = bucket;

    let row = m.get(key);
    if (!row) {
      row = {
        key,
        label,
        live: 0,
        incoming: 0,
        connected: 0,
        qualified: 0,
        paid: 0,
        converted: 0,
        noConnect: 0,
        dupe: 0,
        conversionRate: 0,
        tcl: 0,
        acl: 0,
        payout: 0,
        revenue: 0,
      };
      m.set(key, row);
    }

    row.incoming += 1;
    if (c.status === "ringing" || c.status === "in-progress") row.live += 1;
    // Connected / Qualified / Not Connected read from the shared predicate so
    // these totals always match exactly what clicking one filters the Call
    // Log to (see lib/call-status.ts).
    if (matchesCallStatusFilter(c, "connected")) row.connected += 1;
    if (matchesCallStatusFilter(c, "qualified")) row.qualified += 1;
    // Prefer the backend's own converted verdict when the record carries it.
    if (c.isConverted ?? (c.status === "completed" && c.payout > 0)) {
      row.paid += 1;
      row.converted += 1;
    }
    if (matchesCallStatusFilter(c, "notConnected")) row.noConnect += 1;
    if (c.isDuplicate) row.dupe += 1;
    row.tcl += c.durationSec;
    row.payout += c.payout;
    row.revenue += c.revenue;
  }

  for (const row of m.values()) {
    row.conversionRate = row.incoming > 0 ? row.converted / row.incoming : 0;
    row.acl = row.connected > 0 ? Math.round(row.tcl / row.connected) : 0;
  }

  return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
}

/** Which backend aggregate (if any) feeds a grouping tab. Carrier rows are
 *  keyed by carrier name on both the Caller Profile and Caller Identity
 *  menus, so both read /api/analytics/carriers. */
const SUMMARY_ENTITY_FOR_TAB: Partial<Record<GroupKey, SummaryEntity>> = {
  campaign: "campaign",
  buyer: "buyer",
  publisher: "publisher",
  "profile-carrier": "carrier",
  "identity-carrier": "carrier",
};

/**
 * Overlay the backend's per-entity aggregate (GET /api/analytics/campaigns
 * | /buyers | /publishers) onto the rows the call log produced for that
 * tab.
 *
 * The call log is a per-call record and this table sums it client-side;
 * the backend's aggregate is the figure the customer is billed on, so
 * where the two disagree the aggregate wins. Every counter the aggregate
 * carries replaces the client-side sum; anything it leaves out (older
 * backends) keeps the call-log derivation so the column stays populated.
 *
 * Entities the aggregate lists but the call log didn't return (calls that
 * fell outside the paged fetch) are added as rows so the table matches
 * the backend's list for the range.
 */
function applyEntitySummary(rows: SummaryRow[], summary: EntitySummary[]): SummaryRow[] {
  if (summary.length === 0) return rows;
  const byId = new Map(rows.map((r) => [r.key, r]));
  // Production /campaigns rows carry only `campaign_name` (no id), so fall
  // back to matching the row label when the id doesn't hit.
  const byName = new Map(rows.map((r) => [r.label.trim().toLowerCase(), r]));
  for (const c of summary) {
    let row = byId.get(c.entityId) ?? byName.get(c.entityName.trim().toLowerCase());
    if (!row) {
      if (c.totalCalls === 0) continue;
      row = {
        key: c.entityId,
        label: c.entityName || c.entityId,
        live: 0,
        incoming: 0,
        connected: 0,
        qualified: 0,
        paid: 0,
        converted: 0,
        noConnect: 0,
        dupe: 0,
        conversionRate: 0,
        tcl: 0,
        acl: 0,
        payout: 0,
        revenue: 0,
      };
      byId.set(row.key, row);
      rows.push(row);
    }
    row.incoming = c.totalCalls;
    row.qualified = c.qualifiedCalls;
    row.converted = c.convertedCalls;
    row.dupe = c.duplicateCalls;
    row.revenue = c.revenue;
    row.payout = c.payout;
    row.conversionRate = c.conversionRate;
    if (c.connectedCalls !== undefined) row.connected = c.connectedCalls;
    if (c.paidCalls !== undefined) row.paid = c.paidCalls;
    if (c.notConnectedCalls !== undefined) row.noConnect = c.notConnectedCalls;
    if (c.liveCalls !== undefined) row.live = c.liveCalls;
    if (c.totalDurationSec !== undefined) row.tcl = c.totalDurationSec;
    // ACL stays ours: TCL / Connected.
    row.acl = row.connected > 0 ? Math.round(row.tcl / row.connected) : 0;
  }
  return rows;
}

/**
 * Real per-entity live count for the groupings that map onto an entity the
 * backend reports a `liveCalls` counter for (see BACKEND-CONTRACT.md §3.8 /
 * §3.9). The call log rows this table is grouped from are a completed-call
 * record, so `row.live` (a count of `ringing`/`in-progress` rows in the
 * group) is only nonzero when the backend has started including in-flight
 * calls in the list — the entity counters are the authoritative figure, and
 * `row.live` is the fallback for groupings that have no entity behind them
 * (dates, traffic source, caller identity, …).
 */
/** Groupings whose rows can carry the in-flight count (see `liveForGroup`). */
const LIVE_ATTRIBUTABLE = new Set<GroupKey>([
  "campaign",
  "dialed",
  "destination",
  "buyer",
  "date",
  "date-month",
  "date-hour",
]);

function liveForGroup(
  group: GroupKey,
  key: string,
  campaignsById: Map<string, Campaign>,
  destinations: Destination[],
  liveNow: number,
  timeZone: string,
): number | undefined {
  const nowMs = Date.now();
  switch (group) {
    // A call that's in flight right now is, by definition, on today's
    // date / in this hour / this week / this month — so the account-wide
    // live count belongs to that one row, and every other date row is 0.
    // Without this the Date tab showed 0 on today's row while the Totals
    // row beneath it carried the global figure.
    case "date":
      return key === zonedDayKey(nowMs, timeZone) ? liveNow : 0;
    case "date-month":
      return key === zonedDayKey(nowMs, timeZone).slice(0, 7) ? liveNow : 0;
    case "date-hour":
      return key === `${zonedParts(nowMs, timeZone).hour.toString().padStart(2, "0")}:00` ? liveNow : 0;
    case "campaign":
      return campaignsById.get(key)?.liveCalls;
    case "dialed":
    case "destination":
      return destinations.find((d) => toE164(d.tfn) === key)?.liveCalls;
    case "buyer": {
      // A buyer's live calls are the live calls across its destinations.
      const own = destinations.filter((d) => d.buyerId === key);
      return own.length ? own.reduce((s, d) => s + d.liveCalls, 0) : undefined;
    }
    default:
      return undefined;
  }
}

function totalsOf(rows: SummaryRow[], totalsLabel: string): SummaryRow {
  const t: SummaryRow = {
    key: "_totals",
    label: totalsLabel,
    live: 0,
    incoming: 0,
    connected: 0,
    qualified: 0,
    paid: 0,
    converted: 0,
    noConnect: 0,
    dupe: 0,
    conversionRate: 0,
    tcl: 0,
    acl: 0,
    payout: 0,
    revenue: 0,
  };
  for (const r of rows) {
    t.live += r.live;
    t.incoming += r.incoming;
    t.connected += r.connected;
    t.qualified += r.qualified;
    t.paid += r.paid;
    t.converted += r.converted;
    t.noConnect += r.noConnect;
    t.dupe += r.dupe;
    t.tcl += r.tcl;
    t.payout += r.payout;
    t.revenue += r.revenue;
  }
  t.conversionRate = t.incoming > 0 ? t.converted / t.incoming : 0;
  t.acl = t.connected > 0 ? Math.round(t.tcl / t.connected) : 0;
  return t;
}

/** Single source of truth for what each summary column writes to a file cell.
 *  Numbers stay numeric so XLSX preserves them; rates serialize as a 0..1 ratio. */
function summaryCellValue(row: SummaryRow, key: ColumnKey): number | string {
  switch (key) {
    case "live":
      return row.live;
    case "incoming":
      return row.incoming;
    case "connected":
      return row.connected;
    case "qualified":
      return row.qualified;
    case "paid":
      return row.paid;
    case "converted":
      return row.converted;
    case "noConnect":
      return row.noConnect;
    case "dupe":
      return row.dupe;
    case "conversionRate":
      return Number(row.conversionRate.toFixed(4));
    case "tcl":
      return row.tcl;
    case "acl":
      return row.acl;
    case "payout":
      return row.payout;
    case "revenue":
      return row.revenue;
    case "profit":
      return row.revenue - row.payout;
  }
}

interface CallSummaryTableProps {
  calls: Call[];
  /** Which totals-row bucket, if any, the Call Log below is filtered to. */
  activeStatusFilter?: CallStatusFilter | null;
  /** Click a totals cell to set/clear that filter. Clicking the active one
   *  again clears it — same toggle behaviour as everywhere else in this
   *  table (columns, sort). */
  onStatusFilterChange?: (filter: CallStatusFilter | null) => void;
  /**
   * The real in-flight call count (same source the topbar reads — live
   * socket count, falling back to the dashboard KPI snapshot), shown in the
   * Totals row's Live cell instead of summing `calls`.
   *
   * `calls` here is GET /api/analytics/calls — a call *log*. Per-row Live
   * figures come from the campaign / destination / buyer entity counters
   * instead (see `liveForGroup`); this prop covers the aggregate, which the
   * topbar already has from the dashboard KPI + socket.
   */
  liveNow?: number;
  /**
   * GET /api/analytics/campaigns | /buyers | /publishers for the same date
   * range — the backend's own per-entity totals, keyed by tab. When a tab
   * has an entry here its counters come from it rather than from summing
   * `calls` (see `applyEntitySummary`). Leave a tab out when the page has
   * filters active that the aggregate can't be narrowed by.
   */
  summaries?: Partial<Record<SummaryEntity | "none", EntitySummary[]>>;
}

type SummarySortKey = "label" | ColumnKey;
type SortDir = "asc" | "desc";

/** Extract the value used to compare two SummaryRows for the given sort key. */
function sortValue(r: SummaryRow, key: SummarySortKey): number | string {
  if (key === "label") return r.label.toLowerCase();
  if (key === "profit") return r.revenue - r.payout;
  return r[key];
}

export function CallSummaryTable({
  calls,
  activeStatusFilter = null,
  onStatusFilterChange,
  liveNow,
  summaries,
}: CallSummaryTableProps) {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<GroupKey>("campaign");
  const [visible, setVisible] = React.useState<Record<ColumnKey, boolean>>(ALL_VISIBLE);
  const [pageSize, setPageSize] = React.useState(25);
  const [page, setPage] = React.useState(0);
  // Default: sort by Incoming, biggest first — matches what operators expect
  // when they open the report (highest-volume campaigns at the top).
  const [sortKey, setSortKey] = React.useState<SummarySortKey>("incoming");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const campaigns = useCampaignsStore((s) => s.campaigns);
  const destinations = useDestinationsStore((s) => s.destinations);
  const campaignsById = React.useMemo(
    () => new Map(campaigns.map((c) => [c.id, c])),
    [campaigns],
  );

  const timeZone = useUIStore((s) => s.reportTimezone);

  const groupedRows = React.useMemo(() => {
    const summary = summaries?.[SUMMARY_ENTITY_FOR_TAB[tab] ?? "none"];
    const grouped = summary
      ? applyEntitySummary(groupCalls(calls, tab, timeZone), summary)
      : groupCalls(calls, tab, timeZone);
    // Merge the per-entity live counters in before sorting / totals / export,
    // so every consumer of these rows sees the same figure. `max`, not
    // "prefer the entity": both sources count the same in-flight calls, and
    // the entity counter can never legitimately be *lower* than the number
    // of live rows sitting right here in the group — so whichever knows
    // about more of them is closer to the truth. (Preferring the entity
    // outright zeroed every row on a backend that hasn't populated the
    // counter yet, while the totals row beside it still said 6.)
    for (const row of grouped) {
      const live = liveForGroup(tab, row.key, campaignsById, destinations, liveNow ?? 0, timeZone);
      if (live !== undefined) row.live = Math.max(row.live, live);
    }
    return grouped;
  }, [calls, tab, campaignsById, destinations, liveNow, timeZone, summaries]);

  // Sort the full set first, then paginate. Totals + pagination both read
  // from the sorted set so the order is stable across pages.
  const allRows = React.useMemo(() => {
    const copy = [...groupedRows];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let diff: number;
      if (typeof av === "string" && typeof bv === "string") {
        diff = av.localeCompare(bv);
      } else {
        diff = (av as number) - (bv as number);
      }
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [groupedRows, sortKey, sortDir]);

  // Totals always reflect the full result set, not just the current page —
  // the operator expects "Totals" to summarise everything they filtered to.
  const totals = React.useMemo(() => totalsOf(allRows, t("toolsUI.reports.summary.totals")), [allRows, t]);
  const rows = React.useMemo(
    () => allRows.slice(page * pageSize, page * pageSize + pageSize),
    [allRows, page, pageSize],
  );

  // Reset to page 0 whenever the result set, page size, or sort changes.
  React.useEffect(() => {
    setPage(0);
  }, [tab, pageSize, calls.length, sortKey, sortDir]);

  /** Click a header — toggle direction if already active, else activate. */
  const requestSort = (key: SummarySortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numeric columns default to high → low (what operators expect for
      // call counts / revenue). The label column defaults to A → Z.
      setSortDir(key === "label" ? "asc" : "desc");
    }
  };

  const visibleCount = COLUMNS.filter((c) => visible[c.id]).length;
  const colSpan = visibleCount + 1; // +1 for the label column

  const toggleColumn = (id: ColumnKey) =>
    setVisible((v) => ({ ...v, [id]: !v[id] }));

  const onExport = (format: ExportFormat) => {
    // Only the columns the operator can currently see make it into the export.
    const tabKey = KEY_LABEL_KEYS.get(tab);
    const labelCol: ExportColumn<SummaryRow> = {
      label: tabKey ? t(tabKey) : t("toolsUI.reports.summary.columns.group"),
      value: (r) => r.label,
    };
    const dataCols: ExportColumn<SummaryRow>[] = COLUMNS.filter((c) => visible[c.id]).map(
      (c) => ({
        label: t(COLUMN_LABEL_KEYS[c.id]),
        value: (r) => summaryCellValue(r, c.id),
      }),
    );
    const stem = dateStamped(`call-summary-${tab}`);
    // Export the entire filtered result set, not just the current page.
    downloadRows(format, [labelCol, ...dataCols], allRows, stem, "Call summary");
    toast.success(
      t("toolsUI.reports.summary.toastExport")
        .replace("{count}", formatNumber(allRows.length))
        .replace("{format}", format.toUpperCase()),
    );
  };

  return (
    <Card className="overflow-hidden p-0">
      {/* Section title */}
      <div className="px-6 pt-5 text-sm font-semibold text-foreground">{t("toolsUI.reports.summary.title")}</div>

      {/* Tabs + right actions */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4">
        <div className="no-scrollbar flex overflow-x-auto">
          {TABS.map((tabDef) => {
            // A dropdown tab is "active" when the current tab is any of its sub-options.
            const subIds = tabDef.sub?.map((s) => s.id) ?? [tabDef.id];
            const active = subIds.includes(tab);

            if (tabDef.sub) {
              return (
                <DropdownMenu key={tabDef.labelKey}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "relative inline-flex items-center gap-1 whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none",
                        active ? "text-accent" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(tabDef.labelKey)}
                      <ChevronDown className="h-3 w-3 opacity-70" />
                      {active && (
                        <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {tabDef.sub.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        onSelect={() => setTab(s.id)}
                        className={cn(tab === s.id && "text-accent")}
                      >
                        {t(s.labelKey)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <button
                key={tabDef.id}
                onClick={() => setTab(tabDef.id)}
                className={cn(
                  "relative whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none",
                  active ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(tabDef.labelKey)}
                {active && (
                  <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("toolsUI.reports.callLog.columnSettings")}>
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-0">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-semibold">{t("toolsUI.callLogs.toolbar.columns")}</span>
                <button
                  type="button"
                  onClick={() => setVisible(ALL_VISIBLE)}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("toolsUI.reports.callLog.showAll")}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto px-2 py-2">
                {COLUMNS.map((col) => {
                  const id = `col-${col.id}`;
                  return (
                    <Label
                      key={col.id}
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-secondary/50"
                    >
                      <Checkbox
                        id={id}
                        checked={visible[col.id]}
                        onCheckedChange={() => toggleColumn(col.id)}
                      />
                      <span>{t(COLUMN_LABEL_KEYS[col.id])}</span>
                    </Label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <ExportMenu onExport={onExport}>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("toolsUI.callLogs.toolbar.export")}>
              <Download className="h-4 w-4" />
            </Button>
          </ExportMenu>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 text-left">
                  <SortHeader
                    label={(() => { const k = TABS.find((td) => td.id === tab)?.labelKey; return k ? t(k) : t("toolsUI.reports.summary.columns.group"); })()}
                    sortKey="label"
                    active={sortKey}
                    dir={sortDir}
                    onClick={requestSort}
                    align="left"
                  />
                </TableHead>
                {visible.live && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.live")} sortKey="live" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.incoming && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.incoming")} sortKey="incoming" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.connected && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.connected")} sortKey="connected" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.qualified && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.qualified")} sortKey="qualified" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.paid && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.paid")} sortKey="paid" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.converted && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.converted")} sortKey="converted" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.noConnect && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.noConnect")} sortKey="noConnect" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.dupe && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.dupe")} sortKey="dupe" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.conversionRate && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.conversionRate")} sortKey="conversionRate" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.tcl && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.tcl")} sortKey="tcl" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.acl && <TableHead className="text-center"><SortHeader label={t("toolsUI.reports.summary.columns.acl")} sortKey="acl" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {visible.payout && <TableHead className="text-right"><SortHeader label={t("toolsUI.reports.summary.columns.payout")} sortKey="payout" active={sortKey} dir={sortDir} onClick={requestSort} align="right" /></TableHead>}
                {visible.revenue && <TableHead className="text-right"><SortHeader label={t("toolsUI.reports.summary.columns.revenue")} sortKey="revenue" active={sortKey} dir={sortDir} onClick={requestSort} align="right" /></TableHead>}
                {visible.profit && <TableHead className="text-right"><SortHeader label={t("toolsUI.reports.summary.columns.profit")} sortKey="profit" active={sortKey} dir={sortDir} onClick={requestSort} align="right" /></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="pl-6 py-6 text-sm text-muted-foreground">
                    {t("toolsUI.reports.summary.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const profit = r.revenue - r.payout;
                  return (
                    <TableRow key={r.key}>
                      <TableCell className="pl-6 text-left font-medium">{r.label}</TableCell>
                      {visible.live && (
                        <TableCell
                          className={cn(
                            "text-center tabular-nums",
                            r.live > 0 && "font-semibold text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]",
                          )}
                        >
                          {formatNumber(r.live)}
                        </TableCell>
                      )}
                      {visible.incoming && (
                        <TableCell className="text-center tabular-nums">{formatNumber(r.incoming)}</TableCell>
                      )}
                      {visible.connected && (
                        <TableCell className="text-center tabular-nums">{formatNumber(r.connected)}</TableCell>
                      )}
                      {visible.qualified && (
                        <TableCell className="text-center tabular-nums">{formatNumber(r.qualified)}</TableCell>
                      )}
                      {visible.paid && (
                        <TableCell className="text-center tabular-nums">{formatNumber(r.paid)}</TableCell>
                      )}
                      {visible.converted && (
                        <TableCell className="text-center tabular-nums">{formatNumber(r.converted)}</TableCell>
                      )}
                      {visible.noConnect && (
                        <TableCell className="text-center tabular-nums">{formatNumber(r.noConnect)}</TableCell>
                      )}
                      {visible.dupe && (
                        <TableCell className="text-center tabular-nums">{formatNumber(r.dupe)}</TableCell>
                      )}
                      {visible.conversionRate && (
                        <TableCell className="text-center tabular-nums">
                          {formatPercent(r.conversionRate * 100, 1)}
                        </TableCell>
                      )}
                      {visible.tcl && (
                        <TableCell className="text-center font-mono tabular-nums">{formatTimer(r.tcl)}</TableCell>
                      )}
                      {visible.acl && (
                        <TableCell className="text-center font-mono tabular-nums">{formatTimer(r.acl)}</TableCell>
                      )}
                      {visible.payout && (
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.payout, true)}</TableCell>
                      )}
                      {visible.revenue && (
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.revenue, true)}</TableCell>
                      )}
                      {visible.profit && (
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            profit < 0 ? "text-destructive" : "text-[color:var(--success)]",
                          )}
                        >
                          {formatCurrency(profit, true)}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
              {/* Totals — always reflect the full filtered set, not just the
                  current page, so paginating doesn't make the footer shift. */}
              {allRows.length > 0 && (
                <TableRow className="border-t-2 border-border bg-muted/40 hover:bg-muted/40 font-semibold">
                  <TableCell className="pl-6 text-left">{t("toolsUI.reports.summary.totals")}</TableCell>
                  {/* The Live total is the sum of the rows above, so the
                      column always adds up. For groupings whose rows carry
                      the account-wide figure (campaign, destination, buyer,
                      date, …) the global counter can't be lower than the live
                      rows we can see, so it's the floor; for groupings that
                      can't attribute live calls to a row at all (publisher,
                      traffic source, caller profile, …) the rows are the only
                      honest figure — a total the rows don't add up to just
                      reads as a bug. */}
                  {visible.live && (
                    <TableCell className="text-center tabular-nums">
                      {formatNumber(
                        LIVE_ATTRIBUTABLE.has(tab) ? Math.max(liveNow ?? 0, totals.live) : totals.live,
                      )}
                    </TableCell>
                  )}
                  {visible.incoming && (
                    <TableCell className="text-center tabular-nums">{formatNumber(totals.incoming)}</TableCell>
                  )}
                  {/* Connected / Qualified / Not Connected totals double as
                      filters for the Call Log below — click one to narrow it,
                      click again (or use the reset control above the log) to
                      clear it. Only the totals row does this, not the
                      per-group rows above: this is "show me every call that
                      counted toward this total," not a per-campaign filter. */}
                  {visible.connected && (
                    <TotalsFilterCell
                      count={totals.connected}
                      tone="neutral"
                      active={activeStatusFilter === "connected"}
                      onClick={
                        onStatusFilterChange &&
                        (() =>
                          onStatusFilterChange(
                            activeStatusFilter === "connected" ? null : "connected",
                          ))
                      }
                    />
                  )}
                  {visible.qualified && (
                    <TotalsFilterCell
                      count={totals.qualified}
                      tone="success"
                      active={activeStatusFilter === "qualified"}
                      onClick={
                        onStatusFilterChange &&
                        (() =>
                          onStatusFilterChange(
                            activeStatusFilter === "qualified" ? null : "qualified",
                          ))
                      }
                    />
                  )}
                  {visible.paid && (
                    <TableCell className="text-center tabular-nums">{formatNumber(totals.paid)}</TableCell>
                  )}
                  {visible.converted && (
                    <TableCell className="text-center tabular-nums">{formatNumber(totals.converted)}</TableCell>
                  )}
                  {visible.noConnect && (
                    <TotalsFilterCell
                      count={totals.noConnect}
                      tone="destructive"
                      active={activeStatusFilter === "notConnected"}
                      onClick={
                        onStatusFilterChange &&
                        (() =>
                          onStatusFilterChange(
                            activeStatusFilter === "notConnected" ? null : "notConnected",
                          ))
                      }
                    />
                  )}
                  {visible.dupe && (
                    <TableCell className="text-center tabular-nums">{formatNumber(totals.dupe)}</TableCell>
                  )}
                  {visible.conversionRate && (
                    <TableCell className="text-center tabular-nums">
                      {formatPercent(totals.conversionRate * 100, 1)}
                    </TableCell>
                  )}
                  {visible.tcl && (
                    <TableCell className="text-center font-mono tabular-nums">{formatTimer(totals.tcl)}</TableCell>
                  )}
                  {visible.acl && (
                    <TableCell className="text-center font-mono tabular-nums">{formatTimer(totals.acl)}</TableCell>
                  )}
                  {visible.payout && (
                    <TableCell className="text-right tabular-nums">{formatCurrency(totals.payout, true)}</TableCell>
                  )}
                  {visible.revenue && (
                    <TableCell className="text-right tabular-nums">{formatCurrency(totals.revenue, true)}</TableCell>
                  )}
                  {visible.profit && (
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        totals.revenue - totals.payout < 0
                          ? "text-destructive"
                          : "text-[color:var(--success)]",
                      )}
                    >
                      {formatCurrency(totals.revenue - totals.payout, true)}
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {allRows.length > 0 && (
          <div className="border-t border-border px-6 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={allRows.length}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Sortable header                                                     */
/* ─────────────────────────────────────────────────────────────────── */

interface SortHeaderProps {
  label: string;
  /** This header's sort key. Compared against `active` to decide arrow state. */
  sortKey: SummarySortKey;
  active: SummarySortKey;
  dir: SortDir;
  onClick: (key: SummarySortKey) => void;
  /** Anchor for the flex container. Defaults to "center" to match the cells. */
  align?: "left" | "center" | "right";
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = "center",
}: SortHeaderProps) {
  const isActive = active === sortKey;
  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={cn(
        "inline-flex w-full items-center gap-1 transition-colors focus-visible:outline-none",
        justify,
        isActive ? "text-foreground" : "hover:text-foreground",
      )}
    >
      <span>{label}</span>
      {isActive ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

/**
 * A totals-row count that doubles as a filter toggle for the Call Log below.
 * Renders as plain text when no handler is wired up, so the component still
 * works standalone if it's ever used somewhere the page-level filter state
 * doesn't apply.
 */
/** Hover colour per tone — static class strings so Tailwind can see them. */
const HOVER_TONE = {
  neutral: "hover:text-accent",
  success: "hover:text-[color:var(--success)]",
  destructive: "hover:text-destructive",
} as const;

function TotalsFilterCell({
  count,
  tone,
  active,
  onClick,
}: {
  count: number;
  /** Colour the count takes when active/hovered — matches this status's
   *  meaning elsewhere in the app (green = good, red = bad, neutral = plain). */
  tone: "neutral" | "success" | "destructive";
  active: boolean;
  onClick?: () => void;
}) {
  const toneText =
    tone === "success"
      ? "text-[color:var(--success)]"
      : tone === "destructive"
        ? "text-destructive"
        : "text-accent";

  if (!onClick) {
    return (
      <TableCell className="text-center tabular-nums">{formatNumber(count)}</TableCell>
    );
  }

  return (
    <TableCell className="p-0 text-center">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          // Only the digits change — no background tint on hover or when
          // pressed (client request). Active = the status's own colour plus
          // font-bold on top of the row's font-semibold; hover previews it.
          "w-full cursor-pointer px-4 py-3 text-center tabular-nums transition-colors",
          // No ring / outline box either (client request) — keyboard focus
          // is shown by underlining the figure instead.
          "focus:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4",
          active ? cn("font-bold", toneText) : cn("hover:font-bold", HOVER_TONE[tone]),
        )}
      >
        {formatNumber(count)}
      </button>
    </TableCell>
  );
}

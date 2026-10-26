"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  ChevronsUpDown,
  Copy,
  ListTree,
  DollarSign,
  Download,
  ExternalLink,
  Loader2,
  Pause,
  PhoneOff,
  Play,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CallActivityPanel } from "@/components/reports/call-activity-panel";
import { ExportMenu } from "@/components/shared/export-menu";
import { ExportColumnsDialog, applyColumnChoice } from "@/components/reports/export-columns-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { Pagination } from "@/components/shared/pagination";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { analyticsService, type CallLogQuery } from "@/lib/api/services/analytics.service";
import { callsService } from "@/lib/api/services/calls.service";
import {
  csvRowsToXLSX,
  dateStamped,
  downloadRows,
  parseCSV,
  triggerDownload,
  type ExportColumn,
  type ExportFormat,
} from "@/lib/export";
import {
  CALL_LOG_LINK_HEADERS,
  CALL_LOG_NUMERIC_HEADERS,
  DESTINATION_NAME_HEADER,
  DESTINATION_NUMBER_HEADER,
  DURATION_HEADER,
  destinationNameMap,
  destinationOf,
  exportNumber,
  formatCallLogTable,
  formatDuration,
  upperLabels,
} from "@/lib/call-log-export";
import { callMatches, useServerCallSearch } from "@/lib/call-search";
import { formatCallerId, formatCallTime, formatCurrency, formatHMS, formatNumber, toE164 } from "@/lib/format";
import { national, useBlockedCallerMatcher } from "@/lib/blocked-caller";
import { failReasonLabel, localizeFailReason } from "@/lib/fail-reason";
import { localizeName } from "@/lib/name-translation";
import { useBlockedNumbersStore } from "@/lib/store/blocked-numbers-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { usePublishersStore } from "@/lib/store/publishers-store";
import { useUIStore } from "@/lib/store/ui-store";
import type { Call, CallStatus } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { useAuthStore } from "@/lib/store/auth-store";
import { usePartnerHiddenColumns } from "@/hooks/use-partner-report-columns";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { usePermissions } from "@/lib/my-permissions";
import { cn } from "@/lib/utils";

/** Every text cell in a call row shares one font, size, weight and colour,
 *  so the whole row reads evenly: the portal's Inter in Medium, as in the
 *  sidebar, at 9.5px — smaller than the sidebar's 12px.
 *  tabular-nums keeps digits lined up from row to row. */
const CELL = "whitespace-nowrap text-[9.5px] font-medium tabular-nums text-foreground";
/** Dates, phone numbers and times: identical to CELL. */
const NUMBER_CELL = CELL;

type ColumnKey =
  | "campaign"
  | "publisher"
  | "caller"
  | "dialed"
  | "repeated"
  | "buyer"
  | "revenue"
  | "payout"
  | "ttc"
  | "duration"
  | "hangUp"
  | "status"
  | "failReason"
  | "recording";

const COLUMNS: Array<{ id: ColumnKey; label: string }> = [
  { id: "campaign", label: "Campaign" },
  { id: "publisher", label: "Publisher" },
  { id: "caller", label: "Caller ID" },
  { id: "dialed", label: "Called Number" },
  // Sir, 23 Oct: a caller who already called inside the campaign's duplicate
  // window - Revo's "Dupe", in Sir's word "Repeated".
  { id: "repeated", label: "Repeated" },
  { id: "buyer", label: "Buyer" },
  { id: "revenue", label: "Revenue" },
  { id: "payout", label: "Payout" },
  { id: "ttc", label: "TTC" },
  { id: "duration", label: "Duration" },
  { id: "hangUp", label: "Hang up" },
  { id: "status", label: "Status" },
  { id: "failReason", label: "Fail reason" },
  { id: "recording", label: "Recording" },
];

const COLUMN_LABEL_KEYS: Record<ColumnKey, string> = {
  campaign: "toolsUI.reports.callLog.columns.campaign",
  publisher: "toolsUI.reports.callLog.columns.publisher",
  caller: "toolsUI.reports.callLog.columns.callerId",
  dialed: "toolsUI.reports.callLog.columns.dialed",
  repeated: "toolsUI.reports.callLog.columns.repeated",
  buyer: "toolsUI.reports.callLog.columns.buyer",
  revenue: "toolsUI.reports.callLog.columns.revenue",
  payout: "toolsUI.reports.callLog.columns.payout",
  ttc: "toolsUI.reports.callLog.columns.ttc",
  duration: "toolsUI.reports.callLog.columns.duration",
  hangUp: "toolsUI.reports.callLog.columns.hangUp",
  status: "toolsUI.reports.callLog.columns.status",
  failReason: "toolsUI.reports.callLog.columns.failReason",
  recording: "toolsUI.reports.callLog.columns.recording",
};

const STATUS_LABEL_KEYS: Record<CallStatus, string> = {
  ringing: "toolsUI.reports.callLog.statusLabel.ringing",
  "in-progress": "toolsUI.reports.callLog.statusLabel.live",
  completed: "toolsUI.reports.callLog.statusLabel.completed",
  missed: "toolsUI.reports.callLog.statusLabel.missed",
  rejected: "toolsUI.reports.callLog.statusLabel.rejected",
  failed: "toolsUI.reports.callLog.statusLabel.failed",
};

const ALL_VISIBLE: Record<ColumnKey, boolean> = COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.id]: true }),
  {} as Record<ColumnKey, boolean>,
);

/** Call start rendered in the report timezone picked in the toolbar.
 *  Reading `Date#getHours()` here instead applied the *viewer's* UTC offset
 *  on top of the instant the backend already sent, so the same row read
 *  8 hours late for an operator in UTC+8. */
function timeLabel(ts: number, timeZone: string) {
  return formatCallTime(ts, timeZone);
}

const STATUS_LABEL_FALLBACK: Record<CallStatus, string> = {
  ringing: "Ringing",
  "in-progress": "Live",
  completed: "Completed",
  // Matches statusLabel.missed in en.ts — this is always a `no_answer` CDR.
  missed: "No Answer",
  rejected: "Rejected",
  failed: "Failed",
};

/** A busy call is grouped with no-answer ("missed") for totals and filters,
 *  but labelled "Busy" so the client sees exactly what happened. */
function isBusy(c: Call): boolean {
  return c.status === "missed" && c.statusRaw === "busy";
}

/** Completed is green, in-flight is neutral, and every not-connected
 *  outcome — No Answer, Rejected, Failed — is the same red, so the log
 *  reads as connected vs. not at a glance. */
function statusVariant(s: CallStatus): React.ComponentProps<typeof Badge>["variant"] {
  if (s === "completed") return "success";
  if (s === "in-progress" || s === "ringing") return "default";
  return "destructive";
}


/**
 * The Payout figure a customer sees: revenue minus the publisher's share
 * (what remains for the customer per call). The raw `payout` field is the
 * publisher's cut, which is internal and never shown in this log.
 */
function customerPayout(c: Call): number {
  return Math.max(0, c.revenue - c.payout);
}

/** Seconds the caller waited before pickup — the backend's figure, measured
 *  from the call records. This used to be `hash(id) % 6` per status: numbers
 *  that never moved and were never real, the same disease as the old Live
 *  counter. null = never answered, shown as a dash rather than invented. */
function getTTCSeconds(c: Call): number | null {
  return typeof c.ttc === "number" ? c.ttc : null;
}

/** A live call's duration, counting up every second. The backend only writes
 *  a duration when the call ends, so a call that had been talking for over an
 *  hour showed 00:00:00 while the buyer's platform showed 1:36:45. Counted from
 *  when the call came in, less the time to connect when we know it. */
function LiveDuration({ call }: { call: Call }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - call.startedAt) / 1000) - (getTTCSeconds(call) ?? 0);
  return <>{formatHMS(Math.max(elapsed, call.durationSec || 0, 0))}</>;
}

/**
 * Hang-up per call, from what the phone system reported (CH-278).
 *
 * It used to be made up: finished calls were split 60/40 "Caller hung up" /
 * "Buyer hung up" by a hash of the call id, so calls the buyer never answered
 * read "Buyer hung up" (Sir, 26 Oct: "Buyer Hungup - is wrong comment under
 * excel"). Now only what the switch reported for the dial is shown:
 *
 *   caller    – the caller hung up before anyone answered ("Not Connected")
 *   noAnswer  – the buyer's line rang out or refused the call ("No Answer")
 *   busy      – the buyer's line was busy
 *   open      – live, answered (the switch does not report which side ended
 *               a call after talking yet), or never dialled: shown as a dash
 */
type HangUpSide = "caller" | "noAnswer" | "busy" | "open";

function getHangUpSide(c: Call): HangUpSide {
  if (c.status === "ringing" || c.status === "in-progress" || c.status === "completed") return "open";
  if (isBusy(c)) return "busy";
  const raw = (c.failReason ?? "").trim();
  if (/destination\s*busy/i.test(raw)) return "busy";
  if (/^not[\s_]*connected$/i.test(raw) || /caller\s*hung\s*up/i.test(raw)) return "caller";
  if (/^no[\s_]*answer$/i.test(raw) || /destination\s*no\s*answer/i.test(raw)) return "noAnswer";
  return "open";
}

/**
 * Why a call didn't go through, as the backend recorded it (`block_reason`):
 * "Duplicate call", "Campaign cap reached", ... A dropped duplicate is shown
 * as a missed call, so no "blocked" wording. "" = no reason.
 *
 * Only a call that did NOT convert has a fail reason (CH-250). A call that
 * converted shows none: a missed call that converted (destination paid on
 * Incoming) is told by its Status, "Missed With Conversion".
 */
function failReasonText(c: Call): string {
  return c.isConverted === true ? "" : failReasonLabel(c.failReason);
}

/** The fail reason as shown on screen, in the chosen language (lib/fail-reason.ts). */
function failReasonOnScreen(c: Call, locale: string, t: (key: string) => string): string {
  return c.isConverted === true ? "" : localizeFailReason(c.failReason, locale, t);
}

/** Not answered, yet converted: its destination bills on "Incoming Call"
 *  (backend CH-247). Its Status reads "Missed With Conversion". */
function convertedUnanswered(c: Call): boolean {
  return c.isConverted === true && c.status !== "completed" && c.status !== "in-progress";
}

/** Status wording in the exported file (English, as the rest of the file). */
const MISSED_WITH_CONVERSION = "Missed With Conversion";

function statusExportText(c: Call): string {
  if (convertedUnanswered(c)) return MISSED_WITH_CONVERSION;
  return isBusy(c) ? "Busy" : STATUS_LABEL_FALLBACK[c.status];
}

/** For every call this page holds, the server file's Status and Fail Reason
 *  match the screen: "Missed With Conversion", and no fail reason on a call
 *  that converted. An older backend wrote the plain status there. */
function withScreenStatus(table: string[][], callsById: Map<string, Call>): string[][] {
  if (table.length < 2) return table;
  const header = table[0].map((h) => h.trim().toUpperCase());
  const statusCol = header.indexOf("STATUS");
  const reasonCol = header.indexOf("FAIL REASON");
  const idCol = ["CALL ID", "UUID", "ID"].map((h) => header.indexOf(h)).find((i) => i >= 0) ?? -1;
  if (idCol < 0 || (statusCol < 0 && reasonCol < 0)) return table;
  return table.map((row, i) => {
    if (i === 0) return row;
    const call = callsById.get((row[idCol] ?? "").trim());
    if (!call || call.isConverted !== true) return row;
    const next = [...row];
    if (statusCol >= 0 && convertedUnanswered(call)) next[statusCol] = MISSED_WITH_CONVERSION;
    if (reasonCol >= 0) next[reasonCol] = "";
    return next;
  });
}

/** The server's export file uses the backend's own wording; give it the same labels as the screen. */
function withFailReasonLabels(table: string[][]): string[][] {
  if (table.length < 2) return table;
  const col = table[0].findIndex((h) => h.trim().toUpperCase() === "FAIL REASON");
  if (col < 0) return table;
  return table.map((row, i) => (i === 0 ? row : row.map((cell, j) => (j === col ? failReasonLabel(cell) : cell))));
}

/**
 * TTC in the exported file. The server's file can lag behind the screen (an
 * older backend wrote 0 for every answered call), so for every call this page
 * holds, the file's TTC column is taken from the same value the Call Log
 * shows: hh:mm:ss, blank when the call was never answered.
 */
function withScreenTtc(table: string[][], callsById: Map<string, Call>): string[][] {
  if (table.length < 2) return table;
  const header = table[0].map((h) => h.trim().toUpperCase());
  const ttcCol = header.indexOf("TTC");
  const idCol = ["CALL ID", "UUID", "ID"].map((h) => header.indexOf(h)).find((i) => i >= 0) ?? -1;
  if (ttcCol < 0 || idCol < 0) return table;
  return table.map((row, i) => {
    if (i === 0) return row;
    const call = callsById.get((row[idCol] ?? "").trim());
    if (!call) return row;
    const ttc = getTTCSeconds(call);
    const next = [...row];
    next[ttcCol] = ttc === null ? "" : formatHMS(ttc);
    return next;
  });
}

const HANG_UP_LABEL: Record<HangUpSide, string> = {
  caller: "Caller hung up",
  noAnswer: "No answer",
  busy: "Buyer busy",
  open: "—",
};

/**
 * A CDR row sometimes carries `publisherId` without `publisherName` (the
 * backend's own join into its publishers table came back empty even though
 * the FK is there) — resolve it against the publishers list already loaded
 * for the account instead of showing "—" when we actually know who it is.
 */
function resolvePublisherName(c: Call, publisherNameById: Map<string, string>): string {
  if (c.publisherName) return c.publisherName;
  if (c.publisherId) return publisherNameById.get(c.publisherId) ?? "";
  return "";
}

/* ─── Sorting (click a column header; same arrows as the Call Summary) ─── */

/** Columns the Call Log can be sorted by: the call date plus every data
 *  column except Hang up, Fail reason and Recording. */
type LogSortKey = "date" | Exclude<ColumnKey, "hangUp" | "failReason" | "recording">;
type SortDir = "asc" | "desc";

/** Text columns start A → Z; numbers, dates and status start highest first. */
const TEXT_SORT_KEYS = new Set<LogSortKey>(["campaign", "publisher", "buyer"]);

/** Live calls sort above finished ones (highest first = Live, Ringing,
 *  Completed, No answer, Rejected, Failed). */
const STATUS_RANK: Record<CallStatus, number> = {
  "in-progress": 5,
  ringing: 4,
  completed: 3,
  missed: 2,
  rejected: 1,
  failed: 0,
};

const digitsOf = (s: string | undefined) => Number((s ?? "").replace(/\D/g, "")) || 0;

function sortValue(c: Call, key: LogSortKey, publisherNameById: Map<string, string>): number | string {
  switch (key) {
    case "date":
      return c.startedAt;
    case "campaign":
      return (c.campaignName ?? "").toLowerCase();
    case "publisher":
      return resolvePublisherName(c, publisherNameById).toLowerCase();
    case "buyer":
      return (c.buyerName ?? "").toLowerCase();
    case "caller":
      return digitsOf(c.callerNumber);
    case "dialed":
      return digitsOf(c.destinationNumber);
    case "repeated":
      return c.isDuplicate ? 1 : 0;
    case "revenue":
      return c.revenue;
    case "payout":
      return customerPayout(c);
    case "ttc":
      // Never answered sorts below every answered call.
      return getTTCSeconds(c) ?? -1;
    case "duration":
      return c.durationSec;
    case "status":
      return STATUS_RANK[c.status];
  }
}

function compareCalls(a: Call, b: Call, key: LogSortKey, dir: SortDir, publisherNameById: Map<string, string>): number {
  const va = sortValue(a, key, publisherNameById);
  const vb = sortValue(b, key, publisherNameById);
  let r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
  if (dir === "desc") r = -r;
  // Ties: most recent call first, so equal values stay in time order.
  return r !== 0 ? r : b.startedAt - a.startedAt;
}

/** A column header that sorts the Call Log; arrow shows the current order. */
function LogSortHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = "center",
}: {
  label: string;
  sortKey: LogSortKey;
  active: LogSortKey;
  dir: SortDir;
  onClick: (key: LogSortKey) => void;
  align?: "left" | "center" | "right";
}) {
  const isActive = active === sortKey;
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={cn(
        "inline-flex w-full items-center gap-1 uppercase transition-colors focus-visible:outline-none",
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

/** Single source of truth for export cell values. Numbers stay numeric. */
function logCellValue(c: Call, key: ColumnKey, publisherNameById: Map<string, string>): number | string {
  switch (key) {
    case "campaign":
      return c.campaignName;
    case "publisher":
      return resolvePublisherName(c, publisherNameById);
    case "caller":
      return formatCallerId(c.callerNumber);
    case "dialed":
      return toE164(c.destinationNumber);
    case "repeated":
      return c.isDuplicate ? "Yes" : "No";
    case "buyer":
      return c.buyerName ?? "";
    case "revenue":
      return c.revenue;
    case "payout":
      return customerPayout(c);
    case "ttc": {
      const ttcSec = getTTCSeconds(c);
      return ttcSec === null ? "" : formatHMS(ttcSec);
    }
    case "duration":
      return formatHMS(c.durationSec);
    case "hangUp":
      return HANG_UP_LABEL[getHangUpSide(c)];
    case "status":
      return statusExportText(c);
    case "failReason":
      // The backend's own reason (block_reason) - never a guessed one.
      return failReasonText(c);
    case "recording":
      return c.recordingUrl ?? "";
  }
}

// Numeric columns of the formatted file (headers in capitals, duration in minutes).
const SERVER_EXPORT_NUMERIC_HEADERS = CALL_LOG_NUMERIC_HEADERS;

/** Header names the backend export may use for the caller's number. */
const CALLER_HEADERS = new Set(["caller", "callerid", "callernumber"]);

/** The backend export sends caller IDs as stored (often without the leading
 *  "1"). Format that one column the same way the call log shows it on screen
 *  (formatCallerId — e.g. 7202664680 → 17202664680). Every other column,
 *  and the header row, is left exactly as the backend sent it. */
function formatExportCallerColumn(table: string[][]): string[][] {
  if (table.length === 0) return table;
  const col = table[0].findIndex((h) => CALLER_HEADERS.has(h.toLowerCase().replace(/[^a-z]/g, "")));
  if (col < 0) return table;
  return table.map((row, i) =>
    i === 0 || !row[col]?.trim() ? row : row.map((cell, j) => (j === col ? formatCallerId(cell) : cell)),
  );
}

/** Rows back to CSV text, quoting only values that need it (same rule as
 *  lib/export's CSV writer). */
function rowsToCsv(table: string[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return table.map((row) => row.map(esc).join(",")).join("\n");
}

interface CallLogTableProps {
  calls: Call[];
  exportQuery?: Omit<CallLogQuery, "page" | "pageSize"> | null;
  /** Called after a manual hang-up with the backend's final state for the
   *  row, so the owner of `calls` can refresh that record in place. */
  onCallPatched?: (id: string, patch: Partial<Call>) => void;
  /** Optional limit for the visible rows (default 50). */
  limit?: number;
  /** True while `calls` reflects a backend request in flight (e.g. the
   *  Connected/Qualified click-filters, which query the API directly rather
   *  than filtering an already-loaded set) — shows a loading row instead of
   *  the empty-state message so a still-loading result doesn't briefly read
   *  as "no calls match." */
  loading?: boolean;
}

export function CallLogTable({
  calls,
  limit = 50,
  loading = false,
  onCallPatched,
  exportQuery = null,
}: CallLogTableProps) {
  const { t, locale } = useTranslation();
  const timeZone = useUIStore((s) => s.reportTimezone);
  const publishers = usePublishersStore((s) => s.publishers);
  // Blocked Numbers list — callers on it are flagged in red in the Caller ID
  // column so an operator can see at a glance that a call came from a
  // number they've blocked. Hydrated on app boot with the other stores.
  // Matched on the national number, so "7194683580" and "+17194683580" are the same caller.
  const isBlocked = useBlockedCallerMatcher();
  const publisherNameById = React.useMemo(
    () => new Map(publishers.map((p) => [p.id, p.name])),
    [publishers],
  );
  const [query, setQuery] = React.useState("");
  // The call whose activity ("X-ray") panel is open, if any.
  const [activityCall, setActivityCall] = React.useState<Call | null>(null);
  const [columnsState, setColumns] = React.useState<Record<ColumnKey, boolean>>(ALL_VISIBLE);
  // Money a partner is not told: the backend sends null for these, and a
  // hidden column beats rendering null as $0.00. Buyer loses Payout,
  // publisher loses Revenue; everyone else keeps their picker choices.
  const role = useAuthStore((st) => st.user?.role);
  // Plus the columns the admin unticked under this partner's Reporting
  // visibility (buyer / publisher logins only; never the admin's own view).
  const partnerHidden = usePartnerHiddenColumns().log;
  // And what the admin switched off under this partner's Permissions:
  // Audio Recording, Download Reports, Block Numbers, Manage Traffic.
  const partnerCan = usePartnerPermissions().can;
  // Staff logins whose role has Reporting > Download unticked get no export
  // button either (Sir, 20 Oct: restrict downloads for Xypheria). The file is
  // built here in the browser, so the server-side block alone never stopped it.
  const canDownload = usePermissions().can("reporting", "download") && partnerCan("download_reports");
  const columns = React.useMemo(() => {
    const out = { ...columnsState };
    if (role === "buyer") out.payout = false;
    if (role === "publisher") out.revenue = false;
    for (const k of partnerHidden) if (k in out) out[k as ColumnKey] = false;
    if (!partnerCan("audio_recording")) out.recording = false;
    return out;
  }, [columnsState, role, partnerHidden, partnerCan]);
  const [pageSize, setPageSize] = React.useState<number>(limit);
  const [page, setPage] = React.useState(0);
  // Most recent call first until a column header is clicked.
  const [sortKey, setSortKey] = React.useState<LogSortKey>("date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const requestSort = (key: LogSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(TEXT_SORT_KEYS.has(key) ? "asc" : "desc");
    }
  };
  const [exporting, setExporting] = React.useState(false);
  // For the export's DESTINATION NAME / NUMBER columns (the server's file has neither).
  const destinations = useDestinationsStore((s) => s.destinations);
  const destinationNames = React.useMemo(() => destinationNameMap(destinations), [destinations]);
  const callsById = React.useMemo(() => new Map(calls.map((c) => [c.id, c])), [calls]);

  // Reset to page 0 whenever the result set or page size changes so we never
  // sit past the end of the filtered list.
  React.useEffect(() => {
    setPage(0);
  }, [query, pageSize, calls.length, sortKey, sortDir]);

  const colSpan = 3 + COLUMNS.filter((c) => columns[c.id]).length; // +expander +Call date +actions
  const toggleColumn = (id: ColumnKey) =>
    setColumns((v) => ({ ...v, [id]: !v[id] }));

  // A typed phone number is also searched on the server, across the whole log
  // for this page's dates and filters (see lib/call-search.ts). Until it
  // answers, the on-screen matches show at once.
  const server = useServerCallSearch(exportQuery, query, timeZone);

  const filtered = React.useMemo(() => {
    const q = query.trim();
    const source = server.results ?? calls;
    const sorted = [...source].sort((a, b) => compareCalls(a, b, sortKey, sortDir, publisherNameById));
    return q
      ? sorted.filter((c) =>
          callMatches(
            c,
            q,
            `${c.campaignName} ${resolvePublisherName(c, publisherNameById)} ${c.buyerName ?? ""} ${c.callerNumber} ${c.calledNumber ?? ""} ${c.destinationNumber}`,
          ),
        )
      : sorted;
  }, [calls, query, publisherNameById, server.results, sortKey, sortDir]);
  /** Nothing on screen yet, but the server is still looking. */
  const searchingAll = server.searching && filtered.length === 0;

  const visible = React.useMemo(
    () => filtered.slice(page * pageSize, page * pageSize + pageSize),
    [filtered, page, pageSize],
  );

  // Fail Reason comments set in two parallel columns: the first word of every
  // comment starts at the same place, and so does the second word ("Not" and
  // "No" in one row, "Connected" and "Destination" in the next). The widths
  // come from the longest word on the page, measured by the browser in the real
  // font (an invisible copy of that word sets each column's width), so the block
  // has no spare room on either side and sits exactly centred under the header.
  const reasonLayout = React.useMemo(() => {
    let first = "";
    let rest = "";
    for (const c of visible) {
      const [a, ...b] = failReasonOnScreen(c, locale, t).split(" ");
      const tail = b.join(" ");
      if (a.length > first.length) first = a;
      if (tail.length > rest.length) rest = tail;
    }
    return { first, rest };
  }, [visible, locale, t]);

  /* ─── Recording playback ───────────────────────────────────────────
   * One <audio> element for the whole table: starting a second recording
   * stops the first, and there's never a stack of orphaned players. The
   * row's own `recordingUrl` is used when the CDR carried one; otherwise
   * we resolve it through GET /api/analytics/calls/{id}/recording, which
   * is what the endpoint exists for. */
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  // Resolved URLs are cached so replaying a row doesn't refetch.
  const urlCache = React.useRef(new Map<string, string>());

  React.useEffect(() => {
    // Release the element (and stop audio) when the table unmounts.
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const resolveRecordingUrl = React.useCallback(async (call: Call): Promise<string> => {
    if (call.recordingUrl) return call.recordingUrl;
    const cached = urlCache.current.get(call.id);
    if (cached) return cached;
    const res = await analyticsService.recordingUrl(call.id);
    const url =
      ("url" in res && res.url) ||
      ("recordingUrl" in res && res.recordingUrl) ||
      "";
    if (!url) throw new Error("No recording URL returned");
    urlCache.current.set(call.id, url);
    return url;
  }, []);

  const toggleRecording = React.useCallback(
    async (call: Call) => {
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;

      // Second click on the row that's already playing → pause.
      if (playingId === call.id && !audio.paused) {
        audio.pause();
        setPlayingId(null);
        return;
      }

      audio.pause();
      setLoadingId(call.id);
      try {
        const url = await resolveRecordingUrl(call);
        audio.src = url;
        audio.onended = () => setPlayingId((id) => (id === call.id ? null : id));
        audio.onerror = () => {
          setPlayingId((id) => (id === call.id ? null : id));
          toast.error(t("toolsUI.reports.callLog.actions.recordingError"));
        };
        await audio.play();
        setPlayingId(call.id);
      } catch {
        setPlayingId(null);
        toast.error(t("toolsUI.reports.callLog.actions.recordingError"));
      } finally {
        setLoadingId((id) => (id === call.id ? null : id));
      }
    },
    [playingId, resolveRecordingUrl, t],
  );

  // CH-267: the export opens "choose the details" before it downloads.
  const [pendingExport, setPendingExport] = React.useState<{ format: ExportFormat; table: string[][] } | null>(null);

  const downloadTable = (format: ExportFormat, full: string[][], keep: string[], names: Record<string, string>) => {
    const table = applyColumnChoice(full, keep, names);
    // Number and link formatting follow the headings, renamed or not.
    const renamed = (list: readonly string[]) =>
      list.flatMap((h) => [h, (names[h] || "").trim()]).filter(Boolean);
    const count = Math.max(table.length - 1, 0);
    const stem = dateStamped("call-log");
    if (format === "csv") {
      triggerDownload(new Blob([rowsToCsv(table)], { type: "text/csv;charset=utf-8;" }), `${stem}.csv`);
    } else {
      triggerDownload(
        csvRowsToXLSX(table, "Call log", renamed(SERVER_EXPORT_NUMERIC_HEADERS), {
          boldHeader: true,
          linkColumns: renamed(CALL_LOG_LINK_HEADERS),
        }),
        `${stem}.xlsx`,
      );
    }
    toast.success(t("toolsUI.reports.callLog.toastExport").replace("{count}", formatNumber(count)).replace("{format}", format.toUpperCase()));
  };

  const exportFromServer = async (format: ExportFormat, serverQuery: Omit<CallLogQuery, "page" | "pageSize">) => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await analyticsService.exportCallsCsv({ ...serverQuery, timezone: serverQuery.timezone ?? timeZone });
      const text = await blob.text();
      // Caller IDs in the file match the screen (with the leading "1"); then
      // capital headers, capitalised Status, and Duration in minutes.
      const table = withScreenStatus(withFailReasonLabels(withScreenTtc(
        formatCallLogTable(formatExportCallerColumn(parseCSV(text)), {
          destinationFor: (callId) => destinationOf(callsById.get(callId), destinationNames),
        }),
        callsById,
      )), callsById);
      setPendingExport({ format, table });
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("toolsUI.reports.callLog.exportError")));
    } finally {
      setExporting(false);
    }
  };

  const onExport = (format: ExportFormat) => {
    if (exportQuery && !query.trim()) {
      void exportFromServer(format, exportQuery);
      return;
    }
    const dateCol: ExportColumn<Call> = {
      label: t("toolsUI.reports.callLog.columns.callDate"),
      value: (c) => new Date(c.startedAt).toISOString(),
    };
    const dataCols: ExportColumn<Call>[] = COLUMNS.filter((c) => columns[c.id]).flatMap((c): ExportColumn<Call>[] => {
      if (c.id === "duration") return [{ label: DURATION_HEADER, value: (row) => formatDuration(row.durationSec) }];
      if (c.id === "caller") return [{ label: "CALLER ID", value: (row) => exportNumber(row.callerNumber) }];
      if (c.id === "dialed") return [{ label: "CALLED NUMBER", value: (row) => exportNumber(row.calledNumber) }];
      const col: ExportColumn<Call> = { label: t(COLUMN_LABEL_KEYS[c.id]), value: (row) => logCellValue(row, c.id, publisherNameById) };
      // Destination name and number sit right after the buyer.
      return c.id === "buyer"
        ? [
            col,
            { label: DESTINATION_NAME_HEADER, value: (row) => destinationOf(row, destinationNames).name },
            { label: DESTINATION_NUMBER_HEADER, value: (row) => destinationOf(row, destinationNames).number },
          ]
        : [col];
    });
    downloadRows(format, upperLabels([dateCol, ...dataCols]), filtered, dateStamped("call-log"), "Call log", {
      boldHeader: true,
      linkColumns: CALL_LOG_LINK_HEADERS,
    });
    toast.success(t("toolsUI.reports.callLog.toastExport").replace("{count}", formatNumber(filtered.length)).replace("{format}", format.toUpperCase()));
  };

  return (
    <>
    <ExportColumnsDialog
      header={pendingExport ? pendingExport.table[0] ?? [] : null}
      format={pendingExport?.format === "csv" ? "csv" : "xlsx"}
      onCancel={() => setPendingExport(null)}
      onConfirm={(keep, names) => {
        if (pendingExport) downloadTable(pendingExport.format, pendingExport.table, keep, names);
        setPendingExport(null);
      }}
    />
    <Card className="overflow-hidden p-0">
      {/* Section title */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-foreground">{t("toolsUI.reports.callLog.title")}</div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("toolsUI.reports.callLog.searchPlaceholder")}
              className={cn("h-8 w-56 pl-7 text-xs", query && "pr-7")}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("toolsUI.callLogs.toolbar.clearAria")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("toolsUI.reports.callLog.columnSettings")}>
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-0">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-semibold">{t("toolsUI.callLogs.toolbar.columns")}</span>
                <button
                  type="button"
                  onClick={() => setColumns(ALL_VISIBLE)}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("toolsUI.reports.callLog.showAll")}
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto px-2 py-2">
                {COLUMNS.map((col) => {
                  const id = `log-col-${col.id}`;
                  return (
                    <Label
                      key={col.id}
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-secondary/50"
                    >
                      <Checkbox
                        id={id}
                        checked={columns[col.id]}
                        onCheckedChange={() => toggleColumn(col.id)}
                      />
                      <span>{t(COLUMN_LABEL_KEYS[col.id])}</span>
                    </Label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          {canDownload && (
            <ExportMenu onExport={onExport}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={exporting}
                aria-label={t("toolsUI.callLogs.toolbar.export")}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </ExportMenu>
          )}
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {/* Row expander — opens the call's activity panel. */}
                <TableHead className="w-9 pl-4" />
                <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.callDate")} sortKey="date" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>
                {columns.campaign && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.campaign")} sortKey="campaign" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.publisher && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.publisher")} sortKey="publisher" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.caller && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.callerId")} sortKey="caller" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.dialed && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.dialed")} sortKey="dialed" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.repeated && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.repeated")} sortKey="repeated" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.buyer && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.buyer")} sortKey="buyer" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.revenue && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.revenue")} sortKey="revenue" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.payout && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.payout")} sortKey="payout" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.ttc && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.ttc")} sortKey="ttc" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.duration && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.duration")} sortKey="duration" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.hangUp && <TableHead className="text-center">{t("toolsUI.reports.callLog.columns.hangUp")}</TableHead>}
                {columns.status && <TableHead className="text-center"><LogSortHeader label={t("toolsUI.reports.callLog.columns.status")} sortKey="status" active={sortKey} dir={sortDir} onClick={requestSort} /></TableHead>}
                {columns.failReason && <TableHead className="text-center">{t("toolsUI.reports.callLog.columns.failReason")}</TableHead>}
                {columns.recording && <TableHead>{t("toolsUI.reports.callLog.columns.rec")}</TableHead>}
                <TableHead className="pr-6">{t("toolsUI.reports.callLog.columns.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || searchingAll ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="pl-6 py-8 text-center text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {searchingAll && !loading ? t("toolsUI.reports.callLog.searchingAll") : t("toolsUI.reports.callLog.loading")}
                    </span>
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="pl-6 py-8 text-center text-sm text-muted-foreground">
                    {t("toolsUI.reports.callLog.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((c) => {
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="w-9 pl-4 pr-0">
                        <button
                          type="button"
                          onClick={() => setActivityCall(c)}
                          aria-label={t("toolsUI.reports.activity.open")}
                          title={t("toolsUI.reports.activity.open")}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-accent"
                        >
                          <ListTree className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                      <TableCell className={NUMBER_CELL}>
                        {timeLabel(c.startedAt, timeZone)}
                      </TableCell>
                      {columns.campaign && (
                        <TableCell className={CELL} title={locale === "en" ? undefined : c.campaignName}>
                          {localizeName(c.campaignName, locale)}
                        </TableCell>
                      )}
                      {columns.publisher && (
                        <TableCell className={CELL} title={locale === "en" ? undefined : resolvePublisherName(c, publisherNameById) || undefined}>
                          {localizeName(resolvePublisherName(c, publisherNameById), locale) || "—"}
                        </TableCell>
                      )}
                      {columns.caller && (
                        <TableCell className={NUMBER_CELL}>
                          {isBlocked(c.callerNumber, c.campaignId) ? (
                            <span
                              className="text-destructive"
                              title={t("toolsUI.reports.callLog.callerIdBlocked")}
                            >
                              {formatCallerId(c.callerNumber)}
                            </span>
                          ) : (
                            formatCallerId(c.callerNumber)
                          )}
                        </TableCell>
                      )}
                      {columns.dialed && (
                        <TableCell className={NUMBER_CELL}>
                          {toE164(c.destinationNumber)}
                        </TableCell>
                      )}
                      {columns.repeated && (
                        <TableCell className={cn(CELL, "text-center")}>
                          {c.isDuplicate ? t("toolsUI.reports.callLog.repeatedYes") : t("toolsUI.reports.callLog.repeatedNo")}
                        </TableCell>
                      )}
                      {columns.buyer && (
                        <TableCell className={CELL} title={locale === "en" ? undefined : c.buyerName ?? undefined}>
                          {localizeName(c.buyerName, locale) || "—"}
                        </TableCell>
                      )}
                      {columns.revenue && (
                        <TableCell className={`${CELL} text-center`}>
                          {formatCurrency(c.revenue, true)}
                        </TableCell>
                      )}
                      {/* Customer-facing payout: revenue minus the publisher's
                          share (see `customerPayout`). The publisher's cut
                          itself (the raw `payout` field) is internal and is
                          not shown here. */}
                      {columns.payout && (
                        <TableCell className={`${CELL} text-center`}>
                          {formatCurrency(customerPayout(c), true)}
                        </TableCell>
                      )}
                      {columns.ttc && (
                        <TableCell className={NUMBER_CELL}>
                          {getTTCSeconds(c) === null ? "\u2014" : formatHMS(getTTCSeconds(c)!)}
                        </TableCell>
                      )}
                      {columns.duration && (
                        <TableCell className={NUMBER_CELL}>
                          {c.status === "in-progress" ? <LiveDuration call={c} /> : formatHMS(c.durationSec)}
                        </TableCell>
                      )}
                      {columns.hangUp && (
                        <TableCell className="text-center">
                          <HangUpCell call={c} />
                        </TableCell>
                      )}
                      {columns.status && (
                        <TableCell>
                          {/* Fixed width so Live / Completed / No Answer are
                              identical pills rather than sized to their text.
                              A missed call that converted (destination paid on
                              Incoming) reads "Missed With Conversion" in blue;
                              that pill grows to fit its longer text. */}
                          {convertedUnanswered(c) ? (
                            <Badge variant="default" className="min-w-24 justify-center whitespace-nowrap bg-accent text-accent-foreground">
                              {t("status.missedWithConversion")}
                            </Badge>
                          ) : (
                            <Badge variant={statusVariant(c.status)} className="w-24 justify-center">
                              {isBusy(c) ? t("toolsUI.reports.callLog.statusLabel.busy") : t(STATUS_LABEL_KEYS[c.status])}
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      {columns.failReason && (
                        <TableCell className={`${CELL} text-center`}>
                          {(() => {
                            const reason = failReasonOnScreen(c, locale, t);
                            if (!reason) return "\u2014";
                            const [firstWord, ...others] = reason.split(" ");
                            return (
                              <div className="mx-auto flex w-fit gap-x-[0.6em] whitespace-nowrap text-left">
                                <span className="grid">
                                  <span className="[grid-area:1/1]">{firstWord}</span>
                                  <span aria-hidden className="invisible h-0 overflow-hidden [grid-area:1/1]">
                                    {reasonLayout.first}
                                  </span>
                                </span>
                                <span className="grid">
                                  <span className="[grid-area:1/1]">{others.join(" ")}</span>
                                  <span aria-hidden className="invisible h-0 overflow-hidden [grid-area:1/1]">
                                    {reasonLayout.rest}
                                  </span>
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                      )}
                      {columns.recording && (
                        <TableCell>
                          <RecordingCell
                            call={c}
                            playing={playingId === c.id}
                            loading={loadingId === c.id}
                            onToggle={() => toggleRecording(c)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="pr-6">
                        <CallRowActions
                          call={c}
                          onCallPatched={onCallPatched}
                          canBlock={partnerCan("block_numbers")}
                          canHangup={partnerCan("manage_traffic")}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-border px-6 py-3">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </div>
      </CardContent>
      <CallActivityPanel call={activityCall} onOpenChange={(open) => !open && setActivityCall(null)} />
    </Card>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

/**
 * Recording cell — play/pause toggle for the row's call recording, plus a
 * direct link when the CDR itself carried `recordingUrl` (rows that only
 * resolve one on demand via `/api/analytics/calls/{id}/recording` get just
 * the play button, since there's no URL yet to link to). Only rows that are
 * known to have no recording at all render the em-dash.
 */
function RecordingCell({
  call,
  playing,
  loading,
  onToggle,
}: {
  call: Call;
  playing: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  // `completed` calls always have (or can resolve) a recording; anything
  // that never connected has nothing to play.
  const hasRecording = Boolean(call.recordingUrl) || call.status === "completed";
  if (!hasRecording) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", playing && "text-accent")}
        disabled={loading}
        aria-label={t("toolsUI.reports.callLog.actions.playRecording")}
        aria-pressed={playing}
        onClick={onToggle}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
      {call.recordingUrl && (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={t("toolsUI.reports.callLog.actions.openRecording")}
        >
          <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}
    </span>
  );
}

/**
 * Hang-up indicator — icon only, colored to match the muted tag elements in
 * the adjacent Tag column (text-muted-foreground). The label is in the title
 * tooltip for accessibility.
 */
/** Tooltip text per hang-up side, in the chosen language. */
const HANG_UP_KEYS: Record<Exclude<HangUpSide, "open">, string> = {
  caller: "toolsUI.reports.callLog.hangUp.caller",
  noAnswer: "hangUp.noAnswer",
  busy: "hangUp.busy",
};

function HangUpCell({ call }: { call: Call }) {
  const { t } = useTranslation();
  const side = getHangUpSide(call);
  if (side === "open") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span
      title={t(HANG_UP_KEYS[side])}
      className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground"
    >
      <PhoneOff className="h-3 w-3" />
    </span>
  );
}


/** Inline icon actions per row: copy caller, block caller, bill/adjust —
 *  plus hang-up while the call is still live. */
function CallRowActions({
  call,
  onCallPatched,
  canBlock = true,
  canHangup = true,
}: {
  call: Call;
  onCallPatched?: (id: string, patch: Partial<Call>) => void;
  /** False for a partner login whose Block Numbers permission is off. */
  canBlock?: boolean;
  /** False for a partner login whose Manage Traffic permission is off. */
  canHangup?: boolean;
}) {
  const { t } = useTranslation();
  const caller = formatCallerId(call.callerNumber);
  const isLive = call.status === "in-progress" || call.status === "ringing";
  const [hangupArmed, setHangupArmed] = React.useState(false);
  const [hangingUp, setHangingUp] = React.useState(false);

  React.useEffect(() => {
    if (!hangupArmed) return;
    const id = window.setTimeout(() => setHangupArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [hangupArmed]);

  const onHangup = async () => {
    if (!hangupArmed) {
      setHangupArmed(true);
      return;
    }
    setHangingUp(true);
    try {
      const { patch, message } = await callsService.hangup(call.id);
      onCallPatched?.(call.id, patch);
      toast.success(t("toolsUI.reports.callLog.actions.toastHungUp").replace("{number}", caller), {
        description: message,
      });
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("toolsUI.reports.callLog.actions.toastHangupError")));
    } finally {
      setHangingUp(false);
      setHangupArmed(false);
    }
  };

  const onCopy = async () => {
    try {
      // Clipboard gets the dialable E.164 form, not the "(323) 624-9499"
      // display string — it's going into a dialer or a CRM, not a sentence.
      await navigator.clipboard.writeText(toE164(call.callerNumber));
      toast.success(t("toolsUI.reports.callLog.actions.toastCopied").replace("{number}", caller));
    } catch {
      toast.error(t("toolsUI.reports.callLog.actions.toastCopyError"));
    }
  };

  // Block / unblock for real: adds to or removes from the Blocked Numbers
  // list (this button used to show a "Blocked" message and save nothing).
  const isBlockedCaller = useBlockedCallerMatcher();
  const blockedEntries = useBlockedNumbersStore((s) => s.numbers);
  const addBlocked = useBlockedNumbersStore((s) => s.add);
  const removeBlocked = useBlockedNumbersStore((s) => s.remove);
  const blocked = isBlockedCaller(call.callerNumber, call.campaignId);
  const [blocking, setBlocking] = React.useState(false);

  const onBlock = async () => {
    if (blocking) return;
    setBlocking(true);
    try {
      if (blocked) {
        // Every entry for this exact number that applies to this call - the
        // same number blocked twice must not stay blocked after one unblock.
        const own = blockedEntries.filter(
          (e) =>
            e.scope === "number" &&
            national(e.number) === national(call.callerNumber) &&
            (!e.campaignId || e.campaignId === call.campaignId),
        );
        if (own.length === 0) {
          // Blocked by a prefix rule, which covers other numbers too.
          toast.info(t("toolsUI.reports.callLog.actions.prefixBlocked"));
          return;
        }
        for (const e of own) await removeBlocked(e.id);
        toast.success(t("toolsUI.suppression.blockedNumbers.toastUnblocked").replace("{number}", caller));
      } else {
        await addBlocked({ number: caller, scope: "number" });
        toast.success(t("toolsUI.reports.callLog.actions.toastBlocked").replace("{number}", caller), {
          description: t("toolsUI.reports.callLog.actions.toastBlockedDesc"),
        });
      }
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("toolsUI.reports.callLog.actions.blockError")));
    } finally {
      setBlocking(false);
    }
  };

  const onBill = () => {
    const ttcSec = getTTCSeconds(call);
    const ttc = ttcSec === null ? "\u2014" : formatHMS(ttcSec);
    if (call.status === "completed" || call.status === "in-progress") {
      toast.success(t("toolsUI.reports.callLog.actions.toastPayoutReview").replace("{number}", caller), {
        description: t("toolsUI.reports.callLog.actions.toastPayoutReviewDesc")
          .replace("{payout}", formatCurrency(customerPayout(call), true))
          .replace("{ttc}", ttc),
      });
    } else {
      toast.success(t("toolsUI.reports.callLog.actions.toastBilledMissed").replace("{number}", caller), {
        description: t("toolsUI.reports.callLog.actions.toastBilledMissedDesc")
          .replace("{reason}", t("toolsUI.reports.callLog.actions.noConnect"))
          .replace("{ttc}", ttc),
      });
    }
  };

  return (
    <div className="inline-flex items-center gap-0.5">
      {/* Hang up — only offered while the call is live; the backend
          answers 400 for anything that has already ended. Two clicks:
          the first arms it, the second (within 4 s) sends. */}
      {isLive && canHangup && (
        <Button
          variant={hangupArmed ? "destructive" : "ghost"}
          size="sm"
          className={cn("h-7 gap-1 px-2 text-[11px]", !hangupArmed && "text-muted-foreground hover:text-destructive")}
          aria-label={t("toolsUI.reports.callLog.actions.hangup")}
          disabled={hangingUp}
          onClick={onHangup}
        >
          <PhoneOff className="h-3.5 w-3.5" />
          {hangupArmed ? t("toolsUI.reports.callLog.actions.hangupConfirm") : t("toolsUI.reports.callLog.actions.hangup")}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={t("toolsUI.reports.callLog.actions.copyCaller")}
        onClick={onCopy}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      {canBlock && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            blocked ? "text-destructive hover:text-foreground" : "text-muted-foreground hover:text-destructive",
          )}
          disabled={blocking}
          aria-label={t(blocked ? "toolsUI.reports.callLog.actions.unblockCaller" : "toolsUI.reports.callLog.actions.blockCaller")}
          title={t(blocked ? "toolsUI.reports.callLog.actions.unblockCaller" : "toolsUI.reports.callLog.actions.blockCaller")}
          onClick={onBlock}
        >
          <Ban className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-[color:var(--success)]"
        aria-label={t("toolsUI.reports.callLog.actions.billAdjust")}
        onClick={onBill}
      >
        <DollarSign className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
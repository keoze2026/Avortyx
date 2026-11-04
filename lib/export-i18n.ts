/**
 * CH-528: call-log export files in the language chosen in the portal.
 *
 * 009K, 4 Nov: "When you change language then export excel language aren't
 * converting." The Call Summary file was already translated; the call-log
 * files (Reports > Call log, both the server's file and the one built in the
 * browser, and the Call Logs page) kept English headings - CALLER ID, CALLED
 * NUMBER, DESTINATION NAME, HANG UP - and English values: Completed, No
 * Answer, Yes / No, Caller hung up, the fail reasons.
 *
 * Every export is built in English first (the formatting rules and the
 * column choices are keyed on the English headings), then this turns the
 * headings and the known values into the chosen language - the same words the
 * screen shows. English is left exactly as it was. A heading the user renamed
 * in the column chooser is kept as they typed it. Numbers, names, phone
 * numbers and dates are never touched.
 */
import type { ExportColumn } from "@/lib/export";
import { localizeFailReason } from "@/lib/fail-reason";
import { reportColumnLabel } from "@/lib/i18n/server-text";

type T = (key: string) => string;

/** English heading (capitals) -> the key the screen uses for that column. */
const HEADER_KEYS: Record<string, string> = {
  "CALL DATE": "toolsUI.reports.callLog.columns.callDate",
  STARTED: "toolsUI.reports.callLog.columns.callDate",
  CAMPAIGN: "toolsUI.reports.callLog.columns.campaign",
  PUBLISHER: "toolsUI.reports.callLog.columns.publisher",
  "CALLER ID": "toolsUI.reports.callLog.columns.callerId",
  "CALLED NUMBER": "toolsUI.reports.callLog.columns.dialed",
  REPEATED: "toolsUI.reports.callLog.columns.repeated",
  BUYER: "toolsUI.reports.callLog.columns.buyer",
  "DESTINATION NAME": "x380.destName",
  "DESTINATION NUMBER": "x380.destTfn",
  "DESTINATION TFN": "x380.destTfn",
  REVENUE: "toolsUI.reports.callLog.columns.revenue",
  PAYOUT: "toolsUI.reports.callLog.columns.payout",
  TTC: "toolsUI.reports.callLog.columns.ttc",
  DURATION: "toolsUI.reports.callLog.columns.duration",
  "HANG UP": "toolsUI.reports.callLog.columns.hangUp",
  STATUS: "toolsUI.reports.callLog.columns.status",
  "FAIL REASON": "toolsUI.reports.callLog.columns.failReason",
  RECORDING: "toolsUI.reports.callLog.columns.recording",
};

/** Status words the export writes (any case) -> the screen's key. */
const STATUS_KEYS: Record<string, string> = {
  completed: "toolsUI.reports.callLog.statusLabel.completed",
  "no answer": "toolsUI.reports.callLog.statusLabel.missed",
  missed: "toolsUI.reports.callLog.statusLabel.missed",
  failed: "toolsUI.reports.callLog.statusLabel.failed",
  rejected: "toolsUI.reports.callLog.statusLabel.rejected",
  ringing: "toolsUI.reports.callLog.statusLabel.ringing",
  live: "toolsUI.reports.callLog.statusLabel.live",
  "in progress": "toolsUI.reports.callLog.statusLabel.live",
  busy: "hangUp.busy",
  "missed with conversion": "status.missedWithConversion",
  // CH-529: a TFN test call (CH-378).
  passed: "x378.passed",
};

const HANG_UP_KEYS: Record<string, string> = {
  "caller hung up": "toolsUI.reports.callLog.hangUp.caller",
  "no answer": "hangUp.noAnswer",
  "destination busy": "hangUp.busy",
};

const YES_NO_KEYS: Record<string, string> = {
  yes: "toolsUI.reports.callLog.repeatedYes",
  no: "toolsUI.reports.callLog.repeatedNo",
};
const YES_NO_COLUMNS = new Set(["REPEATED", "QUALIFIED", "CONVERTED"]);

function translated(t: T, key: string, fallback: string): string {
  const text = t(key);
  return text && text !== key ? text : fallback;
}

export interface ExportLocalizer {
  /** Is anything translated at all (false for English). */
  active: boolean;
  /** An English heading in the chosen language, in capitals like the file's. */
  header: (english: string) => string;
  /** A cell of the column headed `englishHeader`, in the chosen language. */
  value: (englishHeader: string, cell: unknown) => unknown;
}

export function exportLocalizer(t: T, locale: string): ExportLocalizer {
  const active = locale !== "en";
  const header = (english: string): string => {
    if (!active) return english;
    const up = english.trim().toUpperCase();
    const key = HEADER_KEYS[up];
    const text = key ? translated(t, key, "") : "";
    const out = text || reportColumnLabel(t, english);
    if (out === english) return english;
    // Capitals where the file writes its headings in capitals (the call log).
    return english === english.toUpperCase() ? out.toLocaleUpperCase(locale) : out;
  };
  const value = (englishHeader: string, cell: unknown): unknown => {
    if (!active || typeof cell !== "string" || !cell.trim()) return cell;
    const col = englishHeader.trim().toUpperCase();
    const word = cell.trim().toLowerCase();
    if (col === "STATUS") return STATUS_KEYS[word] ? translated(t, STATUS_KEYS[word], cell) : cell;
    if (col === "HANG UP") return HANG_UP_KEYS[word] ? translated(t, HANG_UP_KEYS[word], cell) : cell;
    if (col === "FAIL REASON") return localizeFailReason(cell, locale, t) || cell;
    if (YES_NO_COLUMNS.has(col)) return YES_NO_KEYS[word] ? translated(t, YES_NO_KEYS[word], cell) : cell;
    return cell;
  };
  return { active, header, value };
}

/** A table (first row = headings) in the chosen language. Headings at the
 *  positions in `keepAsTyped` (renamed by the user) are left as typed. */
export function localizeTable(
  table: string[][],
  loc: ExportLocalizer,
  opts: { english?: string[]; keepAsTyped?: Set<number> } = {},
): string[][] {
  if (!loc.active || table.length === 0) return table;
  // The English heading of each column (a renamed one still has its English
  // name here, so its values are translated all the same).
  const english = opts.english ?? table[0];
  const keepAsTyped = opts.keepAsTyped ?? new Set<number>();
  return table.map((row, i) =>
    i === 0
      ? row.map((h, j) => (keepAsTyped.has(j) ? h : loc.header(h)))
      : row.map((cell, j) => String(loc.value(english[j] ?? "", cell) ?? "")),
  );
}

/** Columns built in the browser: same headings and values, in the chosen language. */
export function localizeColumns<R>(cols: ExportColumn<R>[], loc: ExportLocalizer): ExportColumn<R>[] {
  if (!loc.active) return cols;
  return cols.map((c) => ({
    ...c,
    label: loc.header(c.label),
    value: (row: R) => loc.value(c.label, c.value(row)) as string | number | null | undefined,
  }));
}

/** Headings in both languages, for the lists that pick number / link columns. */
export function bothLanguages(list: readonly string[], loc: ExportLocalizer): string[] {
  return loc.active ? [...list, ...list.map((h) => loc.header(h))] : [...list];
}

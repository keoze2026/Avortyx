/**
 * How every call-log export file is written (Reports > Call log, and the Call
 * Logs page), whether the rows come from the server or from the screen:
 *
 *   - the header row is in CAPITALS (and bold in Excel - toXLSX's `boldHeader`;
 *     a CSV file cannot carry bold);
 *   - the column names are CALLER ID (not "Caller") and CALLED NUMBER (not
 *     "Dialed"), and BUYER is followed by DESTINATION NAME and DESTINATION
 *     NUMBER;
 *   - Status starts with a capital: Completed, Failed, In progress, No answer;
 *   - Duration is hh:mm:ss (00:01:29), like the other call-tracking portals;
 *   - phone numbers are written the same way everywhere: 11 digits, no "+";
 *   - in Excel the RECORDING column is a real, clickable link.
 */

import type { ExportColumn } from "@/lib/export";
import { formatCallerId, formatHMS, toE164 } from "@/lib/format";
import type { Call } from "@/lib/types";

export const DURATION_HEADER = "DURATION";
export const DESTINATION_NAME_HEADER = "DESTINATION NAME";
export const DESTINATION_NUMBER_HEADER = "DESTINATION NUMBER";

/** Numeric columns of the server's call-log file, as headed after formatting. */
export const CALL_LOG_NUMERIC_HEADERS = ["REVENUE", "PAYOUT", "PROFIT"];
/** Columns whose web addresses become clickable links in Excel. */
export const CALL_LOG_LINK_HEADERS = ["RECORDING", "RECORDING URL", "RECORD"];

/** "completed" -> "Completed", "no_answer" -> "No answer", "in-progress" -> "In progress". */
export function statusLabel(raw: string | null | undefined): string {
  const words = (raw ?? "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/** Seconds -> "hh:mm:ss" (89 -> "00:01:29"). */
export function formatDuration(seconds: number): string {
  return formatHMS(Number.isFinite(seconds) ? seconds : 0);
}

/** A phone number the way the export writes them: 11 digits, no "+" ("" stays ""). */
export function exportNumber(value: string | null | undefined): string {
  return value && value.trim() ? formatCallerId(value) : "";
}

/** Destination number -> its name. Live destinations win over switched-off ones; a
 *  "name" that is just the number again is not a name. */
export function destinationNameMap(
  destinations: ReadonlyArray<{ tfn: string; name?: string | null; enabled?: boolean }>,
): Map<string, string> {
  const names = new Map<string, string>();
  for (const d of [...destinations].sort((a, b) => Number(!!a.enabled) - Number(!!b.enabled))) {
    const name = d.name?.trim();
    if (name && name !== d.tfn) names.set(toE164(d.tfn), name);
  }
  return names;
}

export interface DestinationInfo {
  name: string;
  number: string;
}

/** The destination a call was sent to: its name (when one is set) and number. */
export function destinationOf(call: Pick<Call, "destinationNumber"> | undefined, names: ReadonlyMap<string, string>): DestinationInfo {
  const raw = call?.destinationNumber?.trim() ?? "";
  if (!raw) return { name: "", number: "" };
  return { name: names.get(toE164(raw)) ?? "", number: exportNumber(raw) };
}

const norm = (h: string) => h.trim().toLowerCase();
/** "Duration (s)", "Duration (sec)", "Duration seconds", "duration_seconds" ... */
const isDurationSeconds = (h: string) => /^duration[\s_]*(\(\s*(s|sec|secs|seconds)\s*\)|seconds|secs|sec)$/.test(norm(h));
/** "TTC", "TTC (s)", "Time to connect (s)" - time to connect, in seconds from the server. */
const isTtcSeconds = (h: string) => /^(ttc|time[\s_]*to[\s_]*connect)[\s_]*(\(\s*(s|sec|secs|seconds)\s*\)|seconds|secs|sec)?$/.test(norm(h));
/** What the server may call these columns -> the names the client wants. */
const RENAME: Record<string, string> = {
  CALLER: "CALLER ID",
  "CALLER NUMBER": "CALLER ID",
  DIALED: "CALLED NUMBER",
  "DIALED NUMBER": "CALLED NUMBER",
  "TRACKING NUMBER": "CALLED NUMBER",
  "DESTINATION #": DESTINATION_NUMBER_HEADER,
  "DESTINATION": DESTINATION_NAME_HEADER,
};

/**
 * Apply the rules to a table that came from the server's CSV (first row = header).
 * Columns are found by their header, so the server's column order does not matter.
 * `destinationFor(callId)` fills DESTINATION NAME / NUMBER, which the server's
 * file does not carry.
 */
export function formatCallLogTable(
  table: string[][],
  opts: { destinationFor?: (callId: string) => DestinationInfo | undefined } = {},
): string[][] {
  if (table.length === 0) return table;
  const raw = table[0];
  const header = raw.map((h) => {
    if (isDurationSeconds(h)) return DURATION_HEADER;
    if (isTtcSeconds(h)) return "TTC";
    const up = h.trim().toUpperCase();
    return RENAME[up] ?? up;
  });
  const col = (name: string) => header.indexOf(name);
  const statusCol = col("STATUS");
  const durationCol = raw.findIndex(isDurationSeconds);
  const ttcCol = raw.findIndex(isTtcSeconds);
  const calledCol = col("CALLED NUMBER");
  const destNumberCol = col(DESTINATION_NUMBER_HEADER);
  const callIdCol = ["CALL ID", "UUID", "ID"].map(col).find((i) => i >= 0) ?? -1;
  const buyerCol = col("BUYER");
  const addDestination = buyerCol >= 0 && col(DESTINATION_NAME_HEADER) < 0 && col(DESTINATION_NUMBER_HEADER) < 0;

  const insertAfterBuyer = (row: string[], extra: string[]) =>
    addDestination ? [...row.slice(0, buyerCol + 1), ...extra, ...row.slice(buyerCol + 1)] : row;

  return table.map((row, i) => {
    if (i === 0) return insertAfterBuyer(header, [DESTINATION_NAME_HEADER, DESTINATION_NUMBER_HEADER]);
    const cells = row.map((cell, j) => {
      if (j === statusCol) return statusLabel(cell);
      if (j === durationCol || j === ttcCol) {
        // Seconds -> 00:00:16. Anything already formatted is left as it is.
        const sec = Number(cell);
        return cell.trim() === "" || !Number.isFinite(sec) ? cell : formatDuration(sec);
      }
      if (j === calledCol || j === destNumberCol) return exportNumber(cell);
      return cell;
    });
    const dest = callIdCol >= 0 ? opts.destinationFor?.(row[callIdCol] ?? "") : undefined;
    return insertAfterBuyer(cells, [dest?.name ?? "", dest?.number ?? ""]);
  });
}

/** The same rule for columns built in the browser: labels in capitals. */
export function upperLabels<T>(columns: ExportColumn<T>[]): ExportColumn<T>[] {
  return columns.map((c) => ({ ...c, label: c.label.toUpperCase() }));
}

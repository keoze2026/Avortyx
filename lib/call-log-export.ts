/**
 * How every call-log export file is written (Reports > Call log, and the Call
 * Logs page), whether the rows come from the server or from the screen:
 *
 *   - the header row is in CAPITALS (and bold in Excel - see toXLSX's
 *     `boldHeader`; a CSV file cannot carry bold);
 *   - Status starts with a capital letter: Completed, Failed, In progress,
 *     No answer;
 *   - Duration is in minutes (2 decimals), headed "DURATION (MIN)", instead
 *     of seconds.
 */

import type { ExportColumn } from "@/lib/export";

export const DURATION_MIN_HEADER = "DURATION (MIN)";

/** Numeric columns of the server's call-log file, as headed after formatting. */
export const CALL_LOG_NUMERIC_HEADERS = [DURATION_MIN_HEADER, "REVENUE", "PAYOUT", "PROFIT"];

/** "completed" -> "Completed", "no_answer" -> "No answer", "in-progress" -> "In progress". */
export function statusLabel(raw: string | null | undefined): string {
  const words = (raw ?? "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/** Seconds -> minutes, rounded to 2 decimals (624 -> 10.4). */
export function secondsToMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round((seconds / 60) * 100) / 100;
}

const norm = (h: string) => h.trim().toLowerCase();
/** "Duration (s)", "Duration (sec)", "Duration seconds", "duration_seconds" ... */
const isDurationSeconds = (h: string) => /^duration[\s_]*(\(\s*(s|sec|secs|seconds)\s*\)|seconds|secs|sec)$/.test(norm(h));
const isStatus = (h: string) => norm(h) === "status";

/**
 * Apply the rules to a table that came from the server's CSV (first row = header).
 * Status and duration are found by their header, so the column order does not matter.
 */
export function formatCallLogTable(table: string[][]): string[][] {
  if (table.length === 0) return table;
  const header = table[0];
  const statusCol = header.findIndex(isStatus);
  const durationCol = header.findIndex(isDurationSeconds);
  return table.map((row, i) => {
    if (i === 0) {
      return row.map((h, j) => (j === durationCol ? DURATION_MIN_HEADER : h.trim().toUpperCase()));
    }
    return row.map((cell, j) => {
      if (j === statusCol) return statusLabel(cell);
      if (j === durationCol) {
        const sec = Number(cell);
        return cell.trim() === "" || !Number.isFinite(sec) ? cell : secondsToMinutes(sec).toFixed(2);
      }
      return cell;
    });
  });
}

/** The same rule for columns built in the browser: labels in capitals. */
export function upperLabels<T>(columns: ExportColumn<T>[]): ExportColumn<T>[] {
  return columns.map((c) => ({ ...c, label: c.label.toUpperCase() }));
}

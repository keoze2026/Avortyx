/**
 * Fail reasons ("why a call didn't go through"), as shown in Reports.
 *
 * The backend records its own wording (`block_reason`): "Duplicate call",
 * "Campaign cap reached", "Destination Missed", ... English keeps the words
 * the portal has always shown; other languages show a translation for every
 * reason the backend is known to write. A reason we don't know yet is shown
 * as the backend wrote it.
 *
 * Shared by the Call Log and the call's activity panel, so both say the same.
 */

/**
 * The words the portal uses for a fail reason (screen and export):
 *   "Duplicate call" / "Duplicate call blocked"  ->  "Duplicate Call"
 *   "Campaign cap reached" (any cap)              ->  "Overflow Missed"
 *   "Callerid Blocked" (a caller the team blocked) ->  "Callerid Blocked"
 *   Any "Destination Missed" / "No Destination"      ->  "No Destination"
 *     (Sir: never "Destination Missed"; older rows still carry that wording)
 * Anything else: each word starts with a capital, "blocked" dropped.
 */
/** "Callerid Blocked" / "Caller ID Blocked", as the backend writes it for a blocked caller. */
const CALLER_ID_BLOCKED = /^caller\s*-?\s*id\s*blocked$/i;
const DESTINATION_MISSED = /destination\s*missed/i;
const NO_DESTINATION = /^no[\s_]*destination$/i;

export function failReasonLabel(reason: string | null | undefined): string {
  const raw = (reason ?? "").trim();
  if (!raw || raw === "—") return "";
  if (/duplicate/i.test(raw)) return "Duplicate Call";
  // A call from a number on Blocked Numbers (backend CH-136). Kept whole -
  // the "blocked" trim below would leave just "Callerid".
  if (CALLER_ID_BLOCKED.test(raw)) return "Callerid Blocked";
  if (/cap\s*reached|overflow/i.test(raw)) return "Overflow Missed";
  // The destination side could not take the call. Old rows say "Destination
  // Missed" (with or without a reason in brackets); new ones say it already.
  if (DESTINATION_MISSED.test(raw) || NO_DESTINATION.test(raw)) return "No Destination";
  const words = raw.replace(/\s*blocked\s*$/i, "").trim() || raw;
  return words.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/**
 * The translation key for a fail reason the backend is known to send, so the
 * Call Log shows it in the chosen language. null = a reason we don't know
 * (shown as the backend wrote it). English keeps the exact words above.
 */
export function failReasonKey(reason: string | null | undefined): { key: string; score?: string } | null {
  const raw = (reason ?? "").trim();
  if (!raw || raw === "—") return null;
  const k = "toolsUI.reports.callLog.failReason.";
  // Most specific first: every "Destination missed (...)" before the plain one.
  if (/duplicate/i.test(raw)) return { key: `${k}duplicate` };
  if (CALLER_ID_BLOCKED.test(raw)) return { key: `${k}callerIdBlocked` };
  // Every "Destination missed (...)" reads No Destination now.
  if (DESTINATION_MISSED.test(raw) || NO_DESTINATION.test(raw)) return { key: `${k}noDestination` };
  if (/cc\s*full/i.test(raw)) return { key: `${k}destinationFull` };
  if (/destination\s*busy/i.test(raw)) return { key: `${k}destBusy` };
  if (/destination\s*no\s*answer/i.test(raw)) return { key: `${k}destNoAnswer` };
  if (/caller\s*hung\s*up/i.test(raw)) return { key: `${k}callerHungUp` };
  if (/daily\s*limit/i.test(raw)) return { key: `${k}campDailyLimit` };
  if (/monthly\s*limit/i.test(raw)) return { key: `${k}campMonthlyLimit` };
  if (/total\s*limit/i.test(raw)) return { key: `${k}campTotalLimit` };
  if (/cap\s*reached|overflow/i.test(raw)) return { key: `${k}overflowMissed` };
  if (/no\s*matching\s*rule/i.test(raw)) return { key: `${k}noMatchingRule` };
  if (/insufficient[\s_]*balance/i.test(raw)) return { key: `${k}insufficientBalance` };
  if (/rtb\s*no\s*winner|no\s*bids/i.test(raw)) return { key: `${k}noBidWinner` };
  if (/campaign\s*not\s*found/i.test(raw)) return { key: `${k}campaignNotFound` };
  if (/no\s*number\s*configured/i.test(raw)) return { key: `${k}noNumber` };
  if (/^no[\s_]*(destination|decision)$/i.test(raw)) return { key: `${k}noDestination` };
  if (/manual[\s_]*hang[\s_-]*up/i.test(raw)) return { key: `${k}manualHangup` };
  if (/asterisk[\s_]*gone/i.test(raw)) return { key: `${k}callDropped` };
  if (/blacklist/i.test(raw)) return { key: `${k}blacklisted` };
  if (/do[\s-]*not[\s-]*call/i.test(raw)) return { key: `${k}doNotCall` };
  if (/tcpa|litigator/i.test(raw)) return { key: `${k}litigator` };
  if (/flagged\s*as\s*spam|\bspam\b/i.test(raw)) return { key: `${k}spam` };
  if (/flagged\s*as\s*fraud/i.test(raw)) return { key: `${k}fraud` };
  if (/blocked\s*the\s*caller/i.test(raw)) return { key: `${k}buyerBlocked` };
  if (/anonymous/i.test(raw)) return { key: `${k}anonymous` };
  const fraud = raw.match(/fraud[\s_]*score[\s_]*(\d+)/i);
  if (fraud) return { key: `${k}fraudScore`, score: fraud[1] };
  return null;
}

/** A fail reason in the chosen language: English exactly as before, other
 *  languages translated when the reason is a known one. */
export function localizeFailReason(
  reason: string | null | undefined,
  locale: string,
  t: (key: string) => string,
): string {
  const english = failReasonLabel(reason);
  if (!english || locale === "en") return english;
  const known = failReasonKey(reason);
  if (!known) return english;
  return t(known.key).replace("{score}", known.score ?? "");
}

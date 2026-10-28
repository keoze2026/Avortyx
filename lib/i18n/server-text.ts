/**
 * CH-302: texts the server sends in English, shown in the chosen language.
 *
 * TFN Check details and test-call steps, a buyer report's last result, and
 * report column / comment names come from the backend as English sentences.
 * These rebuild them from translation keys (lib/i18n/extra/translate-all.ts).
 * Anything not recognised is shown as sent, so nothing is ever blanked out.
 */
import { formatRelativeTime } from "@/lib/format";
import type { TfnCheckResult, TfnTestStep } from "@/lib/api/services/tfn-check.service";

type T = (key: string) => string;

/** `t(key)`, or `fallback` when the key has no text anywhere. */
function tOr(t: T, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

function fill(text: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), text);
}

/** How long ago, in the chosen language ("5 分前", "5 мин. назад"). */
function ago(iso: string | null | undefined): string {
  return iso ? formatRelativeTime(new Date(iso).getTime()) : "";
}

/** "active", "paused", ... as a word in the chosen language. */
function stateWord(t: T, state: string): string {
  return tOr(t, `tfnCheck.state.${state}`, state);
}

/** The Details column of a TFN Check row (backend phone_numbers/tfn_check.py _judge). */
export function tfnDetail(t: T, locale: string, r: TfnCheckResult): string {
  if (locale === "en") return r.detail;
  switch (r.status) {
    case "not_found":
    case "expired":
    case "paused":
    case "not_in_service":
    case "not_ready":
      return t(`tfnCheck.detail.${r.status}`);
    case "not_working":
      // CH-360: its carrier stopped delivering (carrier watch).
      if (r.detail.startsWith("Calls to this number are not reaching us")) return t("x360.detail.carrierDown");
      return r.lastTestAt ? fill(t("tfnCheck.detail.not_working"), { ago: ago(r.lastTestAt) }) : r.detail;
    case "working":
      if (r.carrierCheckedAt && r.detail.startsWith("The carrier delivered"))
        return fill(t("x360.detail.carrierOk"), { ago: ago(r.carrierCheckedAt) });
      if (r.lastCallAt) return fill(t("tfnCheck.detail.lastCall"), { ago: ago(r.lastCallAt) });
      if (r.lastTestAt) return fill(t("tfnCheck.detail.testReached"), { ago: ago(r.lastTestAt) });
      return r.detail;
    case "active": {
      // CH-360: "Working" needs proof from the last hour.
      if (r.detail.includes("not proven in the last hour") && r.lastCallAt)
        return fill(t("x360.detail.activeOld"), { ago: ago(r.lastCallAt) });
      if (r.detail === "Active, no calls in the last hour.") return t("x360.detail.activeHour");
      const hours = /last (\d+) hours/.exec(r.detail)?.[1] ?? "24";
      return fill(t("tfnCheck.detail.active"), { hours });
    }
    default:
      return r.detail;
  }
}

/** CH-358: why a number is not taking calls (team only), in the chosen language. */
const WHY_EXACT: Record<string, string> = {
  "The account balance is too low for one call.": "x358.why.balance",
  "No buyer line is open right now (all off, outside their hours, or at their cap).": "x358.why.noBuyer",
};

export function tfnWhy(t: T, why: string): string {
  const key = WHY_EXACT[why];
  if (key) return t(key);
  if (why.startsWith("The campaign is at its limit right now")) return tOr(t, "x358.why.cap", why);
  return why;
}

const STEP_EXACT: Record<string, string> = {
  "Number is not on the platform": "tfnCheck.step.notOnPlatform",
  "Number is live": "tfnCheck.step.numberLive",
  "Number is not attached to a campaign": "tfnCheck.step.noCampaign",
  "On an active campaign": "tfnCheck.step.campaignActive",
  "Campaign is live (bidding is not simulated)": "tfnCheck.step.rtb",
  "Routing check failed with an internal error": "tfnCheck.step.routingError",
  "Routing OK: a buyer line is ready to take the call": "tfnCheck.step.routingOk",
  "Reached our phone system": "tfnCheck.step.reached",
  "Test call placed": "tfnCheck.step.placed",
  // CH-348: end to end - carrier, routing, buyer answer.
  "Came in through the carrier and reached our phone system": "x348.step.viaCarrier",
  "Ringing the buyer's line": "x348.step.ringing",
  "A buyer's agent answered": "x348.step.answered",
  "No result from the buyer's line in time": "x348.step.noResult",
};

const DIAL_WHY: Record<string, string> = {
  "no answer": "x348.why.noAnswer",
  busy: "x348.why.busy",
  "line congested": "x348.why.congested",
  "line unavailable": "x348.why.unavailable",
  "ended before an answer": "x348.why.ended",
};

/** One step of a TFN test call (backend phone_numbers/tfn_test.py). */
export function tfnStepText(t: T, locale: string, step: TfnTestStep): string {
  const text = step.text ?? "";
  if (locale === "en") return text;
  const exact = STEP_EXACT[text];
  if (exact) return t(exact);
  let m = /^Number is (\w+), not active$/.exec(text);
  if (m) return fill(t("tfnCheck.step.numberState"), { state: stateWord(t, m[1]) });
  m = /^Its campaign is (\w+), not active$/.exec(text);
  if (m) return fill(t("tfnCheck.step.campaignState"), { state: stateWord(t, m[1]) });
  m = /^Routing would not forward the call: (.*)$/.exec(text);
  if (m) {
    const why = m[1] === "no destination" ? t("tfnCheck.step.noDestination") : m[1];
    return fill(t("tfnCheck.step.routingRefused"), { why });
  }
  m = /^Test call could not be started \((.*)\)$/.exec(text);
  if (m) return fill(t("tfnCheck.step.notStarted"), { note: m[1] });
  m = /^The test call did not reach our call routing within (\d+)s$/.exec(text);
  if (m) return fill(t("tfnCheck.step.notReached"), { seconds: m[1] });
  m = /^The buyer's line did not answer \((.*)\)$/.exec(text);
  if (m) return fill(t("x348.step.notAnswered"), { why: DIAL_WHY[m[1]] ? t(DIAL_WHY[m[1]]) : m[1] });
  m = /^Carrier route not checked: (.*)$/.exec(text);
  if (m) return fill(t("x348.step.carrierNotChecked"), { why: m[1] });
  return text;
}

/** A buyer report's last result (backend buyers/telegram_report.py, buyers/api.py). */
export function reportResultText(t: T, locale: string, result: string): string {
  if (!result || locale === "en") return result;
  let m = /^Sent (\d+) file\(s\) for (.+?)( \(sent by hand\))?$/.exec(result);
  if (m) {
    const line = fill(t("buyerReport.result.sent"), { count: m[1], day: m[2] });
    return m[3] ? `${line} ${t("buyerReport.result.byHand")}` : line;
  }
  m = /^Not sent: (.*)$/.exec(result);
  if (m) return fill(t("buyerReport.result.notSent"), { error: m[1] });
  return result;
}

/** A report column's name ("Caller ID", "Fail Reason"...) in the chosen language.
 *  The files themselves keep the English names the buyer's systems expect. */
export function reportColumnLabel(t: T, label: string): string {
  const exact = tOr(t, `reportColumn.${label}`, "");
  if (exact) return exact;
  // The call log export writes its headings in capitals ("CALLER ID").
  const name = COLUMN_NAMES.find((n) => n.toUpperCase() === label.trim().toUpperCase());
  if (!name) return label;
  const text = t(`reportColumn.${name}`);
  return text === name ? label : text;
}

const COLUMN_NAMES = [
  "Date", "Date (EST)", "Call ID", "Caller", "Caller ID", "State", "Carrier", "Called Number",
  "Campaign", "Buyer", "Destination Name", "Destination Number", "Destination", "Publisher",
  "Status", "Fail Reason", "Duration", "Duration (s)", "TTC", "TTC (s)", "Qualified", "Converted",
  "Repeated", "Revenue", "Payout", "Profit", "Billed Minutes", "Cost", "Recording", "Tags",
  "Time", "Caller State",
];

/** A Fail Reason comment ("Not Connected"...) in the chosen language. */
export function reportCommentLabel(t: T, comment: string): string {
  return tOr(t, `reportComment.${comment}`, comment);
}

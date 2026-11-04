/**
 * CH-546: the AI audit labels (backend routing/ai_labels.py, CH-543), as the
 * Reports page, the Call Log and the AI Audit page show them. Our team only.
 *
 *   valid         Valid Call - the caller speaks
 *   dead_caller   No Voice | Dead Caller - both sides silent
 *   agent_only    No Voice | No Beep or Customer - agent speaks, caller silent
 *   agent_beep    No Voice | Only Agent + Beeping - agent speaks, caller side only tones
 *   mixed         Voice (one channel) - recorded before the sides were split
 *   ""            Pending AI check (an answered call not checked yet)
 */
import type { Call } from "@/lib/types";

export const NO_VOICE_LABELS: ReadonlySet<string> = new Set(["dead_caller", "agent_only", "agent_beep"]);

/** The AI Label filter's choices (Sir: All / Valid / each No Voice / Pending). */
export const AI_LABEL_FILTERS = ["valid", "dead_caller", "agent_only", "agent_beep", "pending"] as const;
export type AiLabelFilter = (typeof AI_LABEL_FILTERS)[number];

/** Pending: answered and not checked yet. A call nobody answered is never checked. */
export function aiPending(c: Call): boolean {
  return c.status === "completed" && !c.aiLabel;
}

export function matchesAiLabel(c: Call, f: AiLabelFilter): boolean {
  return f === "pending" ? aiPending(c) : c.aiLabel === f;
}

/** The translation key of a label ("" = Pending AI check). */
export function aiLabelKey(label: string | undefined): string {
  return label ? `x543.label.${label}` : "x543.pending";
}

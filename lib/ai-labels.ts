/**
 * CH-546: the AI audit labels (backend routing/ai_labels.py, CH-543), as the
 * Reports page, the Call Log and the AI Audit page show them. Our team only.
 *
 *   valid         Valid Call - the caller speaks
 *   dead_caller   No Voice | Dead Caller - both sides silent
 *   agent_only    No Voice | No Beep or Customer - agent speaks, caller silent
 *   agent_beep    No Voice | Only Agent + Beeping - agent speaks, caller side only tones
 *   mixed         Voice Found - recorded before the sides were split (CH-548 name)
 *   ivr           Voicemail / IVR - no person, music or a machine (PANNs, CH-553)
 *   ""            Pending AI check (an answered call not checked yet)
 */
import { useAuthStore } from "@/lib/store/auth-store";
import type { Call } from "@/lib/types";

/** CH-548 (Sir): the AI audit - the AI Audit page, AI Label column and filter,
 *  No Voice columns - only for the billing and audit team logins and the
 *  owner (backend /me can_ai_audit). Other staff, buyers and publishers never. */
export function useCanAiAudit(): boolean {
  return useAuthStore((s) => s.user?.canAiAudit === true && s.user?.role !== "buyer" && s.user?.role !== "publisher");
}

export const NO_VOICE_LABELS: ReadonlySet<string> = new Set(["dead_caller", "agent_only", "agent_beep"]);

/** The AI Label filter's choices (Sir: All / Valid / each No Voice / Pending). */
export const AI_LABEL_FILTERS = ["valid", "dead_caller", "agent_only", "agent_beep", "ivr", "pending"] as const;
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

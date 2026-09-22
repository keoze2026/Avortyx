/**
 * Notification rules store — backed by /api/notifications/rules.
 *
 * The Settings → Notifications panel renders a (event × channel) preference
 * matrix. The backend models each toggle as a `NotificationRule` row with
 * one event, one channel, and a recipients[] list. We treat a toggle as the
 * presence of an active rule for that (event, channel) pair — created on
 * first flip, then PATCHed `is_active` for subsequent flips so the rule
 * (and its custom recipients, if anyone edits them later via a richer UI)
 * doesn't churn.
 *
 * Defaults the recipient to the signed-in user's email so a toggle flip is
 * one click rather than a multi-step recipient picker.
 */

"use client";

import { create } from "zustand";

import {
  notificationsService,
  type NotificationRule,
} from "@/lib/api/services/notifications.service";

/** Delivery channels the backend accepts on a rule. `in_app` was rejected
 *  as of 2026-09-22 — in-app banners come from the pop-up alert
 *  preferences instead (see lib/store/alert-preferences-store.ts). */
export type NotificationChannel = "email" | "sms";

interface NotificationsRulesState {
  rules: NotificationRule[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  /**
   * Flip a toggle on or off. Creates a rule if none exists for the pair;
   * otherwise patches `is_active`. `recipient` is the email the rule will
   * fire on when no rule exists yet — typically the signed-in user's email.
   */
  setEnabled: (
    event: string,
    channel: NotificationChannel,
    on: boolean,
    recipient: string,
  ) => Promise<void>;
  /** True when an active rule exists for the (event, channel) pair. */
  isEnabled: (event: string, channel: NotificationChannel) => boolean;
}

function findRule(
  rules: NotificationRule[],
  event: string,
  channel: NotificationChannel,
): NotificationRule | undefined {
  return rules.find((r) => r.event === event && r.channel === channel);
}

export const useNotificationsRulesStore = create<NotificationsRulesState>()(
  (set, get) => ({
    rules: [],
    loading: false,
    error: null,
    hydrated: false,

    fetch: async () => {
      set({ loading: true, error: null });
      try {
        const page = await notificationsService.listRules({ page: 1, pageSize: 200 });
        set({ rules: page.items, loading: false, hydrated: true });
      } catch (e) {
        set({ loading: false, error: messageFromError(e) });
      }
    },

    isEnabled: (event, channel) => {
      const rule = findRule(get().rules, event, channel);
      return !!rule && rule.isActive;
    },

    setEnabled: async (event, channel, on, recipient) => {
      const existing = findRule(get().rules, event, channel);

      // Optimistically flip local state so the toggle responds instantly.
      const prev = get().rules;
      if (existing) {
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === existing.id ? { ...r, isActive: on } : r,
          ),
        }));
      } else if (on) {
        // Placeholder while the create request is in flight — replaced with
        // the real id from the response on success.
        const placeholder: NotificationRule = {
          id: `__pending_${event}_${channel}`,
          name: `${event} via ${channel}`,
          event,
          channel,
          recipients: [recipient],
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ rules: [...s.rules, placeholder] }));
      }

      try {
        if (existing) {
          const updated = await notificationsService.updateRule(existing.id, {
            isActive: on,
          });
          set((s) => ({
            rules: s.rules.map((r) => (r.id === existing.id ? updated : r)),
          }));
        } else if (on) {
          const created = await notificationsService.createRule({
            name: `${event} via ${channel}`,
            event,
            channel,
            recipients: [recipient],
            isActive: true,
          });
          set((s) => ({
            // Replace the placeholder with the real row.
            rules: s.rules
              .filter((r) => r.id !== `__pending_${event}_${channel}`)
              .concat(created),
          }));
        }
        // (on=false with no existing rule is a no-op — nothing to do.)
      } catch (e) {
        set({ rules: prev, error: messageFromError(e) });
        throw e;
      }
    },
  }),
);

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Notification rules request failed";
}

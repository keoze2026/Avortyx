/**
 * Notifications service — /api/notifications/*.
 * Drives the notification rules + delivery log under Settings → Notifications.
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";

export interface NotificationRule {
  id: string;
  name: string;
  event: string;
  channel: string;
  recipients: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/** One entry of GET /api/notifications/events — an alert type the user
 *  can choose to see as a pop-up banner. */
export interface AlertEvent {
  /** Stable name, e.g. "campaign.cap_reached". */
  event: string;
  label: string;
  defaultPopup: boolean;
}

/** GET / PATCH /api/notifications/preferences — per user, not per org. */
export interface AlertPreferences {
  popupsEnabled: boolean;
  /** Events that pop a banner. PATCH replaces the whole list. */
  popupEvents: string[];
  soundEnabled: boolean;
}

interface AlertEventWire {
  event: string;
  label?: string;
  defaultPopup?: boolean;
}

interface AlertPreferencesWire {
  popupsEnabled?: boolean;
  popupEvents?: string[] | null;
  soundEnabled?: boolean;
}

function wireToPreferences(w: AlertPreferencesWire): AlertPreferences {
  return {
    popupsEnabled: w.popupsEnabled ?? true,
    popupEvents: Array.isArray(w.popupEvents) ? w.popupEvents : [],
    soundEnabled: w.soundEnabled ?? false,
  };
}

export interface NotificationLog {
  id: string;
  event: string;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  error: string;
  createdAt: number;
}

interface RuleWire {
  id: string;
  name: string;
  event: string;
  channel: string;
  recipients: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LogWire {
  id: string;
  event: string;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  error: string;
  createdAt: string;
}

function toTs(s: string | undefined): number {
  if (!s) return Date.now();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

function wireToRule(w: RuleWire): NotificationRule {
  return {
    id: w.id,
    name: w.name,
    event: w.event,
    channel: w.channel,
    recipients: Array.isArray(w.recipients) ? w.recipients.map(String) : [],
    isActive: !!w.isActive,
    createdAt: toTs(w.createdAt),
    updatedAt: toTs(w.updatedAt),
  };
}

function wireToLog(w: LogWire): NotificationLog {
  return {
    id: w.id,
    event: w.event,
    channel: w.channel,
    recipient: w.recipient,
    subject: w.subject,
    status: w.status,
    error: w.error,
    createdAt: toTs(w.createdAt),
  };
}

export const notificationsService = {
  /** The catalogue of alert types — rendered as the "Pop-up alerts" list. */
  async events(): Promise<AlertEvent[]> {
    const wire = await http.get<AlertEventWire[] | { items?: AlertEventWire[] | null }>("/api/notifications/events");
    const rows = Array.isArray(wire) ? wire : (wire?.items ?? []);
    return rows
      .filter((r) => typeof r.event === "string" && r.event)
      .map((r) => ({ event: r.event, label: r.label || r.event, defaultPopup: r.defaultPopup ?? false }));
  },

  async preferences(): Promise<AlertPreferences> {
    return wireToPreferences(await http.get<AlertPreferencesWire>("/api/notifications/preferences"));
  },

  /** Any subset of the three fields; `popupEvents` replaces the whole list. */
  async updatePreferences(patch: Partial<AlertPreferences>): Promise<AlertPreferences> {
    return wireToPreferences(
      await http.patch<AlertPreferencesWire>("/api/notifications/preferences", { body: patch }),
    );
  },

  async listRules(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<NotificationRule>> {
    const res = await http.get<Paginated<RuleWire>>("/api/notifications/rules", { query });
    return { ...res, items: res.items.map(wireToRule) };
  },

  async getRule(id: string): Promise<NotificationRule> {
    return wireToRule(await http.get<RuleWire>(`/api/notifications/rules/${id}`));
  },

  async createRule(input: {
    name: string;
    event: string;
    channel: string;
    recipients: string[];
    isActive?: boolean;
  }): Promise<NotificationRule> {
    return wireToRule(await http.post<RuleWire>("/api/notifications/rules", { body: input }));
  },

  async updateRule(id: string, patch: Partial<NotificationRule>): Promise<NotificationRule> {
    return wireToRule(
      await http.patch<RuleWire>(`/api/notifications/rules/${id}`, { body: patch }),
    );
  },

  async deleteRule(id: string): Promise<void> {
    await http.delete(`/api/notifications/rules/${id}`);
  },

  async test(input: { event: string; channel: string; recipient: string }): Promise<unknown> {
    return http.post("/api/notifications/test", { body: input });
  },

  async listLogs(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<NotificationLog>> {
    const res = await http.get<Paginated<LogWire>>("/api/notifications/logs", { query });
    return { ...res, items: res.items.map(wireToLog) };
  },
};

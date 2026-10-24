/**
 * Scheduled Reports service — /api/analytics/reports/*.
 *
 *   GET    /api/analytics/reports/                 — list
 *   POST   /api/analytics/reports/                 — create
 *   GET    /api/analytics/reports/{id}/            — read one
 *   PATCH  /api/analytics/reports/{id}/            — update
 *   DELETE /api/analytics/reports/{id}/            — remove
 *   POST   /api/analytics/reports/{id}/activate/   — resume
 *   POST   /api/analytics/reports/{id}/pause/      — pause
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";

export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportFormat = "csv" | "xlsx" | "pdf" | "json";
export type ReportStatus = "active" | "paused";

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: ReportFrequency;
  format: ReportFormat;
  recipients: string[];
  filters: Record<string, unknown>;
  status: ReportStatus;
  lastRunAt?: number;
  nextRunAt?: number;
  createdAt?: number;
}

interface ScheduledReportWire {
  id: string;
  name: string;
  frequency: string;
  format?: string;
  recipients?: string[];
  filters?: Record<string, unknown>;
  status?: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt?: string;
}

function normalizeFreq(raw: string | null | undefined): ReportFrequency {
  const s = (raw ?? "").toLowerCase();
  if (s === "daily" || s === "weekly" || s === "monthly") return s;
  return "weekly";
}

function normalizeFormat(raw?: string): ReportFormat {
  const s = (raw ?? "").toLowerCase();
  if (s === "xlsx" || s === "pdf" || s === "json") return s;
  return "csv";
}

function normalizeStatus(raw?: string): ReportStatus {
  return raw?.toLowerCase() === "paused" ? "paused" : "active";
}

function toTs(s: string | null | undefined): number | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : undefined;
}

function wireToReport(w: ScheduledReportWire): ScheduledReport {
  return {
    id: w.id,
    name: w.name,
    frequency: normalizeFreq(w.frequency),
    format: normalizeFormat(w.format),
    recipients: Array.isArray(w.recipients) ? w.recipients.map(String) : [],
    filters: w.filters ?? {},
    status: normalizeStatus(w.status),
    lastRunAt: toTs(w.lastRunAt),
    nextRunAt: toTs(w.nextRunAt),
    createdAt: toTs(w.createdAt),
  };
}

export const scheduledReportsService = {
  async list(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<ScheduledReport>> {
    const res = await http.get<Paginated<ScheduledReportWire>>("/api/analytics/reports/", { query });
    return { ...res, items: res.items.map(wireToReport) };
  },

  async get(id: string): Promise<ScheduledReport> {
    return wireToReport(await http.get<ScheduledReportWire>(`/api/analytics/reports/${id}/`));
  },

  async create(input: {
    name: string;
    frequency: ReportFrequency;
    format?: ReportFormat;
    recipients?: string[];
    filters?: Record<string, unknown>;
  }): Promise<ScheduledReport> {
    return wireToReport(
      await http.post<ScheduledReportWire>("/api/analytics/reports/", {
        body: {
          name: input.name,
          frequency: input.frequency,
          format: input.format ?? "csv",
          recipients: input.recipients ?? [],
          filters: input.filters ?? {},
        },
      }),
    );
  },

  async update(id: string, patch: Partial<ScheduledReport>): Promise<ScheduledReport> {
    return wireToReport(
      await http.patch<ScheduledReportWire>(`/api/analytics/reports/${id}/`, { body: patch }),
    );
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/api/analytics/reports/${id}/`);
  },

  async pause(id: string): Promise<void> {
    await http.post(`/api/analytics/reports/${id}/pause/`);
  },

  async activate(id: string): Promise<void> {
    await http.post(`/api/analytics/reports/${id}/activate/`);
  },

  /** Trigger an immediate run of the scheduled report against the saved
   *  recipients. Rate-limited server-side to once per minute per report;
   *  the dev confirms a 429 if the user spams the button. */
  async runNow(id: string): Promise<{ ok: boolean; detail?: string; sentAt?: string }> {
    return http.post<{ ok: boolean; detail?: string; sentAt?: string }>(
      `/api/analytics/reports/${id}/run-now/`,
    );
  },

  /** The export columns this login may put in its digest (CH-266). */
  async columns(): Promise<{ key: string; label: string }[]> {
    const res = await http.get<{ columns?: { key: string; label: string }[] }>("/api/analytics/reports/columns/");
    return res.columns ?? [];
  },
};

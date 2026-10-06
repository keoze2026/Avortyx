/**
 * Auto-schedule store.
 *
 * Holds opt-in play / pause schedules for the three entity types that can be
 * automated (campaign, buyer, destination), plus the portal timezone used
 * to evaluate them. State is persisted to localStorage so a schedule set
 * yesterday still fires today.
 */

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";

import { campaignsService } from "@/lib/api/services/campaigns.service";

export type ScheduleTarget = "campaign" | "buyer" | "destination";

export interface AutoSchedule {
  /** Master switch. When false the schedule is ignored. */
  enabled: boolean;
  /** Hour-of-day in 24-hour internal form. UI converts to/from 12-hr + AM/PM. */
  playHour: number;
  pauseHour: number;
  /** Minute-of-hour (0/15/30/45). Optional for back-compat with old persisted state. */
  playMinute?: number;
  pauseMinute?: number;
}

export const DEFAULT_PORTAL_TZ = "America/New_York";

export function emptySchedule(): AutoSchedule {
  return { enabled: false, playHour: 8, pauseHour: 17, playMinute: 0, pauseMinute: 0 };
}

interface State {
  portalTimezone: string;
  campaignSchedules: Record<string, AutoSchedule>;
  buyerSchedules: Record<string, AutoSchedule>;
  destinationSchedules: Record<string, AutoSchedule>;

  setPortalTimezone: (tz: string) => void;
  setSchedule: (target: ScheduleTarget, id: string, schedule: AutoSchedule) => void;
  getSchedule: (target: ScheduleTarget, id: string) => AutoSchedule;
}

export const useAutoScheduleStore = create<State>()(
  persist(
    (set, get) => ({
      portalTimezone: DEFAULT_PORTAL_TZ,
      campaignSchedules: {},
      buyerSchedules: {},
      destinationSchedules: {},

      setPortalTimezone: (tz) => set({ portalTimezone: tz }),

      setSchedule: (target, id, schedule) => {
        const key =
          target === "campaign"
            ? "campaignSchedules"
            : target === "buyer"
              ? "buyerSchedules"
              : "destinationSchedules";
        set((s) => ({ [key]: { ...s[key], [id]: schedule } }) as Partial<State>);

        // Campaigns persist. The times used to live only here, so a campaign
        // set to pause at 5pm took calls all night and the schedule existed
        // only in the browser that set it. The backend now stores them and a
        // Celery task plays and pauses the campaign on the minute.
        //
        // Buyers and destinations have no columns yet, so they stay local —
        // and that is said out loud rather than left to look saved.
        if (target !== "campaign") {
          toast.warning("Saved on this device only", {
            description:
              "Schedules for buyers and destinations aren't stored on the server yet, so they won't run.",
          });
          return;
        }
        void campaignsService
          .update(id, {
            autoScheduleEnabled: schedule.enabled,
            playHour: schedule.playHour,
            playMinute: schedule.playMinute ?? 0,
            pauseHour: schedule.pauseHour,
            pauseMinute: schedule.pauseMinute ?? 0,
            autoScheduleTimezone: get().portalTimezone,
          } as Record<string, unknown>)
          .catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : "Could not save the schedule", {
              description: "The change was not saved. Reload to see the current values.",
            });
          });
      },

      getSchedule: (target, id) => {
        const s = get();
        const map =
          target === "campaign"
            ? s.campaignSchedules
            : target === "buyer"
              ? s.buyerSchedules
              : s.destinationSchedules;
        return map[id] ?? emptySchedule();
      },
    }),
    {
      name: "vortyx.auto-schedule",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/* ─── 12-hour <-> 24-hour helpers ─────────────────────────────────────── */

export function to12h(hour24: number): { hour: number; period: "AM" | "PM" } {
  if (hour24 === 0) return { hour: 12, period: "AM" };
  if (hour24 === 12) return { hour: 12, period: "PM" };
  if (hour24 < 12) return { hour: hour24, period: "AM" };
  return { hour: hour24 - 12, period: "PM" };
}

export function to24h(hour12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function formatTime12(hour24: number, minute: number = 0): string {
  const { hour, period } = to12h(hour24);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

/* ─── Available portal timezones (matches the existing TIMEZONES list scope) ── */

export const PORTAL_TIMEZONES = [
  { iana: "America/New_York", label: "(UTC-05:00) Eastern Time (EST)" },
  { iana: "America/Chicago", label: "(UTC-06:00) Central Time (CST)" },
  { iana: "America/Denver", label: "(UTC-07:00) Mountain Time (MST)" },
  { iana: "America/Los_Angeles", label: "(UTC-08:00) Pacific Time (PST)" },
  { iana: "America/Anchorage", label: "(UTC-09:00) Alaska Time" },
  { iana: "Pacific/Honolulu", label: "(UTC-10:00) Hawaii Time" },
  { iana: "Europe/London", label: "(UTC+00:00) London" },
  { iana: "Europe/Berlin", label: "(UTC+01:00) Berlin / Paris" },
  { iana: "Asia/Tokyo", label: "(UTC+09:00) Tokyo" },
  { iana: "Australia/Sydney", label: "(UTC+11:00) Sydney" },
];

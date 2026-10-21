/**
 * Per-publisher access store.
 *
 * Holds publisher-scoped collaboration state: timezone, members who can view
 * the publisher's stats, permission flags those members get, and the advanced
 * cap toggle. State persists to localStorage so settings made yesterday are
 * still in place tomorrow.
 */

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface PublisherMember {
  id: string;
  email: string;
  status: "active" | "invited";
  invitedAt: number;
}

export type PermissionKey =
  | "manageTraffic"
  | "numberCreation"
  | "audioRecording"
  | "blockNumbers"
  | "downloadReports";

export type PublisherPermissions = Record<PermissionKey, boolean>;

export type ReportingColumnKey =
  | "incoming"
  | "connected"
  | "qualified"
  | "converted"
  | "notConnected"
  | "acl"
  | "tcl"
  | "cost";

export type ReportingVisibility = Record<ReportingColumnKey, boolean>;

export interface PublisherCapSettings {
  enabled: boolean;
}

export interface PublisherAccessState {
  timezone: string;
  members: PublisherMember[];
  permissions: PublisherPermissions;
  reporting: ReportingVisibility;
  cap: PublisherCapSettings;
}

const DEFAULT_TZ = "UTC";

const DEFAULT_PERMISSIONS: PublisherPermissions = {
  manageTraffic: false,
  numberCreation: false,
  audioRecording: false,
  blockNumbers: false,
  downloadReports: false,
};

// Publishers see every reporting column by default — admin un-checks to hide.
const DEFAULT_REPORTING: ReportingVisibility = {
  incoming: true,
  connected: true,
  qualified: true,
  converted: true,
  notConnected: true,
  acl: true,
  tcl: true,
  cost: true,
};

export function emptyAccess(): PublisherAccessState {
  return {
    timezone: DEFAULT_TZ,
    members: [],
    permissions: { ...DEFAULT_PERMISSIONS },
    reporting: { ...DEFAULT_REPORTING },
    cap: { enabled: false },
  };
}

interface Store {
  byPublisher: Record<string, PublisherAccessState>;
  getAccess: (publisherId: string) => PublisherAccessState;
  setTimezone: (publisherId: string, timezone: string) => void;
  togglePermission: (publisherId: string, key: PermissionKey) => void;
  toggleReportingColumn: (publisherId: string, key: ReportingColumnKey) => void;
  setCapEnabled: (publisherId: string, enabled: boolean) => void;
  addMember: (publisherId: string, email: string) => void;
  removeMember: (publisherId: string, memberId: string) => void;
}

export const usePublisherAccessStore = create<Store>()(
  persist(
    (set, get) => ({
      byPublisher: {},

      getAccess: (publisherId) => {
        return get().byPublisher[publisherId] ?? emptyAccess();
      },

      setTimezone: (publisherId, timezone) =>
        set((s) => ({
          byPublisher: {
            ...s.byPublisher,
            [publisherId]: { ...(s.byPublisher[publisherId] ?? emptyAccess()), timezone },
          },
        })),

      togglePermission: (publisherId, key) =>
        set((s) => {
          const cur = s.byPublisher[publisherId] ?? emptyAccess();
          return {
            byPublisher: {
              ...s.byPublisher,
              [publisherId]: {
                ...cur,
                permissions: { ...cur.permissions, [key]: !cur.permissions[key] },
              },
            },
          };
        }),

      toggleReportingColumn: (publisherId, key) =>
        set((s) => {
          const cur = s.byPublisher[publisherId] ?? emptyAccess();
          const reporting = cur.reporting ?? { ...DEFAULT_REPORTING };
          return {
            byPublisher: {
              ...s.byPublisher,
              [publisherId]: {
                ...cur,
                reporting: { ...reporting, [key]: !reporting[key] },
              },
            },
          };
        }),

      setCapEnabled: (publisherId, enabled) =>
        set((s) => {
          const cur = s.byPublisher[publisherId] ?? emptyAccess();
          return {
            byPublisher: {
              ...s.byPublisher,
              [publisherId]: { ...cur, cap: { ...cur.cap, enabled } },
            },
          };
        }),

      addMember: (publisherId, email) =>
        set((s) => {
          const cur = s.byPublisher[publisherId] ?? emptyAccess();
          const trimmed = email.trim().toLowerCase();
          if (!trimmed) return s;
          if (cur.members.some((m) => m.email.toLowerCase() === trimmed)) return s;
          const member: PublisherMember = {
            id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            email: trimmed,
            status: "invited",
            invitedAt: Date.now(),
          };
          return {
            byPublisher: {
              ...s.byPublisher,
              [publisherId]: { ...cur, members: [...cur.members, member] },
            },
          };
        }),

      removeMember: (publisherId, memberId) =>
        set((s) => {
          const cur = s.byPublisher[publisherId];
          if (!cur) return s;
          return {
            byPublisher: {
              ...s.byPublisher,
              [publisherId]: {
                ...cur,
                members: cur.members.filter((m) => m.id !== memberId),
              },
            },
          };
        }),
    }),
    {
      name: "vortyx.publisher-access",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/* ─── Static lists shared by the UI ──────────────────────────────────── */

export const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: "UTC", label: "(UTC) Coordinated Universal Time" },
  { value: "America/New_York", label: "(UTC-05:00) Eastern Time (EST)" },
  { value: "America/Chicago", label: "(UTC-06:00) Central Time (CST)" },
  { value: "America/Denver", label: "(UTC-07:00) Mountain Time (MST)" },
  { value: "America/Los_Angeles", label: "(UTC-08:00) Pacific Time (PST)" },
  { value: "America/Anchorage", label: "(UTC-09:00) Alaska Time" },
  { value: "Pacific/Honolulu", label: "(UTC-10:00) Hawaii Time" },
  { value: "Europe/London", label: "(UTC+00:00) London" },
  { value: "Europe/Berlin", label: "(UTC+01:00) Berlin / Paris" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Tokyo" },
  { value: "Australia/Sydney", label: "(UTC+11:00) Sydney" },
];

export interface PermissionDef {
  key: PermissionKey;
  /** English fallback. */
  label: string;
  /** English fallback description. */
  description: string;
  /** Translation key for the label. */
  labelKey: string;
  /** Translation key for the description. */
  descriptionKey: string;
}

export interface ReportingColumnDef {
  key: ReportingColumnKey;
  /** English fallback (used when t() can't resolve the key). */
  label: string;
  /** English fallback description. */
  description: string;
  /** Dotted translation key under `sharedUI.reportingVisibility.columns.<key>.label`. */
  labelKey: string;
  /** Dotted translation key under `sharedUI.reportingVisibility.columns.<key>.description`. */
  descriptionKey: string;
}

export const REPORTING_COLUMNS: ReportingColumnDef[] = [
  { key: "incoming",     label: "Incoming",      description: "Total inbound call attempts.",                          labelKey: "sharedUI.reportingVisibility.columns.incoming.label",     descriptionKey: "sharedUI.reportingVisibility.columns.incoming.description" },
  { key: "connected",    label: "Connected",     description: "Calls that reached a destination.",                     labelKey: "sharedUI.reportingVisibility.columns.connected.label",    descriptionKey: "sharedUI.reportingVisibility.columns.connected.description" },
  { key: "qualified",    label: "Qualified",     description: "Calls that met the buyer's quality criteria.",          labelKey: "sharedUI.reportingVisibility.columns.qualified.label",    descriptionKey: "sharedUI.reportingVisibility.columns.qualified.description" },
  { key: "converted",    label: "Converted",     description: "Calls that converted into a paid event.",               labelKey: "sharedUI.reportingVisibility.columns.converted.label",    descriptionKey: "sharedUI.reportingVisibility.columns.converted.description" },
  { key: "notConnected", label: "Not Connected", description: "Calls that failed to reach a destination.",             labelKey: "sharedUI.reportingVisibility.columns.notConnected.label", descriptionKey: "sharedUI.reportingVisibility.columns.notConnected.description" },
  { key: "acl",          label: "ACL",           description: "Average call length across delivered calls.",           labelKey: "sharedUI.reportingVisibility.columns.acl.label",          descriptionKey: "sharedUI.reportingVisibility.columns.acl.description" },
  { key: "tcl",          label: "TCL",           description: "Total call length aggregated across delivered calls.",  labelKey: "sharedUI.reportingVisibility.columns.tcl.label",          descriptionKey: "sharedUI.reportingVisibility.columns.tcl.description" },
  { key: "cost",         label: "Cost",          description: "Spend / payout figures on each call.",                  labelKey: "sharedUI.reportingVisibility.columns.cost.label",         descriptionKey: "sharedUI.reportingVisibility.columns.cost.description" },
];

export const PERMISSIONS: PermissionDef[] = [
  {
    key: "manageTraffic",
    label: "Manage Traffic",
    description: "Users can effectively manage and optimize traffic.",
    labelKey: "x2.partnerPerm.manageTraffic",
    descriptionKey: "x2.partnerPerm.manageTrafficDesc",
  },
  {
    key: "numberCreation",
    label: "Number Creation",
    description: "Users can purchase a new number within the system.",
    labelKey: "x2.partnerPerm.numberCreation",
    descriptionKey: "x2.partnerPerm.numberCreationDesc",
  },
  {
    key: "audioRecording",
    label: "Audio Recording",
    description: "It provides users with the ability to view call recordings.",
    labelKey: "x2.partnerPerm.audioRecording",
    descriptionKey: "x2.partnerPerm.audioRecordingDesc",
  },
  {
    key: "blockNumbers",
    label: "Block Numbers",
    description: "Reject calls from specific phone numbers.",
    labelKey: "buyerAccess.perm.blockNumbers",
    descriptionKey: "buyerAccess.perm.blockNumbersDesc",
  },
  {
    key: "downloadReports",
    label: "Download Reports",
    description: "Users can download reports about their call activity.",
    labelKey: "buyerAccess.perm.downloadReports",
    descriptionKey: "buyerAccess.perm.downloadReportsDesc",
  },
];

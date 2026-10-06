"use client";

/**
 * Publisher settings — Members + Permissions + Advanced collaboration controls.
 *
 * Layout (matches the design spec):
 *   ┌─────────────────────────────────────────────┐
 *   │ Publisher name        [Timezone select]      │
 *   │ Manage settings for this publisher           │
 *   ├──────────── MEMBERS ─────────────────────────┤
 *   ├──────────── PERMISSIONS ─────────────────────┤
 *   ├──────────── ADVANCED SETTINGS ───────────────┤
 *   └─────────────────────────────────────────────┘
 *
 * All state persists per-publisher via `usePublisherAccessStore`.
 */

import * as React from "react";
import { publishersService } from "@/lib/api/services/publishers.service";
import { AlertTriangle, ChevronDown, ChevronUp, Gauge, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  PartnerMembersSection,
  type PartnerMemberRow,
  type PartnerMembersLabels,
} from "@/components/network/partner-members-section";
import { usePartnerRegistration } from "@/hooks/use-partner-registration";
import { useTranslation } from "@/hooks/use-translation";
import {
  PERMISSIONS,
  REPORTING_COLUMNS,
  TIMEZONES,
  usePublisherAccessStore,
  type PermissionKey,
  type ReportingColumnKey,
  type ReportingVisibility,
} from "@/lib/store/publisher-access-store";
import type { Publisher } from "@/lib/types";

interface Props {
  publisher: Publisher;
}

export function PublisherSettingsTab({ publisher }: Props) {
  const access = usePublisherAccessStore((s) => s.byPublisher[publisher.id]);
  const setTimezone = usePublisherAccessStore((s) => s.setTimezone);
  const togglePermission = usePublisherAccessStore((s) => s.togglePermission);
  const toggleReportingColumn = usePublisherAccessStore((s) => s.toggleReportingColumn);
  const setCapEnabled = usePublisherAccessStore((s) => s.setCapEnabled);
  const addMember = usePublisherAccessStore((s) => s.addMember);
  const removeMember = usePublisherAccessStore((s) => s.removeMember);

  const timezone = access?.timezone ?? "UTC";
  const members = access?.members ?? [];
  const permissions = access?.permissions ?? {
    manageTraffic: false,
    numberCreation: false,
    audioRecording: false,
    blockNumbers: false,
    downloadReports: false,
  };
  const reporting: ReportingVisibility = access?.reporting ?? {
    incoming: true,
    connected: true,
    qualified: true,
    converted: true,
    notConnected: true,
    acl: true,
    tcl: true,
    cost: true,
  };
  const capEnabled = access?.cap.enabled ?? false;

  // Who is listed: the publisher's own contact email (the address the backend
  // invites when the publisher is created) plus anyone invited from this tab.
  // Each one's status - "Invited", or "Registered" once they have accepted -
  // is checked against the workspace's logins and refreshes by itself.
  const { t } = useTranslation();
  const contactEmail = (publisher.email ?? "").trim().toLowerCase();
  const memberEmails = React.useMemo(
    () => [...(contactEmail ? [contactEmail] : []), ...members.map((m) => m.email)],
    [contactEmail, members],
  );
  const registration = usePartnerRegistration(memberEmails);
  const memberRows = React.useMemo<PartnerMemberRow[]>(() => {
    const out: PartnerMemberRow[] = [];
    if (contactEmail) {
      out.push({ id: "contact", email: contactEmail, ...registration.info(contactEmail), canRemove: false });
    }
    for (const m of members) {
      if (m.email.trim().toLowerCase() === contactEmail) continue;
      out.push({ id: m.id, email: m.email, ...registration.info(m.email), canRemove: true });
    }
    return out;
  }, [contactEmail, members, registration]);
  const memberLabels = React.useMemo<PartnerMembersLabels>(
    () => ({
      title: t("networkUI.publishers.settings.membersTitle"),
      description: t("networkUI.publishers.settings.membersDesc"),
      searchAria: t("networkUI.publishers.settings.searchMembers"),
      searchPlaceholder: t("networkUI.publishers.settings.searchByEmail"),
      filterAria: t("networkUI.publishers.settings.filterMembers"),
      filterSoon: t("networkUI.publishers.settings.filterSoon"),
      invite: t("networkUI.publishers.settings.invite"),
      invitePlaceholder: t("networkUI.publishers.settings.invitePlaceholder"),
      sendInvite: t("networkUI.publishers.settings.sendInvite"),
      cancel: t("networkUI.publishers.settings.cancel"),
      email: t("networkUI.publishers.settings.email"),
      status: t("networkUI.publishers.settings.status"),
      actions: t("networkUI.publishers.settings.actions"),
      noData: t("networkUI.publishers.settings.noData"),
      invalidEmail: t("networkUI.publishers.settings.invalidEmail"),
      invitedToast: (email) => t("networkUI.publishers.settings.invited").replace("{email}", email),
      removedToast: (email) => t("networkUI.publishers.settings.removed").replace("{email}", email),
      removeAria: (email) => t("networkUI.publishers.settings.removeMemberAria").replace("{email}", email),
    }),
    [t],
  );

  return (
    <Card className="space-y-6 p-6">
      {/* Honest framing — the four sub-sections below (Members,
          Permissions, Reporting visibility, Advanced cap toggle) currently
          persist to localStorage only because the backend has no per-publisher
          collaboration model. The UI is preserved as a preview of the
          intended flow; backend asks for each capability are tracked in the
          asks doc. */}
      <div className="flex items-start gap-2.5 rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3 text-xs">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
        <div className="space-y-1">
          <div className="font-semibold text-[color:var(--warning)]">
            Preview — these settings save to this browser only
          </div>
          <p className="text-muted-foreground">
            Permissions, reporting visibility, and the cap toggle don't yet
            round-trip to the server. Member invites now do — a real invite
            email is sent. Other parts of the publisher record (payout rate,
            status, campaign assignments) are wired correctly via Network →
            Publishers → list/detail.
          </p>
        </div>
      </div>

      <HeaderRow
        title={publisher.name}
        timezone={timezone}
        onTimezoneChange={(v) => setTimezone(publisher.id, v)}
      />

      <PartnerMembersSection
        rows={memberRows}
        labels={memberLabels}
        onInvite={async (email) => {
          // Send the invite first. The local store is display state backed by
          // localStorage - adding to it before the request succeeded is what
          // made the row read "Invited" when no email had been sent.
          await publishersService.invite(publisher.id, email);
          addMember(publisher.id, email);
          registration.refresh();
        }}
        onRemove={(memberId) => removeMember(publisher.id, memberId)}
      />

      <PermissionsSection
        permissions={permissions}
        onToggle={(key) => togglePermission(publisher.id, key)}
      />

      <ReportingVisibilitySection
        visibility={reporting}
        onToggle={(key) => toggleReportingColumn(publisher.id, key)}
      />

      <AdvancedSection
        capEnabled={capEnabled}
        onCapEnabledChange={(v) => setCapEnabled(publisher.id, v)}
      />
    </Card>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────── */

function HeaderRow({
  title,
  timezone,
  onTimezoneChange,
}: {
  title: string;
  timezone: string;
  onTimezoneChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <Info className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("networkUI.publishers.settings.manageSettings")}
        </p>
      </div>
      <Select value={timezone} onValueChange={onTimezoneChange}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ─── Permissions ────────────────────────────────────────────────────── */

function PermissionsSection({
  permissions,
  onToggle,
}: {
  permissions: Record<PermissionKey, boolean>;
  onToggle: (key: PermissionKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <Section
      title={t("networkUI.publishers.settings.permissionsTitle")}
      description={t("networkUI.publishers.settings.permissionsDesc")}
    >
      <ul className="divide-y divide-border">
        {PERMISSIONS.map((p) => (
          <li
            key={p.key}
            className="flex items-center justify-between gap-4 px-4 py-3.5"
          >
            <div>
              <div className="text-sm font-medium leading-tight">{p.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {p.description}
              </div>
            </div>
            <Switch
              checked={!!permissions[p.key]}
              onCheckedChange={() => onToggle(p.key)}
              aria-label={t("networkUI.publishers.settings.permToggle").replace("{label}", p.label)}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ─── Reporting visibility ───────────────────────────────────────────── */

function ReportingVisibilitySection({
  visibility,
  onToggle,
}: {
  visibility: ReportingVisibility;
  onToggle: (key: ReportingColumnKey) => void;
}) {
  const { t } = useTranslation();
  const visibleCount = REPORTING_COLUMNS.filter((c) => visibility[c.key]).length;

  return (
    <Section
      title={t("networkUI.publishers.settings.reportingTitle")}
      description={t("networkUI.publishers.settings.reportingDesc")
        .replace("{visible}", String(visibleCount))
        .replace("{total}", String(REPORTING_COLUMNS.length))}
    >
      <ul className="grid grid-cols-1 gap-1 px-2 py-2 sm:grid-cols-2">
        {REPORTING_COLUMNS.map((col) => {
          const id = `rpt-${col.key}`;
          const checked = !!visibility[col.key];
          return (
            <li key={col.key}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-secondary/40"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() => onToggle(col.key)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">
                    {t(col.labelKey)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t(col.descriptionKey)}
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ─── Advanced settings ──────────────────────────────────────────────── */

function AdvancedSection({
  capEnabled,
  onCapEnabledChange,
}: {
  capEnabled: boolean;
  onCapEnabledChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Section
      title={t("networkUI.publishers.settings.advancedTitle")}
      description={t("networkUI.publishers.settings.advancedDesc")}
    >
      <div className="px-2 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-3 text-left transition-colors hover:bg-secondary/40"
        >
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium leading-tight">{t("networkUI.publishers.settings.capSettings")}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t("networkUI.publishers.settings.capSettingsDesc")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={capEnabled ? "success" : "outline"}>
              {capEnabled ? t("networkUI.publishers.settings.enabled") : t("networkUI.publishers.settings.disabled")}
            </Badge>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
        {expanded && (
          <div className="mx-3 mt-2 rounded-md border border-border bg-secondary/30 p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{t("networkUI.publishers.settings.enableCapTitle")}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("networkUI.publishers.settings.enableCapDesc")}
                </div>
              </div>
              <Switch
                checked={capEnabled}
                onCheckedChange={onCapEnabledChange}
                aria-label={t("networkUI.publishers.settings.enableCapAria")}
              />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ─── Shared sub-card shell ──────────────────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background/30">
      <header className="px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

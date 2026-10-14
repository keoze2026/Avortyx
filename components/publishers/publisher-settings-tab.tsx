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
 * Permissions and Reporting visibility are saved on the server
 * (`/api/accounts/publisher/{id}/settings`) - the fields the publisher's own
 * login reads. Time zone and the cap switch still live in this browser
 * (`usePublisherAccessStore`) until the backend has them.
 */

import * as React from "react";
import { publishersService } from "@/lib/api/services/publishers.service";
import { usePartnerSettingsStore } from "@/lib/store/partner-settings-store";
import { AlertTriangle, ChevronDown, ChevronUp, Gauge, Info } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  PartnerPermissions,
  PartnerReportingVisibility,
} from "@/components/network/partner-access-sections";
import {
  PartnerMembersSection,
  type PartnerMemberRow,
  type PartnerMembersLabels,
} from "@/components/network/partner-members-section";
import { usePartnerRegistration } from "@/hooks/use-partner-registration";
import { forgetEmails, markInvited, removePartnerMember } from "@/lib/partner-access";
import { useTranslation } from "@/hooks/use-translation";
import {
  TIMEZONES,
  usePublisherAccessStore,
} from "@/lib/store/publisher-access-store";
import type { Publisher } from "@/lib/types";

interface Props {
  publisher: Publisher;
}

export function PublisherSettingsTab({ publisher }: Props) {
  const access = usePublisherAccessStore((s) => s.byPublisher[publisher.id]);
  const setTimezone = usePublisherAccessStore((s) => s.setTimezone);
  const setCapEnabled = usePublisherAccessStore((s) => s.setCapEnabled);
  const addMember = usePublisherAccessStore((s) => s.addMember);
  const removeMember = usePublisherAccessStore((s) => s.removeMember);

  // Time zone: the server's copy (partner settings) wins, so every browser and
  // device shows the same one. The browser copy is only the fallback - it is
  // why the time zone used to read UTC anywhere but the browser it was set in.
  const serverTimezone = usePartnerSettingsStore((s) => s.byPartner[`publisher:${publisher.id}`]?.timezone);
  const timezoneOnServer = usePartnerSettingsStore((s) => !!s.timezoneOnServer[`publisher:${publisher.id}`]);
  const fetchPartnerSettings = usePartnerSettingsStore((s) => s.fetchSettings);
  const savePartnerTimezone = usePartnerSettingsStore((s) => s.setTimezone);
  React.useEffect(() => {
    void fetchPartnerSettings("publisher", publisher.id);
  }, [publisher.id, fetchPartnerSettings]);
  const timezone = serverTimezone ?? access?.timezone ?? "UTC";
  const onTimezoneChange = (tz: string) => {
    setTimezone(publisher.id, tz); // browser copy (fallback)
    void savePartnerTimezone("publisher", publisher.id, tz).catch(() =>
      toast.error("Couldn't save the time zone on the server. Please try again."),
    );
  };
  const members = access?.members ?? [];
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
            {timezoneOnServer ? "Cap setting saves to this browser only" : "Time zone and cap setting save to this browser only"}
          </div>
          <p className="text-muted-foreground">
            Members, Permissions and Reporting visibility are saved on the
            server and apply to this publisher's own login. The time zone and
            the cap switch below will follow once the backend supports them.
          </p>
        </div>
      </div>

      <HeaderRow
        title={publisher.name}
        timezone={timezone}
        onTimezoneChange={onTimezoneChange}
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
          // A new invitation starts from scratch, even for an email seen before.
          markInvited([email]);
          registration.refresh();
        }}
        onRemove={async (memberId) => {
          const member = members.find((m) => m.id === memberId);
          if (!member) return;
          // End their access on the server first; only then drop the row.
          const outcome = await removePartnerMember("publisher", publisher.id, member.email);
          removeMember(publisher.id, memberId);
          forgetEmails([member.email]);
          registration.refresh();
          return outcome;
        }}
      />

      {/* Saved on the server: what this publisher's OWN login may do and
          which report columns it sees. The admin's Reports are never affected. */}
      <PartnerPermissions
        kind="publisher"
        id={publisher.id}
        title={t("networkUI.publishers.settings.permissionsTitle")}
        description={t("networkUI.publishers.settings.permissionsDesc")}
        toggleAria={t("networkUI.publishers.settings.permToggle")}
      />

      <PartnerReportingVisibility
        kind="publisher"
        id={publisher.id}
        idPrefix="rpt"
        title={t("networkUI.publishers.settings.reportingTitle")}
        description={t("networkUI.publishers.settings.reportingDesc")}
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
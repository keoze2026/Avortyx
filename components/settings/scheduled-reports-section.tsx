"use client";

/**
 * Settings → Scheduled Reports
 *
 * Lets the user opt-in to an automatic end-of-shift email digest. Persists
 * to localStorage via `useScheduledReportsStore`. A background runtime fires
 * a simulated email (toast + push notification) at the chosen time.
 */

import * as React from "react";
import {
  Calendar,
  Clock,
  Globe2,
  Loader2,
  Mail,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { SectionShell } from "./profile-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { PORTAL_TIMEZONES } from "@/lib/store/auto-schedule-store";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  REPORT_SECTIONS,
  WEEKDAYS,
  useScheduledReportsStore,
  type ReportFormat,
  type ReportSection,
  type Weekday,
} from "@/lib/store/scheduled-reports-store";
import { cn } from "@/lib/utils";
import { formatLocalDateTime } from "@/lib/format";

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 15, 30, 45];

function to12h(h: number): { hour: number; period: "AM" | "PM" } {
  if (h === 0) return { hour: 12, period: "AM" };
  if (h === 12) return { hour: 12, period: "PM" };
  if (h < 12) return { hour: h, period: "AM" };
  return { hour: h - 12, period: "PM" };
}
function to24h(h12: number, period: "AM" | "PM"): number {
  if (period === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

export function ScheduledReportsSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const report = useScheduledReportsStore((s) => s.report);
  const reportId = useScheduledReportsStore((s) => s.reportId);
  const hydrate = useScheduledReportsStore((s) => s.hydrate);
  const hydrated = useScheduledReportsStore((s) => s.hydrated);
  const setEnabled = useScheduledReportsStore((s) => s.setEnabled);
  const setRecipient = useScheduledReportsStore((s) => s.setRecipient);
  const setTime = useScheduledReportsStore((s) => s.setTime);
  const setTimezone = useScheduledReportsStore((s) => s.setTimezone);
  const toggleDay = useScheduledReportsStore((s) => s.toggleDay);
  const setFormat = useScheduledReportsStore((s) => s.setFormat);
  const toggleSection = useScheduledReportsStore((s) => s.toggleSection);
  const runNow = useScheduledReportsStore((s) => s.runNow);
  const [sending, setSending] = React.useState(false);

  // Hydrate the schedule from the backend once on mount. Subsequent edits
  // round-trip via the store's debounced sync.
  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Default the recipient field to the signed-in user's email the first time
  // the section renders with an empty recipient AFTER hydration (so we don't
  // overwrite a server-stored recipient).
  React.useEffect(() => {
    if (!hydrated) return;
    if (!report.recipient && user?.email) void setRecipient(user.email);
  }, [hydrated, report.recipient, user?.email, setRecipient]);

  const time12 = to12h(report.hour);
  const recipient = report.recipient || user?.email || "";

  const emailValid = /^\S+@\S+\.\S+$/.test(recipient);
  const dayValid = report.days.length > 0;
  const sectionValid = report.sections.length > 0;

  const onSendNow = async () => {
    if (!emailValid) {
      toast.error(t("settings.scheduledReports.validationEmail"));
      return;
    }
    setSending(true);
    try {
      await runNow();
      toast.success(
        t("settings.scheduledReports.testSent").replace("{email}", recipient),
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't trigger the report",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SectionShell
      eyebrow={t("settings.scheduledReports.eyebrow")}
      title={t("settings.scheduledReports.title")}
      description={t("settings.scheduledReports.description")}
    >
      {/* Enable + recipient */}
      <Card>
        <CardContent className="space-y-5 p-6">
          {/* Master toggle */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">
                {t("settings.scheduledReports.enable")}
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("settings.scheduledReports.enableHint")}
              </p>
            </div>
            <Switch
              checked={report.enabled}
              onCheckedChange={setEnabled}
              aria-label={t("settings.scheduledReports.enable")}
            />
          </div>

          {/* Everything else gates on the master toggle. */}
          <div
            className={cn(
              "space-y-5 border-t border-border pt-5",
              !report.enabled && "pointer-events-none opacity-50",
            )}
            aria-disabled={!report.enabled}
          >
            {/* Recipient */}
            <div className="grid gap-2">
              <Label htmlFor="sr-recipient" className="inline-flex items-center gap-1.5 text-xs font-medium">
                <Mail className="h-3 w-3 text-muted-foreground" />
                {t("settings.scheduledReports.recipient")}
              </Label>
              <Input
                id="sr-recipient"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={t("settings.scheduledReports.recipientPlaceholder")}
                aria-invalid={!emailValid}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("settings.scheduledReports.recipientHint")}
              </p>
            </div>

            {/* Time + Timezone */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {t("settings.scheduledReports.time")}
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(time12.hour)}
                    onValueChange={(v) =>
                      setTime(to24h(Number(v), time12.period), report.minute)
                    }
                  >
                    <SelectTrigger className="h-9 w-20 tabular-nums">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS_12.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">:</span>
                  <Select
                    value={String(report.minute)}
                    onValueChange={(v) => setTime(report.hour, Number(v))}
                  >
                    <SelectTrigger className="h-9 w-20 tabular-nums">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {String(m).padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={time12.period}
                    onValueChange={(v) =>
                      setTime(to24h(time12.hour, v as "AM" | "PM"), report.minute)
                    }
                  >
                    <SelectTrigger className="h-9 w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("settings.scheduledReports.timeHint")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <Globe2 className="h-3 w-3 text-muted-foreground" />
                  {t("settings.scheduledReports.timezone")}
                </Label>
                <Select value={report.timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PORTAL_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.iana} value={tz.iana}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Days */}
            <div className="space-y-1.5">
              <Label className="inline-flex items-center gap-1.5 text-xs font-medium">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {t("settings.scheduledReports.days")}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const active = report.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={active}
                    >
                      {t(`settings.scheduledReports.day.${day}`)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("settings.scheduledReports.daysHint")}
              </p>
              {!dayValid && (
                <p className="text-[11px] text-destructive">
                  {t("settings.scheduledReports.validationDays")}
                </p>
              )}
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t("settings.scheduledReports.format")}
              </Label>
              <div className="inline-flex w-full rounded-md border border-border bg-muted p-0.5 sm:w-auto">
                {(["pdf", "csv", "both"] as ReportFormat[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFormat(opt)}
                    className={cn(
                      "flex-1 rounded px-3 py-1.5 text-xs transition-colors sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      report.format === opt
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(
                      `settings.scheduledReports.format${
                        opt === "pdf" ? "Pdf" : opt === "csv" ? "Csv" : "Both"
                      }`,
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t("settings.scheduledReports.sections")}
              </Label>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {REPORT_SECTIONS.map((sec) => {
                  const id = `sr-section-${sec}`;
                  const checked = report.sections.includes(sec);
                  return (
                    <li key={sec}>
                      <label
                        htmlFor={id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/40"
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={() => toggleSection(sec)}
                        />
                        <span className="text-sm">
                          {t(`settings.scheduledReports.section.${sec}`)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                {t("settings.scheduledReports.sectionsHint")}
              </p>
              {!sectionValid && (
                <p className="text-[11px] text-destructive">
                  {t("settings.scheduledReports.validationSections")}
                </p>
              )}
            </div>

            {/* Footer — last-sent meta + Send-now button (POST .../run-now).
                Disabled until the schedule has been saved to the backend
                (`reportId` exists) so we don't try to run a report that
                hasn't been created yet. Rate-limited to once-per-minute
                server-side; a 429 surfaces back through the toast. */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="text-[11px] text-muted-foreground">
                {report.lastSentAt
                  ? t("settings.scheduledReports.lastSent").replace(
                      "{time}",
                      formatLocalDateTime(report.lastSentAt),
                    )
                  : t("settings.scheduledReports.neverSent")}
              </div>
              <Button
                size="sm"
                onClick={onSendNow}
                disabled={
                  sending || !reportId || !emailValid || !dayValid || !sectionValid
                }
                title={
                  !reportId
                    ? "Save the schedule first by enabling + entering a recipient"
                    : undefined
                }
              >
                {sending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("settings.scheduledReports.sendingTest")}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    {t("settings.scheduledReports.sendTestNow")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </SectionShell>
  );
}

// Re-export the Weekday type for downstream typing.
export type { Weekday, ReportFormat, ReportSection };

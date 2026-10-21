"use client";

/**
 * AutoScheduleCard — opt-in daily play / pause schedule for a single
 * campaign, buyer, or destination. Values are stored in the auto-schedule
 * store and evaluated by the schedule runtime every minute against the
 * portal's configured timezone.
 */

import * as React from "react";
import { Clock, Globe2 } from "lucide-react";

import { Card } from "@/components/ui/card";
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
import {
  PORTAL_TIMEZONES,
  to12h,
  to24h,
  type AutoSchedule,
  type ScheduleTarget,
} from "@/lib/store/auto-schedule-store";
import { useAutoScheduleStore } from "@/lib/store/auto-schedule-store";

interface Props {
  target: ScheduleTarget;
  id: string;
  /** Optional label tweak for the description text ("campaign" / "buyer" / "destination"). */
  entityLabel?: string;
}

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 15, 30, 45];

export function AutoScheduleCard({ target, id, entityLabel }: Props) {
  const { t } = useTranslation();
  const schedule = useAutoScheduleStore((s) =>
    target === "campaign"
      ? s.campaignSchedules[id]
      : target === "buyer"
        ? s.buyerSchedules[id]
        : s.destinationSchedules[id],
  ) ?? { enabled: false, playHour: 8, pauseHour: 17, playMinute: 0, pauseMinute: 0 };
  const playMinute = schedule.playMinute ?? 0;
  const pauseMinute = schedule.pauseMinute ?? 0;
  const portalTimezone = useAutoScheduleStore((s) => s.portalTimezone);
  const setSchedule = useAutoScheduleStore((s) => s.setSchedule);

  const update = (patch: Partial<AutoSchedule>) => {
    setSchedule(target, id, { ...schedule, ...patch });
  };

  const play = to12h(schedule.playHour);
  const pause = to12h(schedule.pauseHour);

  // The noun goes into a translated sentence, so it is translated too (with
  // the case the sentence needs); an unknown noun is shown as passed.
  const nounKey = `x6.autoSchedule.entity.${entityLabel ?? target}`;
  const translatedNoun = t(nounKey);
  const labelNoun = translatedNoun === nounKey ? entityLabel ?? target : translatedNoun;
  // "08:00 AM" with AM / PM in the chosen language.
  const formatTime12 = (hour24: number, minute: number) => {
    const { hour, period } = to12h(hour24);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${t(period === "AM" ? "x6.time.am" : "x6.time.pm")}`;
  };
  const tzLabel =
    PORTAL_TIMEZONES.find((tz) => tz.iana === portalTimezone)?.label ?? portalTimezone;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            <Clock className="mr-1.5 inline h-3 w-3 text-accent" />
            {t("sharedUI.autoSchedule.heading")}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("sharedUI.autoSchedule.descriptionTemplate").replace("{entity}", labelNoun)}
          </p>
        </div>
        <Switch
          checked={schedule.enabled}
          onCheckedChange={(v) => update({ enabled: Boolean(v) })}
          aria-label={t("sharedUI.autoSchedule.enableAria")}
        />
      </div>

      <div className="my-4 h-px w-full bg-border" />

      <div
        className={
          schedule.enabled
            ? ""
            : "pointer-events-none select-none opacity-50"
        }
        aria-disabled={!schedule.enabled}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Play time */}
          <TimeField
            label={t("sharedUI.autoSchedule.playAt")}
            hint={t("sharedUI.autoSchedule.playHintTemplate").replace("{entity}", labelNoun)}
            hour={play.hour}
            minute={playMinute}
            period={play.period}
            onChange={(h, m, p) => update({ playHour: to24h(h, p), playMinute: m })}
          />
          {/* Pause time */}
          <TimeField
            label={t("sharedUI.autoSchedule.pauseAt")}
            hint={t("sharedUI.autoSchedule.pauseHintTemplate").replace("{entity}", labelNoun)}
            hour={pause.hour}
            minute={pauseMinute}
            period={pause.period}
            onChange={(h, m, p) => update({ pauseHour: to24h(h, p), pauseMinute: m })}
          />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe2 className="h-3 w-3" />
            {t("sharedUI.autoSchedule.portalTimezone")}
          </span>
          <span className="text-xs font-medium text-foreground">{tzLabel}</span>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("sharedUI.autoSchedule.currentlyScheduled")}{" "}
          <span className="font-medium text-foreground">{formatTime12(schedule.playHour, playMinute)}</span>
          {" → "}
          <span className="font-medium text-foreground">{formatTime12(schedule.pauseHour, pauseMinute)}</span>
          {schedule.playHour === schedule.pauseHour && playMinute === pauseMinute && (
            <span className="ml-1 text-destructive">{t("sharedUI.autoSchedule.mustDiffer")}</span>
          )}
        </p>
      </div>
    </Card>
  );
}

/* ─── 12-hour time field (hour Select + AM/PM Select) ────────────────── */

function TimeField({
  label,
  hint,
  hour,
  minute,
  period,
  onChange,
}: {
  label: string;
  hint: string;
  hour: number;
  minute: number;
  period: "AM" | "PM";
  onChange: (hour: number, minute: number, period: "AM" | "PM") => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="mt-1 flex items-center gap-2">
        <Select
          value={String(hour)}
          onValueChange={(v) => onChange(Number(v), minute, period)}
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
          value={String(minute)}
          onValueChange={(v) => onChange(hour, Number(v), period)}
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
          value={period}
          onValueChange={(v) => onChange(hour, minute, v as "AM" | "PM")}
        >
          <SelectTrigger className="h-9 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">{t("x6.time.am")}</SelectItem>
            <SelectItem value="PM">{t("x6.time.pm")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

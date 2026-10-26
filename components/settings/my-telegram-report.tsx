"use client";

/**
 * A buyer login's own switch for its daily Telegram report (CH-259, Sir 25 Oct):
 * "only for those who tick the box and approve the bot to send the report".
 * Nothing is sent until the buyer ticks it here; it can untick it any time.
 * The chat and time are set up by the workspace (Buyer > Settings > Telegram
 * Report). Shown under Settings > Scheduled Reports to buyer logins only.
 * Backend: /api/buyers/my/telegram-report.
 */

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { formatLocalDateTime } from "@/lib/format";

interface Mine {
  approved: boolean;
  approvedAt: string | null;
  setUp: boolean;
  sendTime: string;
  noRecordingLink: boolean;
  bot: string;
  lastSentAt: string | null;
}

function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function MyTelegramReport() {
  const { t } = useTranslation();
  const [mine, setMine] = React.useState<Mine | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    http.get<Mine>("/api/buyers/my/telegram-report").then(setMine).catch(() => undefined);
  }, []);

  const toggle = async (approved: boolean) => {
    setBusy(true);
    try {
      setMine(await http.patch<Mine>("/api/buyers/my/telegram-report", { body: { approved } }));
      toast.success(approved ? t("myReport.on") : t("myReport.off"));
    } catch {
      toast.error(t("myReport.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Send className="h-4 w-4 text-accent" />
            {t("myReport.title")}
          </span>
          {mine ? (
            <Switch checked={mine.approved} disabled={busy} onCheckedChange={toggle} aria-label={t("myReport.approve")} />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{t("myReport.approve")}</p>
        <p className="text-xs text-muted-foreground">{t("myReport.explain")}</p>
        {mine && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              {mine.setUp
                ? t("myReport.time").replace("{time}", time12(mine.sendTime))
                : t("myReport.notSetUp")}
            </li>
            {mine.bot && <li>{t("myReport.bot").replace("{bot}", mine.bot)}</li>}
            {mine.noRecordingLink && <li>{t("myReport.noRecordings")}</li>}
            {mine.lastSentAt && (
              <li>{t("myReport.last").replace("{when}", formatLocalDateTime(mine.lastSentAt))}</li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

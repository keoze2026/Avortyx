"use client";

import { useTranslation } from "@/hooks/use-translation";
import { formatCallTime } from "@/lib/format";
import { useUIStore } from "@/lib/store/ui-store";
import type { LineSwitch } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Switched off by Mike Ross, Oct 22, 16:30:51" under a line's on/off switch
 * (Sir, 22 Oct, CH-200): a line switched off refuses every call routed to it,
 * so the workspace shows who did it and when, in the portal time zone.
 */
export function LastSwitched({ info, className }: { info?: LineSwitch | null; className?: string }) {
  const { t } = useTranslation();
  const timeZone = useUIStore((s) => s.reportTimezone);
  if (!info || !info.by) return null;
  const ts = Date.parse(info.at);
  const when = Number.isFinite(ts) ? formatCallTime(ts, timeZone) : "";
  const text = (info.enabled ? t("lineSwitch.onBy") : t("lineSwitch.offBy"))
    .replace("{name}", info.by)
    .replace("{when}", when);
  return (
    <div
      className={cn(
        "mt-0.5 whitespace-nowrap text-[10px] leading-tight",
        info.enabled ? "text-muted-foreground" : "font-medium text-destructive",
        className,
      )}
      title={info.byEmail || info.by}
    >
      {text}
    </div>
  );
}

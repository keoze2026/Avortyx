"use client";

/**
 * CH-558: one notification entry, in Sir's design - a colour dot, the title,
 * one grey line, the time on the right. On the full page (`full`) also the
 * one-line explanation, the per-buyer figures, and the action link.
 * Opening an entry marks everything it stands for as read.
 */
import Link from "next/link";

import { useTranslation } from "@/hooks/use-translation";
import { translateServerMessage } from "@/lib/i18n/server-messages";
import { TONE_DOT, shortTime, type FeedEntry } from "@/lib/notifications/feed";
import { useNotificationsReadStore } from "@/lib/store/notifications-read-store";
import { cn } from "@/lib/utils";

export function FeedRow({ entry, full = false }: { entry: FeedEntry; full?: boolean }) {
  const { locale } = useTranslation();
  const markAllRead = useNotificationsReadStore((s) => s.markAllRead);
  const title = translateServerMessage(entry.title, locale);
  const line = full ? entry.body && translateServerMessage(entry.body, locale) : entry.subtitle;

  return (
    <li
      onClick={() => !entry.read && markAllRead(entry.ids)}
      className={cn(
        "flex gap-3 px-5 py-4 transition-colors",
        !entry.read ? "bg-accent/[0.06]" : "hover:bg-secondary/30",
      )}
    >
      <span aria-hidden className={cn("mt-[7px] h-2 w-2 shrink-0 rounded-full", TONE_DOT[entry.tone])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className={cn("text-[15px] leading-snug", entry.read ? "font-medium text-foreground/80" : "font-semibold text-foreground")}>
              {title}
            </p>
            {line && <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{line}</p>}
            {full && !entry.details && entry.subtitle && (
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{entry.subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-xs tabular-nums text-muted-foreground">{shortTime(entry.at, locale)}</span>
            {full && entry.action && (
              <Link href={entry.action.href} className="text-sm font-medium text-accent hover:underline">
                {entry.action.label}
              </Link>
            )}
          </div>
        </div>
        {full && entry.details && entry.details.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 font-mono text-[13px] sm:grid-cols-2 lg:grid-cols-4">
            {entry.details.map((d) => (
              <div key={d.name} className="flex items-baseline gap-3">
                <span className="w-12 shrink-0 truncate font-semibold text-foreground" title={d.name}>
                  {d.name}
                </span>
                <span className={cn(d.hot ? "text-[#EF4444]" : "text-muted-foreground")}>{d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

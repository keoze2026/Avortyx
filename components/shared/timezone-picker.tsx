"use client";

/**
 * Timezone picker, shared by the Reports toolbar and the Dashboard header.
 *
 * The selection lives in the UI store, not local state — the Call Log, the
 * hourly chart and the dashboard all render their timestamps in it, and it
 * persists across reloads. Keeping one component means the two pages can't
 * drift apart the way they did while this markup was inlined in Reports only.
 */

import { ChevronDown, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/lib/store/ui-store";
import { TIMEZONES, TIMEZONE_BY_IANA } from "@/lib/timezones";
import { cn } from "@/lib/utils";

export function TimezonePicker({ className }: { className?: string }) {
  const tzIana = useUIStore((s) => s.reportTimezone);
  const setTzIana = useUIStore((s) => s.setReportTimezone);
  const tzLabel = TIMEZONE_BY_IANA[tzIana]?.label ?? tzIana;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* min-w-0 lets the label actually truncate inside the flex row, and
            the cap scales with the viewport — 18rem overflowed on phones. */}
        <Button variant="outline" size="sm" className={cn("min-w-0 gap-2", className)}>
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="max-w-[11rem] truncate sm:max-w-[18rem]">{tzLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-80 overflow-y-auto">
        {TIMEZONES.map((tz) => (
          <DropdownMenuItem
            key={tz.iana}
            onSelect={() => setTzIana(tz.iana)}
            className={cn(tzIana === tz.iana && "text-accent")}
          >
            {tz.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

/**
 * CH-675: shown across the top of a client's portal while the platform owner
 * looks at it through Open their portal - read-only, every view in the audit
 * log, ends by itself. Nothing for an ordinary sign-in.
 */

import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { formatLocalDateTime } from "@/lib/format";
import { endOwnerView, readOwnerView, type OwnerViewSession } from "@/lib/owner-view";

export function OwnerViewBanner() {
  const { t } = useTranslation();
  const [view, setView] = useState<OwnerViewSession | null>(null);

  useEffect(() => {
    const v = readOwnerView();
    setView(v);
    if (!v) return;
    const tick = () => {
      if (Date.now() >= v.until) endOwnerView();
    };
    const h = setInterval(tick, 15_000);
    return () => clearInterval(h);
  }, []);

  if (!view) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-semibold">{t("x675.view.bannerTitle").replace("{account}", view.account)}</span>{" "}
          {t("x675.view.bannerBody")}{" "}
          <span className="whitespace-nowrap text-xs opacity-80">
            {t("x675.view.endsAt").replace("{time}", formatLocalDateTime(view.until, { timeStyle: "short" }))}
          </span>
        </span>
      </span>
      <Button size="sm" variant="outline" className="h-7 border-amber-600/40 bg-transparent" onClick={endOwnerView}>
        <X className="mr-1 h-3.5 w-3.5" /> {t("x675.view.exit")}
      </Button>
    </div>
  );
}

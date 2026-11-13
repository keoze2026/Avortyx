"use client";

/**
 * CH-675: where Open their portal lands. The script at the top of every page
 * (app/layout.tsx, ownerViewInitScript) has already kept the pass for this
 * tab; this page only moves on to the account's dashboard - or says the link
 * has ended.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { useTranslation } from "@/hooks/use-translation";
import { readOwnerView } from "@/lib/owner-view";

export default function OwnerViewStart() {
  const { t } = useTranslation();
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (readOwnerView()) window.location.replace("/dashboard");
    else setEnded(true);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center text-sm text-muted-foreground">
        <Logo animated={!ended} className="h-10 w-10" uid="owner-view" />
        {ended ? (
          <>
            <p>{t("x675.view.ended")}</p>
            <Link href="/owner" className="text-accent hover:underline">
              {t("owner.orgs.title")}
            </Link>
          </>
        ) : (
          <p>{t("x675.view.opening")}</p>
        )}
      </div>
    </div>
  );
}

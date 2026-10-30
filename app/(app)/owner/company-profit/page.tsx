"use client";

/** Owner > Company Profit (CH-434). System owner only. */
import { ShieldX } from "lucide-react";

import { CompanyProfitPage } from "@/components/owner/company-profit-page";
import { useTranslation } from "@/hooks/use-translation";
import { useAuthStore } from "@/lib/store/auth-store";

export default function Page() {
  const { t } = useTranslation();
  const isSuperuser = useAuthStore((s) => s.user?.isSuperuser === true);
  if (!isSuperuser) {
    return (
      <div className="mx-auto w-full max-w-[560px] pt-24 text-center">
        <ShieldX className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">{t("owner.notYours.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("owner.notYours.body")}</p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <CompanyProfitPage />
    </div>
  );
}

"use client";

/**
 * TFN Check (Sir, 22 Oct, CH-214): our own version of XOLO's number lookup.
 * Paste numbers and see whether each is working; optionally place a real
 * test call to each live one. Share links let partners check without a login.
 */
import * as React from "react";

import { PageHeader } from "@/components/shared/page-header";
import { CheckLinksCard } from "@/components/tfn-check/check-links-card";
import { TfnCheckPanel } from "@/components/tfn-check/tfn-check-panel";
import { useTranslation } from "@/hooks/use-translation";
import { tfnCheckService } from "@/lib/api/services/tfn-check.service";
import { usePermissions } from "@/lib/my-permissions";
import { useAuthStore } from "@/lib/store/auth-store";

export default function TfnCheckPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const role = useAuthStore((s) => s.user?.role);
  const onCheck = React.useCallback(
    (numbers: string, test: boolean) => tfnCheckService.check(numbers, test),
    [],
  );

  return (
    <div className="space-y-8">
      <PageHeader title={t("tfnCheck.title")} description={t("tfnCheck.portalDescription")} />
      <TfnCheckPanel onCheck={onCheck} allowTests={role !== "publisher"} />
      <CheckLinksCard
        canEdit={can("tracking-numbers", "edit")}
        canDelete={can("tracking-numbers", "delete")}
      />
    </div>
  );
}

"use client";

/**
 * TFN Check (Sir, 22 Oct, CH-214): our own version of XOLO's number lookup.
 * Paste numbers and see whether each is working; press Test call on a number
 * to watch a test call go through our own phone system step by step (CH-239).
 * Share links let partners check without a login.
 */
import * as React from "react";

import { PageHeader } from "@/components/shared/page-header";
import { CheckLinksCard } from "@/components/tfn-check/check-links-card";
import { TfnCheckPanel } from "@/components/tfn-check/tfn-check-panel";
import { useTranslation } from "@/hooks/use-translation";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { tfnCheckService } from "@/lib/api/services/tfn-check.service";
import { usePermissions } from "@/lib/my-permissions";

export default function TfnCheckPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  // A publisher login (CH-240): its own TFNs only, test calls only with
  // "TFN Test Calls" on in its Publisher Access, and no share links.
  const partner = usePartnerPermissions();
  const mayTest = !partner.isPartner || partner.can("tfn_test");
  const onCheck = React.useCallback(
    (numbers: string, test: boolean) => tfnCheckService.check(numbers, test),
    [],
  );

  return (
    <div className="space-y-8">
      <PageHeader title={t("tfnCheck.title")} description={t("tfnCheck.portalDescription")} />
      {/* Staff test any number; a publisher only its own, and the backend
          enforces both. */}
      <TfnCheckPanel
        onCheck={onCheck}
        onStartTest={mayTest ? tfnCheckService.startTestCall : undefined}
        onGetTest={mayTest ? tfnCheckService.getTestCall : undefined}
      />
      {!partner.isPartner && (
        <CheckLinksCard
          canEdit={can("tracking-numbers", "edit")}
          canDelete={can("tracking-numbers", "delete")}
        />
      )}
    </div>
  );
}

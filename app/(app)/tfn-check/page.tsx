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
import { tfnCheckService } from "@/lib/api/services/tfn-check.service";
import { usePermissions } from "@/lib/my-permissions";

export default function TfnCheckPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const onCheck = React.useCallback(
    (numbers: string, test: boolean) => tfnCheckService.check(numbers, test),
    [],
  );

  return (
    <div className="space-y-8">
      <PageHeader title={t("tfnCheck.title")} description={t("tfnCheck.portalDescription")} />
      {/* Every portal login may test its own numbers; a publisher's are
          limited to theirs by the backend. */}
      <TfnCheckPanel
        onCheck={onCheck}
        onStartTest={tfnCheckService.startTestCall}
        onGetTest={tfnCheckService.getTestCall}
      />
      <CheckLinksCard
        canEdit={can("tracking-numbers", "edit")}
        canDelete={can("tracking-numbers", "delete")}
      />
    </div>
  );
}

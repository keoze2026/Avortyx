"use client";

import { useTranslation } from "@/hooks/use-translation";

/**
 * Campaign verticals are fixed values ("Health Insurance", "Legal"...), see
 * VERTICAL_FROM_WIRE in lib/api/services/campaigns.service.ts. Shown in the
 * chosen language (CH-318); the stored value stays English.
 */
const VERTICAL_KEYS: Record<string, string> = {
  "Health Insurance": "x318.network.vertical.health",
  "Auto Insurance": "x318.network.vertical.autoInsurance",
  Automotive: "x318.network.vertical.auto",
  "Home Services": "x318.network.vertical.home",
  Finance: "x318.network.vertical.finance",
  Legal: "x318.network.vertical.legal",
  Insurance: "x318.network.vertical.insurance",
  Other: "x318.network.vertical.other",
};

export function useVerticalLabel(): (vertical: string | null | undefined) => string {
  const { t } = useTranslation();
  return (vertical) => {
    const v = vertical ?? "";
    const key = VERTICAL_KEYS[v];
    return key ? t(key) : v;
  };
}

export function VerticalLabel({ vertical }: { vertical: string | null | undefined }) {
  const label = useVerticalLabel();
  return <>{label(vertical)}</>;
}

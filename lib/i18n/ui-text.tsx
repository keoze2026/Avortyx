"use client";

/** A translated word for shared building blocks that are not client components
 *  themselves (components/ui/*): <UiText k="x318.ui.close" />. */
import { useTranslation } from "@/hooks/use-translation";

export function UiText({ k }: { k: string }) {
  const { t } = useTranslation();
  return <>{t(k)}</>;
}

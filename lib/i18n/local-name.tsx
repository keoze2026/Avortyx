"use client";

/**
 * Names the team typed (campaigns, buyers, publishers, destinations, carriers,
 * pools, workspaces) shown in the chosen language's script - the same rule the
 * Reports already use (lib/name-translation.ts). Only what is shown changes:
 * the real name stays in the data, in searches, filters and exports, and is
 * shown on hover.
 *
 *   const localName = useLocalName();      localName(buyer.name)
 *   <LocalName name={buyer.name} />        (a <span> with the real name on hover)
 */
import * as React from "react";

import { useLocaleStore } from "@/lib/store/locale-store";
import { localizeName } from "@/lib/name-translation";

export function useLocalName(): (name: string | null | undefined) => string {
  const locale = useLocaleStore((s) => s.locale);
  return React.useCallback((name: string | null | undefined) => localizeName(name, locale), [locale]);
}

export function LocalName({ name, className }: { name: string | null | undefined; className?: string }) {
  const localName = useLocalName();
  const shown = localName(name);
  const real = name ?? "";
  return (
    <span className={className} title={shown !== real ? real : undefined}>
      {shown}
    </span>
  );
}

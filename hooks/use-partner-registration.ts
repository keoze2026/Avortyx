"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  normEmail,
  normalizeEmails,
  startRegistrationTracking,
  type RegistrationMap,
  type RegistrationTracker,
} from "@/lib/partner-registration";
import { useRegisteredPartnersStore } from "@/lib/store/registered-partners-store";

/**
 * Whether each of these invited people has accepted their invitation.
 *
 *   const reg = usePartnerRegistration(["a@x.com", "b@y.com"]);
 *   reg.info("a@x.com")  ->  { registered: boolean, lastLoginAt: number | null }
 *
 * Checks now, every 30 s while the tab is visible, and when the tab regains
 * focus. `refresh()` checks immediately. Anyone this browser has seen
 * registered stays registered (see registered-partners-store).
 */
export function usePartnerRegistration(emails: readonly string[]) {
  const seen = useRegisteredPartnersStore((s) => s.seen);
  const remember = useRegisteredPartnersStore((s) => s.remember);
  const [live, setLive] = useState<RegistrationMap>(() => new Map());
  const tracker = useRef<RegistrationTracker | null>(null);

  const key = useMemo(() => normalizeEmails(emails).join("|"), [emails]);

  useEffect(() => {
    if (!key) {
      setLive(new Map());
      return;
    }
    const t = startRegistrationTracking(key.split("|"), (map) => {
      setLive(map);
      const nowRegistered: string[] = [];
      map.forEach((v, email) => {
        if (v.registered) nowRegistered.push(email);
      });
      if (nowRegistered.length > 0) remember(nowRegistered);
    });
    tracker.current = t;
    return () => {
      t.stop();
      tracker.current = null;
    };
  }, [key, remember]);

  const info = useCallback(
    (email: string) => {
      const e = normEmail(email);
      const l = live.get(e);
      return {
        registered: l?.registered === true || seen[e] !== undefined,
        lastLoginAt: l?.lastLoginAt ?? null,
      };
    },
    [live, seen],
  );

  const refresh = useCallback(() => tracker.current?.refresh(), []);

  return { info, refresh };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchRegistration,
  normEmail,
  normalizeEmails,
  startRegistrationTracking,
  type InviteStatus,
  type RegistrationMap,
  type RegistrationTracker,
} from "@/lib/partner-registration";
import { useRegisteredPartnersStore } from "@/lib/store/registered-partners-store";

export interface PartnerRegistration {
  registered: boolean;
  status: InviteStatus;
  lastLoginAt: number | null;
}

/**
 * The decision for one email - pure, so it can be tested on its own.
 * The server's status wins. Otherwise: the live check, or this browser's memory
 * - but only memory from AFTER its latest invitation of that email.
 */
export function decideRegistration(
  email: string,
  live: RegistrationMap,
  seen: Readonly<Record<string, number>>,
  invitedAt: Readonly<Record<string, number>>,
): PartnerRegistration {
  const e = normEmail(email);
  const l = live.get(e);
  if (l?.fromServer) return { registered: l.registered, status: l.status, lastLoginAt: l.lastLoginAt };
  const seenAt = seen[e];
  const remembered = seenAt !== undefined && seenAt >= (invitedAt[e] ?? 0);
  const registered = l?.registered === true || remembered;
  return { registered, status: registered ? "registered" : "invited", lastLoginAt: l?.lastLoginAt ?? null };
}

/**
 * Where each invited person stands: "Invited", "Registered", or (when the
 * server says so) access "Removed".
 *
 *   const reg = usePartnerRegistration(["a@x.com", "b@y.com"]);
 *   reg.info("a@x.com")  ->  { registered, status, lastLoginAt }
 *
 * Checks now, every 30 s while the tab is visible, and when the tab regains
 * focus; `refresh()` checks immediately. When the server reports an invitation
 * status it is final. Otherwise this browser's memory is used - but only what it
 * learned AFTER its latest invitation of that email (a re-invite starts fresh).
 */
export function usePartnerRegistration(emails: readonly string[]) {
  const seen = useRegisteredPartnersStore((s) => s.seen);
  const invitedAt = useRegisteredPartnersStore((s) => s.invitedAt);
  const remember = useRegisteredPartnersStore((s) => s.remember);
  const [live, setLive] = useState<RegistrationMap>(() => new Map());
  const tracker = useRef<RegistrationTracker | null>(null);

  const key = useMemo(() => normalizeEmails(emails).join("|"), [emails]);

  useEffect(() => {
    if (!key) {
      setLive(new Map());
      return;
    }
    const t = startRegistrationTracking(
      key.split("|"),
      (map) => {
        setLive(map);
        // Memory is only needed when the server does not report the status.
        const nowRegistered: string[] = [];
        map.forEach((v, email) => {
          if (v.registered && !v.fromServer) nowRegistered.push(email);
        });
        if (nowRegistered.length > 0) remember(nowRegistered);
      },
      // Read the invite times at check time, so a new invite counts at once.
      { load: (list) => fetchRegistration(list, useRegisteredPartnersStore.getState().invitedAt) },
    );
    tracker.current = t;
    return () => {
      t.stop();
      tracker.current = null;
    };
  }, [key, remember]);

  const info = useCallback(
    (email: string): PartnerRegistration => decideRegistration(email, live, seen, invitedAt),
    [live, seen, invitedAt],
  );

  const refresh = useCallback(() => tracker.current?.refresh(), []);

  return { info, refresh };
}

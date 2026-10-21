"use client";

import { useEffect, useState } from "react";

// The time in EST (US Eastern Standard Time, UTC−5, all year round: no switch to EDT in summer), for
// the live strip, ticking once a second. null until the page has mounted, so the server's render and
// the browser's match.

// (IANA's "Etc/GMT+5" is UTC−5: the sign is inverted in these names)
const ZONE = "Etc/GMT+5";

export function useEasternTime(locale = "en-US") {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  if (!now) return null;
  // (the narrow space before AM/PM as a plain no-break space, which the rolling digits keep)
  return now
    .toLocaleTimeString(locale, { timeZone: ZONE, hour: "numeric", minute: "2-digit", second: "2-digit" })
    .replace(/\s/g, " ");
}

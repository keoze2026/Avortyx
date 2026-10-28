"use client";

/**
 * Avortyx Guard (CH-355): tells admins when the server is waiting for its
 * quiet-time restart, so nobody tests a change that is not live yet.
 *
 * Reads /api/guard/status (team only). Shows a slim line when:
 *  - changes are on the server but not running ("pending"), or
 *  - the server runs an older CH than this portal needs (PORTAL_NEEDS_SERVER),
 *    including a server too old to have /api/guard/status at all.
 * Admins only; hidden until the next visit when dismissed; checked again
 * every 10 minutes so it disappears by itself after the restart.
 */
import * as React from "react";
import { Hourglass, X } from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { ApiError } from "@/lib/api/errors";
import { http } from "@/lib/api/http";
import { PORTAL_NEEDS_SERVER } from "@/lib/server-version";
import { useAuthStore } from "@/lib/store/auth-store";

interface GuardStatus {
  restartNeeded: boolean;
  pending: string[];
  runningNumber: number;
  running: { ch: string; sha: string };
}

const EVERY_MS = 10 * 60 * 1000;
const HIDE_KEY = "avx.serverUpdateHidden";

export function ServerUpdateBanner() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [text, setText] = React.useState<string | null>(null);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    try {
      setHidden(window.sessionStorage.getItem(HIDE_KEY) === "1");
    } catch {
      // Storage blocked: the banner just shows.
    }
  }, []);

  React.useEffect(() => {
    if (role !== "admin") return;
    let alive = true;
    const need = `CH-${PORTAL_NEEDS_SERVER}`;
    const check = async () => {
      try {
        const s = await http.get<GuardStatus>("/api/guard/status");
        if (!alive) return;
        if (s.pending?.length) setText(t("x355.pending").replace("{list}", s.pending.join(", ")));
        else if (s.runningNumber && s.runningNumber < PORTAL_NEEDS_SERVER) setText(t("x355.old").replace("{need}", need));
        else setText(null);
      } catch (e) {
        if (!alive) return;
        // No such endpoint = a server from before CH-355 is still running.
        setText(e instanceof ApiError && e.status === 404 ? t("x355.old").replace("{need}", need) : null);
      }
    };
    void check();
    const id = window.setInterval(check, EVERY_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [role, t]);

  if (!text || hidden || role !== "admin") return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-4 py-1.5 text-xs text-foreground sm:px-6"
    >
      <Hourglass className="h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
      <span className="min-w-0 flex-1">{text}</span>
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          try {
            window.sessionStorage.setItem(HIDE_KEY, "1");
          } catch {
            // Hidden for this page view only.
          }
        }}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        aria-label={t("x355.dismiss")}
        title={t("x355.dismiss")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

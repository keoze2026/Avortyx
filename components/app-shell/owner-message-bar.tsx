"use client";

/**
 * CH-675: a message the platform owner sent to this account (Owner >
 * Organizations > Message client), across the top of the portal until this
 * login clicks Seen. Not for buyer or publisher logins. Backend:
 * /api/notifications/owner-messages.
 */

import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { formatLocalDateTime } from "@/lib/format";
import { readOwnerView } from "@/lib/owner-view";
import { useAuthStore } from "@/lib/store/auth-store";

interface OwnerMessages {
  unseenCount: number;
  messages: { id: string; at: string; from: string; text: string }[];
  newestAt: string | null;
}

const POLL_MS = 5 * 60_000;

export function OwnerMessageBar() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const [data, setData] = useState<OwnerMessages | null>(null);
  const [busy, setBusy] = useState(false);
  const partner = role === "buyer" || role === "publisher";

  const load = useCallback(() => {
    http
      .get<OwnerMessages>("/api/notifications/owner-messages")
      .then(setData)
      .catch(() => {
        /* a missing bar is better than an error on every page */
      });
  }, []);

  useEffect(() => {
    if (!signedIn || partner) return;
    load();
    const h = setInterval(load, POLL_MS);
    return () => clearInterval(h);
  }, [signedIn, partner, load]);

  if (!data || data.unseenCount === 0 || data.messages.length === 0 || partner) return null;
  // The owner's read-only view shows the bar as the client sees it, without Seen.
  const viewing = readOwnerView() != null;

  async function seen() {
    setBusy(true);
    try {
      setData(await http.post<OwnerMessages>("/api/notifications/owner-messages/seen", {
        body: { up_to: data?.newestAt },
      }));
    } catch {
      /* stays until the next try */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-accent/30 bg-accent/10 px-4 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {data.messages.map((m) => (
            <div key={m.id} className="flex items-start gap-2">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <span className="font-semibold">{t("x675.bar.from").replace("{name}", m.from)}</span>{" "}
                <span className="text-xs text-muted-foreground">{formatLocalDateTime(m.at)}</span>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
        {!viewing && (
          <Button size="sm" variant="outline" className="h-7 shrink-0" disabled={busy} onClick={seen}>
            {t("x675.bar.seen")}
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * Connect a buyer's daily report to Telegram through our own bot (CH-311,
 * backend CH-310). No chat ID to look up with a public bot: the portal makes
 * a link to our bot; opening it (or adding the bot to a group with it) saves
 * the chat by itself. The link works once, for 7 days.
 *
 *   admin:  "Send this link to the buyer"  - copy, or open it yourself
 *   buyer:  "Connect my Telegram"          - opens Telegram straight away
 *
 * While the box is open it asks the server every 5 seconds (for 10 minutes)
 * whether the chat has connected, and says so when it has.
 */

import * as React from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import { formatLocalDateTime } from "@/lib/format";

interface ConnectLink {
  bot: string;
  url: string;
  groupUrl: string;
  command: string;
  expiresAt: string;
}

const POLL_MS = 5000;
const POLL_FOR_MS = 10 * 60 * 1000;

export function TelegramConnect({
  linkEndpoint,
  checkConnected,
  onConnected,
  mode,
}: {
  /** POST endpoint that returns a new connect link. */
  linkEndpoint: string;
  /** Resolves true once the chat is connected (asked every 5 seconds). */
  checkConnected: () => Promise<boolean>;
  onConnected: () => void;
  /** "admin" sends the link to the buyer; "buyer" opens it straight away. */
  mode: "admin" | "buyer";
}) {
  const { t } = useTranslation();
  const [link, setLink] = React.useState<ConnectLink | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<"" | "url" | "group">("");
  const [waiting, setWaiting] = React.useState(false);

  // Wait for the chat to connect while a link is out.
  React.useEffect(() => {
    if (!link) return;
    let live = true;
    setWaiting(true);
    const until = Date.now() + POLL_FOR_MS;
    const tick = async () => {
      if (!live) return;
      try {
        if (await checkConnected()) {
          if (!live) return;
          setWaiting(false);
          setLink(null);
          toast.success(t("tgConnect.connected"));
          onConnected();
          return;
        }
      } catch {
        // try again on the next tick
      }
      if (Date.now() < until) timer = window.setTimeout(tick, POLL_MS);
      else if (live) setWaiting(false);
    };
    let timer = window.setTimeout(tick, POLL_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [link, checkConnected, onConnected, t]);

  const make = async () => {
    setBusy(true);
    try {
      const l = await http.post<ConnectLink>(linkEndpoint, {});
      if (!l.url) throw new Error("no bot");
      setLink(l);
      if (mode === "buyer") window.open(l.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof ApiError && e.message ? e.message : t("tgConnect.failed"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: "url" | "group") => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(what === "url" ? link.url : link.groupUrl);
      setCopied(what);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      toast.error(t("tgConnect.copyFailed"));
    }
  };

  if (!link) {
    return (
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={make} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        {mode === "buyer" ? t("tgConnect.connectMine") : t("tgConnect.makeLink")}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-accent/30 bg-accent/5 p-3 text-xs">
      <p className="text-foreground">
        {mode === "buyer" ? t("tgConnect.buyerHint") : t("tgConnect.adminHint")}
      </p>
      <div className="flex flex-wrap gap-2">
        {mode === "admin" && (
          <Button type="button" size="sm" className="h-7 gap-1 text-xs" onClick={() => copy("url")}>
            {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {t("tgConnect.copyPrivate")}
          </Button>
        )}
        {mode === "admin" && (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => copy("group")}>
            {copied === "group" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {t("tgConnect.copyGroup")}
          </Button>
        )}
        <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            {t("tgConnect.openPrivate")}
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
          <a href={link.groupUrl} target="_blank" rel="noopener noreferrer">
            <Users className="h-3.5 w-3.5" />
            {t("tgConnect.openGroup")}
          </a>
        </Button>
      </div>
      <p className="text-muted-foreground">
        {t("tgConnect.expires")
          .replace("{bot}", link.bot)
          .replace("{when}", formatLocalDateTime(link.expiresAt))}
      </p>
      {waiting && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("tgConnect.waiting")}
        </p>
      )}
    </div>
  );
}

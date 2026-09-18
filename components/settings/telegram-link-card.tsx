"use client";

/**
 * Profile › Connections › Telegram.
 *
 * A Telegram bot can only message a chat that has messaged it first, so
 * there is nothing useful a user could "type in" to connect — the link is
 * made from Telegram's side:
 *
 *   1. Connect → POST /api/accounts/me/telegram/link returns a one-time deep
 *      link (t.me/<bot>?start=<code>). We open it and start polling /me.
 *   2. The user presses Start; the bot receives `/start <code>` and stores
 *      the chat id on this account. /me then carries `telegram_chat_id`
 *      and the card flips to connected.
 *
 * Fallback: on a server without the link endpoint (404) the card offers a
 * Telegram-username field (PATCH /me { telegram_username }) so the team can
 * link the account by hand.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError } from "@/lib/api/http";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { authService, type TelegramLink } from "@/lib/api/services/auth.service";
import { useAuthStore } from "@/lib/store/auth-store";

const POLL_MS = 3_000;
const POLL_TIMEOUT_MS = 3 * 60_000;

export function TelegramLinkCard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const connected = Boolean(user?.telegram?.chatId);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [linkUnavailable, setLinkUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [username, setUsername] = useState(user?.telegram?.username ?? "");
  const [savingName, setSavingName] = useState(false);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    setUsername(user?.telegram?.username ?? "");
  }, [user?.telegram?.username]);

  // Poll /me while a link is open, until the bot has written the chat id.
  useEffect(() => {
    if (!waiting || connected) return;
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const fresh = await refreshUser();
        if (fresh?.telegram?.chatId) {
          setWaiting(false);
          setLink(null);
          toast.success(t("settings.profileSection.telegramLink.linked"));
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setWaiting(false);
        setTimedOut(true);
        return;
      }
      pollTimer.current = window.setTimeout(tick, POLL_MS);
    };
    pollTimer.current = window.setTimeout(tick, POLL_MS);
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
  }, [waiting, connected, refreshUser, t]);

  const onConnect = async () => {
    setBusy(true);
    setTimedOut(false);
    try {
      const l = await authService.telegramLink();
      setLink(l);
      setWaiting(true);
      window.open(l.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)) {
        setLinkUnavailable(true);
      } else {
        toast.error(friendlyErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    try {
      await authService.telegramUnlink();
      await refreshUser();
      setLink(null);
      toast.success(t("settings.profileSection.telegramLink.disconnected"));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onSaveUsername = async () => {
    setSavingName(true);
    try {
      await updateProfile({ telegramUsername: username });
      toast.success(t("settings.profileSection.telegramLink.saved"));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setSavingName(false);
    }
  };

  const tg = user?.telegram;
  const statusLine = connected
    ? tg?.username
      ? t("settings.profileSection.telegramLink.connectedAs").replace("{name}", `@${tg.username.replace(/^@/, "")}`)
      : t("settings.profileSection.telegramLink.connectedId").replace("{id}", tg?.chatId ?? "")
    : t("settings.profileSection.telegramDesc");

  const usernameDirty = username.replace(/^@/, "").trim() !== (user?.telegram?.username ?? "");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("settings.profileSection.connections")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                <Send className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {t("settings.profileSection.telegram")}
                  {connected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--success)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--success)]">
                      <Check className="h-2.5 w-2.5" />
                      {t("settings.profileSection.connected")}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{statusLine}</div>
              </div>
            </div>
            <div className="shrink-0">
              {connected ? (
                <Button variant="outline" size="sm" onClick={onDisconnect} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("settings.profileSection.disconnect")}
                </Button>
              ) : (
                !linkUnavailable && (
                  <Button size="sm" onClick={onConnect} disabled={busy || waiting}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {t("settings.profileSection.connect")}
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Deep link in progress */}
          {!connected && link && (
            <div className="mt-4 rounded-md border border-accent/30 bg-accent/5 p-3 text-xs">
              <p className="text-foreground">{t("settings.profileSection.telegramLink.intro")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button asChild size="sm">
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {t("settings.profileSection.telegramLink.openTelegram")}
                  </a>
                </Button>
                {waiting ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("settings.profileSection.telegramLink.waiting")}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTimedOut(false);
                      setWaiting(true);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("settings.profileSection.telegramLink.checkNow")}
                  </Button>
                )}
              </div>
              {link.code && (
                <p className="mt-3 text-muted-foreground">
                  {t("settings.profileSection.telegramLink.code")}:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{link.code}</code>
                  <span className="ml-2">
                    {t("settings.profileSection.telegramLink.codeHint").replace("{code}", link.code)}
                  </span>
                </p>
              )}
              {timedOut && (
                <p className="mt-2 text-[color:var(--warning)]">{t("settings.profileSection.telegramLink.timeout")}</p>
              )}
            </div>
          )}

          {/* Manual username — always offered; the only path when the server
              has no link endpoint. */}
          {!connected && (
            <div className="mt-4 space-y-2">
              {linkUnavailable && (
                <p className="text-xs text-[color:var(--warning)]">
                  {t("settings.profileSection.telegramLink.linkUnavailable")}
                </p>
              )}
              <Label htmlFor="telegram-username" className="text-xs">
                {t("settings.profileSection.telegramLink.manualLabel")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="telegram-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("settings.profileSection.telegramLink.manualPlaceholder")}
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={onSaveUsername}
                  disabled={savingName || !usernameDirty}
                >
                  {savingName && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("settings.profileSection.telegramLink.save")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("settings.profileSection.telegramLink.manualHint")}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

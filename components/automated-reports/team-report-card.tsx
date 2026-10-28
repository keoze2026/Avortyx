"use client";

/**
 * Team report on Telegram, from our own reports bot (CH-347, Sir 28 Oct:
 * "an in-house automated reporting bot that gets its own Telegram ID to send
 * automated reports").
 *
 * Press Connect Telegram, then Start in the bot (or add it to a group): the
 * bot saves the chat by itself - nobody looks up a chat ID. Every connected
 * chat gets the previous day's summary and an Excel file (by campaign,
 * publisher and buyer) at its own time, Eastern. Workspace admins only; the
 * card hides itself for everyone else.
 */
import * as React from "react";
import { Bot, Loader2, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError, friendlyErrorMessage } from "@/lib/api/errors";
import { http } from "@/lib/api/http";
import { formatLocalDateTime } from "@/lib/format";

interface TeamChat {
  id: string;
  chatId: string;
  title: string;
  kind: string;
  enabled: boolean;
  sendTime: string;
  connectedAt: string;
  connectedBy: string;
  lastSentAt: string | null;
  lastResult: string;
}

interface Overview {
  configured: boolean;
  bot: string;
  chats: TeamChat[];
}

interface ConnectLink {
  bot: string;
  url: string;
  groupUrl: string;
  command: string;
  expiresAt: string;
}

const POLL_MS = 3_000;

export function TeamReportCard() {
  const { t } = useTranslation();
  const [data, setData] = React.useState<Overview | null>(null);
  const [hidden, setHidden] = React.useState(false);
  const [link, setLink] = React.useState<ConnectLink | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setData(await http.get<Overview>("/api/team-report/"));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setHidden(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // While a connect link is open, look for the new chat every few seconds,
  // so it appears here the moment Start is pressed in Telegram.
  React.useEffect(() => {
    if (!link) return;
    const before = data?.chats.length ?? 0;
    const id = window.setInterval(async () => {
      try {
        const next = await http.get<Overview>("/api/team-report/");
        setData(next);
        if (next.chats.length > before) {
          setLink(null);
          toast.success(t("x347.connected"));
        }
      } catch {
        // Tried again on the next tick.
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  const connect = async () => {
    setBusy("connect");
    try {
      setLink(await http.post<ConnectLink>("/api/team-report/connect-link"));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const update = async (chat: TeamChat, body: Partial<Pick<TeamChat, "enabled" | "sendTime">>) => {
    setBusy(chat.id);
    try {
      const next = await http.patch<TeamChat>(`/api/team-report/chats/${chat.id}`, { body });
      setData((d) => (d ? { ...d, chats: d.chats.map((c) => (c.id === chat.id ? next : c)) } : d));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async (chat: TeamChat) => {
    setBusy(chat.id);
    try {
      await http.post(`/api/team-report/chats/${chat.id}/send-test`);
      toast.success(t("x347.testSent").replace("{chat}", chat.title));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (chat: TeamChat) => {
    if (!window.confirm(t("x347.removeConfirm").replace("{chat}", chat.title))) return;
    setBusy(chat.id);
    try {
      await http.delete(`/api/team-report/chats/${chat.id}`);
      setData((d) => (d ? { ...d, chats: d.chats.filter((c) => c.id !== chat.id) } : d));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (hidden) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Bot className="h-4 w-4 text-accent" />
              {t("x347.title")}
              {data?.bot && <span className="text-xs font-normal text-muted-foreground">{data.bot}</span>}
            </div>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{t("x347.subtitle")}</p>
          </div>
          <Button size="sm" onClick={() => void connect()} disabled={!data?.configured || busy === "connect"}>
            {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("x347.connect")}
          </Button>
        </div>

        {data && !data.configured && (
          <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">{t("x347.notConfigured")}</p>
        )}

        {link && (
          <div className="space-y-3 border-t border-border bg-muted/20 px-5 py-4 text-sm">
            <p>{t("x347.linkHelp").replace("{bot}", link.bot)}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={link.url} target="_blank" rel="noreferrer">
                  <Send className="h-4 w-4" /> {t("x347.openChat")}
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={link.groupUrl} target="_blank" rel="noreferrer">
                  <Users className="h-4 w-4" /> {t("x347.addGroup")}
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
                {t("x347.close")}
              </Button>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("x347.waiting")}
            </p>
          </div>
        )}

        {data && data.configured && (
          <div className="overflow-x-auto border-t border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-left">{t("x347.col.chat")}</TableHead>
                  <TableHead className="text-center">{t("x347.col.on")}</TableHead>
                  <TableHead className="text-center">{t("x347.col.time")}</TableHead>
                  <TableHead className="text-center">{t("x347.col.lastSent")}</TableHead>
                  <TableHead className="text-right">{t("x347.col.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.chats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-left">
                      <div className="font-medium">{c.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.kind === "private" ? t("x347.kind.private") : t("x347.kind.group")}
                        {c.connectedBy ? ` · ${t("x347.connectedBy").replace("{name}", c.connectedBy)}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.enabled}
                        disabled={busy === c.id}
                        onCheckedChange={(v) => void update(c, { enabled: v })}
                        aria-label={t("x347.col.on")}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <Input
                          type="time"
                          step={900}
                          defaultValue={c.sendTime}
                          className="h-8 w-[110px] text-xs"
                          disabled={busy === c.id}
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v && v !== c.sendTime) void update(c, { sendTime: v });
                          }}
                        />
                        <span className="text-[11px] text-muted-foreground">EST</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground" title={c.lastResult}>
                      {c.lastSentAt ? formatLocalDateTime(c.lastSentAt) : "—"}
                      {c.lastResult.startsWith("Not sent") && (
                        <Badge variant="warning" className="ml-1.5">
                          {t("x347.failed")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => void sendTest(c)}>
                          {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          {t("x347.sendTest")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === c.id}
                          onClick={() => void remove(c)}
                          aria-label={t("x347.remove")}
                          title={t("x347.remove")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data.chats.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      {t("x347.none")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

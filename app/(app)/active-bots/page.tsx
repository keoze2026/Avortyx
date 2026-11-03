"use client";

/**
 * Active Bots (CH-477, Sir 3 Nov): "where team can see each buyer's unique
 * API". Every buyer of the workspace, its API login, whether its key works,
 * when it was issued and last used, and two actions:
 *   - Issue new key: the old key stops working and the new one is shown once,
 *     in full, with a Copy button. It is stored as a hash on the server, so it
 *     can never be shown again; the table shows only its first characters.
 *   - Switch off: the buyer's key stops working at once.
 * The workspace's main account only, as every API key (CH-243); the backend
 * (/api/active-bots/) refuses everyone else.
 */

import * as React from "react";
import { Copy, KeyRound, Loader2, Power } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { ApiError, friendlyErrorMessage } from "@/lib/api/errors";
import { formatLocalDateTime } from "@/lib/format";
import { LocalName } from "@/lib/i18n/local-name";

type Status = "active" | "off" | "none";

interface Bot {
  buyerId: string;
  buyerName: string;
  buyerStatus: string;
  loginEmail: string;
  loginExists: boolean;
  status: Status;
  keyPrefix: string | null;
  issuedAt: string | null;
  lastUsedAt: string | null;
  /** CH-490: the live key can be copied again (issued here after CH-490). */
  copyable?: boolean;
}

interface Payload {
  items: Bot[];
  counts: Record<Status, number>;
}

interface Issued {
  buyerName: string;
  loginEmail: string;
  key: string;
  /** CH-490: shown from "Copy key" rather than just issued. */
  copied?: boolean;
}

const STATUS_VARIANT: Record<Status, React.ComponentProps<typeof Badge>["variant"]> = {
  active: "success",
  off: "secondary",
  none: "outline",
};

type Confirm = { bot: Bot; action: "issue" | "off" } | null;

export default function ActiveBotsPage() {
  const { t } = useTranslation();
  const [data, setData] = React.useState<Payload | null>(null);
  const [denied, setDenied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<Issued | null>(null);

  const load = React.useCallback(() => {
    http
      .get<Payload>("/api/active-bots/")
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) setDenied(true);
        else setError(friendlyErrorMessage(e, t("activeBots.loadError")));
      });
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  // CH-490: the live key again, in full, to copy. Logged on the server.
  const copyKey = async (b: Bot) => {
    setBusy(b.buyerId);
    try {
      const r = await http.post<Issued>(`/api/active-bots/${b.buyerId}/copy`);
      setIssued({ buyerName: r.buyerName, loginEmail: r.loginEmail, key: r.key, copied: true });
      navigator.clipboard?.writeText(r.key).then(() => toast.success(t("activeBots.copied"))).catch(() => undefined);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("activeBots.actionFailed")));
    } finally {
      setBusy(null);
    }
  };

  const run = async (c: NonNullable<Confirm>) => {
    setConfirm(null);
    setBusy(c.bot.buyerId);
    try {
      if (c.action === "issue") {
        const r = await http.post<Issued>(`/api/active-bots/${c.bot.buyerId}/issue`);
        setIssued({ buyerName: r.buyerName, loginEmail: r.loginEmail, key: r.key });
      } else {
        await http.post(`/api/active-bots/${c.bot.buyerId}/switch-off`);
        toast.success(t("activeBots.switchedOff").replace("{buyer}", c.bot.buyerName));
      }
      load();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("activeBots.actionFailed")));
    } finally {
      setBusy(null);
    }
  };

  const q = query.trim().toLowerCase();
  const rows = (data?.items ?? []).filter(
    (b) =>
      (showAll || q !== "" || b.status !== "none") &&
      (q === "" || b.buyerName.toLowerCase().includes(q) || b.loginEmail.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("activeBots.title")} description={t("activeBots.subline")} className="pb-0" />

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex flex-col">
              <span className="text-base font-semibold">{t("activeBots.listTitle")}</span>
              {data && (
                <span className="text-xs text-muted-foreground">
                  {t("activeBots.counts")
                    .replace("{active}", String(data.counts.active))
                    .replace("{off}", String(data.counts.off))
                    .replace("{none}", String(data.counts.none))}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("activeBots.search")}
                className="h-8 w-48"
              />
              <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t("activeBots.onlyWithApi") : t("activeBots.showAll")}
              </Button>
            </div>
          </div>

          {denied ? (
            <p className="border-t border-border px-5 py-6 text-sm text-muted-foreground">{t("activeBots.mainOnly")}</p>
          ) : error ? (
            <p className="border-t border-border px-5 py-6 text-sm text-destructive">{error}</p>
          ) : !data ? (
            <div className="space-y-2 border-t border-border p-5">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("activeBots.col.buyer")}</TableHead>
                    <TableHead>{t("activeBots.col.login")}</TableHead>
                    <TableHead>{t("activeBots.col.key")}</TableHead>
                    <TableHead className="text-center">{t("activeBots.col.status")}</TableHead>
                    <TableHead className="text-center">{t("activeBots.col.issued")}</TableHead>
                    <TableHead className="text-center">{t("activeBots.col.lastUsed")}</TableHead>
                    <TableHead className="text-right">{t("activeBots.col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((b) => (
                    <TableRow key={b.buyerId}>
                      <TableCell className="font-medium"><LocalName name={b.buyerName} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {b.loginExists ? b.loginEmail : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{b.keyPrefix ? `${b.keyPrefix}…` : "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={STATUS_VARIANT[b.status]}>{t(`activeBots.status.${b.status}`)}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {b.issuedAt ? formatLocalDateTime(b.issuedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {b.lastUsedAt ? formatLocalDateTime(b.lastUsedAt) : t("activeBots.never")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() => setConfirm({ bot: b, action: "issue" })}
                          >
                            {busy === b.buyerId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                            {t("activeBots.issue")}
                          </Button>
                          {b.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null || !b.copyable}
                              title={b.copyable ? undefined : t("x490.notCopyable")}
                              onClick={() => void copyKey(b)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {t("activeBots.copy")}
                            </Button>
                          )}
                          {b.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              disabled={busy !== null}
                              onClick={() => setConfirm({ bot: b, action: "off" })}
                            >
                              <Power className="h-3.5 w-3.5" />
                              {t("activeBots.switchOff")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                        {t("activeBots.none")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(confirm?.action === "off" ? t("activeBots.confirmOffTitle") : t("activeBots.confirmIssueTitle")).replace(
                "{buyer}",
                confirm?.bot.buyerName ?? "",
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "off"
                ? t("activeBots.confirmOffBody")
                : confirm?.bot.status === "active"
                  ? t("activeBots.confirmReplaceBody")
                  : t("activeBots.confirmIssueBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("activeBots.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && void run(confirm)}>
              {confirm?.action === "off" ? t("activeBots.switchOff") : t("activeBots.issue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(issued?.copied ? "x490.copiedTitle" : "activeBots.issuedTitle").replace("{buyer}", issued?.buyerName ?? "")}
            </DialogTitle>
            <DialogDescription>{t(issued?.copied ? "x490.copiedBody" : "x490.issuedBody")}</DialogDescription>
          </DialogHeader>
          {issued && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
                <code className="break-all font-mono text-sm">{issued.key}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("activeBots.copy")}
                  onClick={() =>
                    navigator.clipboard?.writeText(issued.key).then(() => toast.success(t("activeBots.copied")))
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("activeBots.issuedLogin").replace("{login}", issued.loginEmail)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIssued(null)}>{t("activeBots.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

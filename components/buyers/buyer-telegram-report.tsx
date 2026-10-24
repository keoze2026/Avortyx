"use client";

/**
 * Buyer > Settings > Telegram Report (CH-258, Sir 24 Oct).
 *
 * The buyer's own daily report: at its send time (Eastern) the platform builds
 * one Excel file per destination - that destination's calls - and sends each to
 * the buyer's Telegram chat. The buyer's choices apply to every report: no
 * recording links, connected calls only, no Fail Reason column, its own column
 * headings, and its own wording for comments. Comment wording changes words,
 * never what happened: the backend refuses wording that says a call connected.
 *
 * Admin only (the backend answers 403 to anyone else; the card then hides).
 * Backend: /api/buyers/{id}/telegram-report (buyers/telegram_report.py).
 */

import * as React from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import type { Buyer } from "@/lib/types";

interface Pair {
  from: string;
  to: string;
}

interface Settings {
  enabled: boolean;
  chatId: string;
  sendTime: string;
  noRecordingLink: boolean;
  connectedOnly: boolean;
  hideFailReason: boolean;
  columnNames: { key: string; label: string }[];
  commentRewrites: Pair[];
  columns: { key: string; label: string }[];
  /** The columns in the files (CH-267): every column a buyer's client may see. */
  includedColumns: string[];
  lastSentAt: string | null;
  lastResult: string;
  /** The buyer's own approval (CH-259): nothing is sent until it is given. */
  buyerApproved: boolean;
  buyerApprovedAt: string | null;
  buyerApprovedBy: string;
}

/** The comments a call can carry, offered as the "from" side of a rewrite. */
const COMMENTS = [
  "No Destination",
  "Not Connected",
  "Overflow Missed",
  "Duplicate Call",
  "Callerid Blocked",
  "Insufficient Funds",
];

function errText(e: unknown, fallback: string): string {
  return e instanceof ApiError && e.message ? e.message : fallback;
}

export function BuyerTelegramReport({ buyer }: { buyer: Buyer }) {
  const { t } = useTranslation();
  const url = `/api/buyers/${buyer.id}/telegram-report`;
  const [s, setS] = React.useState<Settings | null>(null);
  const [hidden, setHidden] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    http
      .get<Settings>(url)
      .then((r) => live && setS(r))
      .catch((e) => {
        // Not an admin: the section is not theirs.
        if (live && e instanceof ApiError && e.status === 403) setHidden(true);
      });
    return () => {
      live = false;
    };
  }, [url]);

  if (hidden) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));
    setDirty(true);
  };

  const heading = (key: string) => s?.columnNames.find((c) => c.key === key)?.label ?? "";
  const setHeading = (key: string, label: string) => {
    if (!s) return;
    const rest = s.columnNames.filter((c) => c.key !== key);
    set("columnNames", label ? [...rest, { key, label }] : rest);
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      const r = await http.patch<Settings>(url, {
        body: {
          enabled: s.enabled,
          chatId: s.chatId.trim(),
          sendTime: s.sendTime,
          noRecordingLink: s.noRecordingLink,
          connectedOnly: s.connectedOnly,
          hideFailReason: s.hideFailReason,
          columnNames: s.columnNames,
          includedColumns: s.includedColumns,
          commentRewrites: s.commentRewrites.filter((p) => p.from.trim()),
        },
      });
      setS(r);
      setDirty(false);
      toast.success(t("buyerReport.saved"));
    } catch (e) {
      toast.error(errText(e, t("buyerReport.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const r = await http.post<Settings>(`${url}/send`, {});
      setS(r);
      toast.success(t("buyerReport.sent"));
    } catch (e) {
      toast.error(errText(e, t("buyerReport.sendFailed")));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Send className="h-4 w-4 text-accent" />
            {t("buyerReport.title")}
          </span>
          {s && (
            <Switch
              checked={s.enabled}
              onCheckedChange={(v) => set("enabled", v)}
              aria-label={t("buyerReport.enabled")}
            />
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("buyerReport.description")}</p>
      </CardHeader>

      {!s ? (
        <CardContent className="py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t("buyerReport.loading")}
        </CardContent>
      ) : (
        <CardContent className="space-y-5">
          {/* Sir, 25 Oct: reports go out only to a buyer whose own account
              approved them; the buyer turns it on or off in its Settings. */}
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              s.buyerApproved ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"
            }`}
          >
            {s.buyerApproved
              ? t("buyerReport.approvedBy")
                  .replace("{who}", s.buyerApprovedBy || t("buyerReport.theBuyer"))
                  .replace("{when}", s.buyerApprovedAt ? new Date(s.buyerApprovedAt).toLocaleDateString() : "")
              : t("buyerReport.waitingApproval")}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="br-chat">{t("buyerReport.chatId")}</Label>
              <Input
                id="br-chat"
                className="font-mono"
                placeholder="123456789"
                value={s.chatId}
                onChange={(e) => set("chatId", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">{t("buyerReport.chatIdHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="br-time">{t("buyerReport.sendTime")}</Label>
              <Input
                id="br-time"
                type="time"
                value={s.sendTime}
                onChange={(e) => set("sendTime", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">{t("buyerReport.sendTimeHint")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("buyerReport.options")}
            </div>
            {(
              [
                ["noRecordingLink", "buyerReport.noRecordingLink"],
                ["connectedOnly", "buyerReport.connectedOnly"],
                ["hideFailReason", "buyerReport.hideFailReason"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={s[key]} onCheckedChange={(v) => set(key, v === true)} />
                {t(label)}
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("buyerReport.headings")}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* Every column a buyer's client may see (CH-267): tick it in,
                  and rename it if wanted. */}
              {s.columns
                .filter((c) => !(c.key === "recording" && s.noRecordingLink))
                .filter((c) => !(c.key === "failReason" || c.key === "fail_reason") || !s.hideFailReason)
                .map((c) => {
                  const on = s.includedColumns.includes(c.key);
                  return (
                    <div key={c.key} className="flex items-center gap-2">
                      <Checkbox
                        checked={on}
                        onCheckedChange={() =>
                          set(
                            "includedColumns",
                            on
                              ? s.includedColumns.filter((k) => k !== c.key)
                              : s.columns.map((x) => x.key).filter((k) => k === c.key || s.includedColumns.includes(k)),
                          )
                        }
                        aria-label={c.label}
                      />
                      <span className="w-28 shrink-0 text-xs text-muted-foreground">{c.label}</span>
                      <Input
                        className="h-8"
                        placeholder={c.label}
                        disabled={!on}
                        value={heading(c.key)}
                        onChange={(e) => setHeading(c.key, e.target.value)}
                      />
                    </div>
                  );
                })}
            </div>
          </div>

          {!s.hideFailReason && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("buyerReport.wording")}
              </div>
              <p className="text-[11px] text-muted-foreground">{t("buyerReport.wordingHint")}</p>
              {s.commentRewrites.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={p.from}
                    onChange={(e) =>
                      set("commentRewrites", s.commentRewrites.map((q, j) => (j === i ? { ...q, from: e.target.value } : q)))
                    }
                    className="h-8 w-44 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    <option value="">{t("buyerReport.pickComment")}</option>
                    {COMMENTS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">→</span>
                  <Input
                    className="h-8"
                    value={p.to}
                    placeholder={t("buyerReport.newWording")}
                    onChange={(e) =>
                      set("commentRewrites", s.commentRewrites.map((q, j) => (j === i ? { ...q, to: e.target.value } : q)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => set("commentRewrites", s.commentRewrites.filter((_, j) => j !== i))}
                    aria-label={t("buyerReport.remove")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => set("commentRewrites", [...s.commentRewrites, { from: "", to: "" }])}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("buyerReport.addWording")}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {s.lastResult
                ? `${t("buyerReport.last")}: ${s.lastResult}${s.lastSentAt ? ` · ${new Date(s.lastSentAt).toLocaleString()}` : ""}`
                : t("buyerReport.neverSent")}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={sendNow} disabled={sending || dirty || !s.chatId || !s.buyerApproved}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("buyerReport.sendNow")}
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("buyerReport.save")}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

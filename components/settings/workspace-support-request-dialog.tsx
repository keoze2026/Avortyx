"use client";

/**
 * Workspace danger-zone "Contact support" dialog.
 *
 * The Transfer-ownership and Delete-workspace flows are locked behind a
 * support hand-off so attackers can't perform them silently after a
 * compromised account / fresh KYC. This dialog gathers a short reason and
 * creates a real support session via POST /api/support/chat — the admin
 * team sees a Telegram ping with the request and reaches back out by email.
 *
 * Replaces the previous "toast.success(supportRequested)" placeholder,
 * which only pretended to file a ticket.
 */

import { useEffect, useState } from "react";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { supportService } from "@/lib/api/services/support.service";
import { tFor } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";
import { useLocaleStore } from "@/lib/store/locale-store";

export type SupportTopic = "transfer-ownership" | "delete-workspace";

const TOPIC_INTRO: Record<SupportTopic, string> = {
  "transfer-ownership":
    "I would like to transfer ownership of my workspace. Please walk me through the verification steps.",
  "delete-workspace":
    "I would like to delete my workspace. Please confirm the consequences and walk me through the verification steps.",
};

/** The pre-filled message, in the language chosen when the dialog opens. */
const TOPIC_INTRO_KEY: Record<SupportTopic, string> = {
  "transfer-ownership": "x5.supportRequest.introTransfer",
  "delete-workspace": "x5.supportRequest.introDelete",
};

/** Dialog title on screen. TOPIC_LABEL stays English: it tags the message the support team reads. */
const TOPIC_TITLE_KEY: Record<SupportTopic, string> = {
  "transfer-ownership": "workspaceUI.danger.transferTitle",
  "delete-workspace": "workspaceUI.danger.deleteTitle",
};

const TOPIC_LABEL: Record<SupportTopic, string> = {
  "transfer-ownership": "Transfer ownership",
  "delete-workspace": "Delete workspace",
};

interface Props {
  topic: SupportTopic | null;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceSupportRequestDialog({ topic, onOpenChange }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!topic) return;
    setMessage(tFor(useLocaleStore.getState().locale, TOPIC_INTRO_KEY[topic]) || TOPIC_INTRO[topic]);
    setSubmitting(false);
  }, [topic]);

  const onSubmit = async () => {
    if (!topic || !user) return;
    const trimmed = message.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const result = await supportService.startChat({
        name: user.name,
        email: user.email,
        message: `[${TOPIC_LABEL[topic]}] ${trimmed}`,
      });
      toast.success(t("x5.supportRequest.opened"), {
        description: result.sessionId
          ? t("x5.supportRequest.reference").replace("{id}", result.sessionId)
          : t("x5.supportRequest.replyByEmail"),
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("x5.supportRequest.openFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  const open = !!topic;
  const title = topic ? t(TOPIC_TITLE_KEY[topic]) : "";
  const descParts = t("x5.supportRequest.description").split("{email}");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {descParts[0]}
                <span className="font-mono text-foreground">
                  {user?.email ?? t("x5.supportRequest.emailOnFile")}
                </span>
                {descParts[1]}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ws-support-message">{t("x5.supportRequest.messageLabel")}</Label>
            <Textarea
              id="ws-support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              {t("x5.supportRequest.messageHint")}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Mail className="h-3 w-3" />
            {t("x5.supportRequest.replyHint")}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onSubmit} disabled={submitting || !message.trim() || !user}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("workspaceUI.invite.sending")}
                </>
              ) : (
                t("x5.supportRequest.send")
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

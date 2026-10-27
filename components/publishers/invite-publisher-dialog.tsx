"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { useLocalName } from "@/lib/i18n/local-name";
import { ROUTES } from "@/lib/constants";
import { usePublishersStore } from "@/lib/store/publishers-store";

export function InvitePublisherDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const router = useRouter();
  const add = usePublishersStore((s) => s.add);

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [payoutRate, setPayoutRate] = useState(65);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(""); setContactName(""); setEmail("");
    setPayoutRate(65); setDescription(""); setSubmitting(false);
  };
  const onClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 350));
    // `organization` is read-only — backend fills it from the workspace
    // context and echoes it via `organization_name` on the response.
    const created = await add({
      name: name.trim(),
      organization: "",
      contactName: contactName.trim() || undefined,
      email: email.trim() || undefined,
      description: description.trim() || undefined,
      status: "pending",
      payoutRate: payoutRate / 100,
      callsToday: 0,
      callsMonth: 0,
      revenueToday: 0,
      revenueMonth: 0,
      lifetimeRevenue: 0,
      pendingPayout: 0,
      conversionRate: 0,
      numbersAssigned: 0,
      campaignIds: [],
    });
    toast.success(t("networkUI.publishers.invite.invited").replace("{name}", localName(created.name)), {
      description: t("networkUI.publishers.invite.willAppear"),
    });
    onClose(false);
    router.push(`${ROUTES.publishers}/${created.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.65_0.18_290)]/15 text-[oklch(0.55_0.2_290)] dark:text-[oklch(0.72_0.2_290)]">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("networkUI.publishers.invite.title")}</DialogTitle>
              <DialogDescription>{t("networkUI.publishers.invite.description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="ip-name">{t("networkUI.publishers.invite.publisherName")}</Label>
            <Input id="ip-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("networkUI.publishers.invite.namePh")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ip-contact">{t("networkUI.publishers.invite.contactName")}</Label>
              <Input id="ip-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t("networkUI.publishers.invite.contactPh")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip-email">{t("networkUI.publishers.invite.email")}</Label>
              <Input id="ip-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("networkUI.publishers.invite.emailPh")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip-rate">{t("networkUI.publishers.invite.payoutRate")}</Label>
            <Input
              id="ip-rate"
              type="number"
              min={0}
              max={100}
              value={payoutRate}
              onChange={(e) =>
                setPayoutRate(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))
              }
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              {t("networkUI.publishers.invite.payoutHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip-desc">{t("networkUI.publishers.invite.notes")}</Label>
            <Textarea
              id="ip-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("networkUI.publishers.invite.notesPh")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            {t("networkUI.publishers.invite.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !name.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("networkUI.publishers.invite.sending")}
              </>
            ) : (
              t("networkUI.publishers.invite.send")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

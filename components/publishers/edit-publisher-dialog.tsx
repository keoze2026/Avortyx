"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

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
import { usePublishersStore } from "@/lib/store/publishers-store";

interface EditPublisherDialogProps {
  /** The publisher to edit. `null` keeps the dialog closed. */
  publisherId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function EditPublisherDialog({ publisherId, onOpenChange }: EditPublisherDialogProps) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const publishers = usePublishersStore((s) => s.publishers);
  const update = usePublishersStore((s) => s.update);

  const publisher = publisherId ? publishers.find((p) => p.id === publisherId) : null;

  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [payoutRate, setPayoutRate] = useState(65);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync local form state when a new publisher is selected
  useEffect(() => {
    if (!publisher) return;
    setName(publisher.name);
    setOrganization(publisher.organization);
    setContactName(publisher.contactName ?? "");
    setEmail(publisher.email ?? "");
    setPayoutRate(Math.round(publisher.payoutRate * 100));
    setDescription(publisher.description ?? "");
  }, [publisher]);

  const onSubmit = async () => {
    if (!publisher || !name.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 250));
    // `organization` is intentionally omitted — backend treats it as
    // read-only (`organization_name` echo). Sending it would 422.
    update(publisher.id, {
      name: name.trim(),
      contactName: contactName.trim() || undefined,
      email: email.trim() || undefined,
      description: description.trim() || undefined,
      payoutRate: payoutRate / 100,
    });
    setSubmitting(false);
    toast.success(t("networkUI.publishers.edit.updated").replace("{name}", localName(name.trim())));
    onOpenChange(false);
  };

  return (
    <Dialog open={!!publisher} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Pencil className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("networkUI.publishers.edit.title")}</DialogTitle>
              <DialogDescription>{t("networkUI.publishers.edit.description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ep-name">{t("networkUI.publishers.edit.publisherName")}</Label>
              <Input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-org">{t("networkUI.publishers.edit.organization")}</Label>
              {/* Read-only — backend's `organization_name` echo. */}
              <Input
                id="ep-org"
                value={organization}
                disabled
                readOnly
                aria-readonly
                className="cursor-not-allowed opacity-70"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ep-contact">{t("networkUI.publishers.edit.contactName")}</Label>
              <Input
                id="ep-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-email">{t("networkUI.publishers.edit.email")}</Label>
              <Input
                id="ep-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-rate">{t("networkUI.publishers.edit.payoutRate")}</Label>
            <Input
              id="ep-rate"
              type="number"
              min={0}
              max={100}
              value={payoutRate}
              onChange={(e) =>
                setPayoutRate(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))
              }
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {t("networkUI.publishers.edit.payoutHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ep-desc">{t("networkUI.publishers.edit.notes")}</Label>
            <Textarea
              id="ep-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("networkUI.publishers.edit.notesPh")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("networkUI.publishers.edit.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !name.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("networkUI.publishers.edit.saving")}
              </>
            ) : (
              t("networkUI.publishers.edit.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

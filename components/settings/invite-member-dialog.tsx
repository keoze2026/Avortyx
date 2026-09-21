"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INTERNAL_ROLES_IN_ORDER } from "@/lib/mock/settings";
import type { MemberRole } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (input: { name: string; email: string; role: MemberRole }) => void;
}

export function InviteMemberDialog({ open, onOpenChange, onInvite }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("manager");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(""); setEmail(""); setRole("manager"); setSubmitting(false);
  };

  const onClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  };

  // Normalised address: trimmed, lower-cased. Anything that still isn't a
  // plausible address (inner spaces, no @, no domain) is refused here — the
  // backend now rejects those too, but a member that was created from
  // "x example@mail.com" could never receive an invite, so stop it early.
  const address = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

  const onSubmit = async () => {
    if (!name.trim() || !address) return;
    if (!emailValid) {
      toast.error(t("workspaceUI.invite.invalidEmail"));
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 300));
    onInvite({ name: name.trim(), email: address, role });
    toast.success(t("workspaceUI.invite.toastTitle").replace("{email}", address), {
      description: t("workspaceUI.invite.toastDescription").replace("{role}", t(`workspaceUI.members.role.${role}`)),
    });
    onClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <UserPlus className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{t("workspaceUI.invite.title")}</DialogTitle>
              <DialogDescription>{t("workspaceUI.invite.description")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="im-name">{t("workspaceUI.invite.nameLabel")}</Label>
              <Input id="im-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="im-email">{t("workspaceUI.invite.emailLabel")}</Label>
              <Input
                id="im-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={address.length > 0 && !emailValid}
                className={cn(address.length > 0 && !emailValid && "border-destructive")}
              />
              {address.length > 0 && !emailValid && (
                <p className="text-xs text-destructive">{t("workspaceUI.invite.invalidEmail")}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("workspaceUI.invite.roleLabel")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERNAL_ROLES_IN_ORDER.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`workspaceUI.members.role.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">{t(`workspaceUI.roles.descriptions.${role}`)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>
            {t("workspaceUI.invite.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !name.trim() || !address}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("workspaceUI.invite.sending")}
              </>
            ) : (
              t("workspaceUI.invite.send")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

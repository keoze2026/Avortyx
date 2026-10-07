"use client";

/**
 * Buyer invite dialog — sends a setup-link email to the buyer's contact so
 * they can sign in to the platform. Triggered from the buyer detail page,
 * AFTER the buyer record has been created via the create-buyer flow.
 *
 * Backend endpoint not shipped yet — this dialog captures the email +
 * optional message, then attempts `POST /api/buyers/{id}/invite/` (see
 * BACKEND-CONTRACT.md §3.7 invite action). Until that endpoint exists,
 * submitting surfaces a friendly error so the operator knows it's queued
 * but not actually delivered.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

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
import { http } from "@/lib/api/http";
import { useBuyerMembersStore } from "@/lib/store/buyer-members-store";
import { markInvited } from "@/lib/partner-access";
import { friendlyErrorMessage } from "@/lib/api/errors";
import type { Buyer } from "@/lib/types";

interface BuyerInviteDialogProps {
  buyer: Buyer | null;
  onOpenChange: (open: boolean) => void;
}

export function BuyerInviteDialog({ buyer, onOpenChange }: BuyerInviteDialogProps) {
  const open = buyer !== null;
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from buyer record whenever the dialog opens against a new buyer.
  useEffect(() => {
    if (!buyer) return;
    setEmail(buyer.email ?? "");
    setContactName(buyer.contactName ?? "");
    setMessage("");
    setSubmitting(false);
  }, [buyer]);

  const onSubmit = async () => {
    if (!buyer || !email.trim()) return;
    setSubmitting(true);
    try {
      await http.post(`/api/buyers/${buyer.id}/invite`, {
        body: {
          email: email.trim(),
          contactName: contactName.trim() || undefined,
          message: message.trim() || undefined,
        },
      });
      // Remember who was invited so the buyer's Members table lists them (the
      // buyer's own contact email is listed there automatically).
      if (email.trim().toLowerCase() !== (buyer.email ?? "").trim().toLowerCase()) {
        useBuyerMembersStore.getState().addMember(buyer.id, email.trim());
      }
      // A new invitation starts from scratch, even for an email seen before -
      // including the buyer's own contact address.
      markInvited([email]);
      toast.success(`Invite sent to ${email.trim()}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't send invite — please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>Invite buyer</DialogTitle>
              <DialogDescription>
                Send <span className="font-mono">{buyer?.name}</span> a setup
                link so they can sign in to the platform.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="bi-email">Email</Label>
            <Input
              id="bi-email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@buyer.example"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bi-contact">Contact name (optional)</Label>
            <Input
              id="bi-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bi-message">Message (optional)</Label>
            <Textarea
              id="bi-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Any context to include in the invite email."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !email.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Mail className="h-3.5 w-3.5" /> Send invite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

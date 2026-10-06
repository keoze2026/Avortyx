"use client";

/**
 * Access request form — Avortyx is invite-only, so prospects fill in their
 * details here and an admin reviews + approves. On approval the backend
 * creates the user and emails a one-time setup link; clicking the link lands
 * the user on /set-password where they pick their password and are signed in.
 */

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { accessRequestsService } from "@/lib/api/services/access-requests.service";
import { ApiError } from "@/lib/api/http";

/** A referral code is only ever letters, digits, "-" and "_" - anything else is dropped. */
export function cleanReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(code) ? code : null;
}

/**
 * The access-request API has no referral field, so a referral code (from
 * /request-access?ref=CODE, the page referral links land on) is added to the
 * text the reviewer reads when they approve the request.
 */
export function withReferral(useCase: string, referralCode?: string | null): string {
  const code = cleanReferralCode(referralCode);
  if (!code) return useCase;
  const note = `[Referral code: ${code}]`;
  return useCase ? `${useCase}\n\n${note}` : note;
}

interface SignupFormProps {
  /** Referral code from the page's ?ref= parameter, if any. */
  referralCode?: string | null;
}

export function SignupForm({ referralCode }: SignupFormProps = {}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [useCase, setUseCase] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 7) {
      toast.error("Please enter a phone number we can reach you on.");
      return;
    }

    setPending(true);
    try {
      await accessRequestsService.create({
        name: name.trim(),
        company: organization.trim(),
        email: email.trim(),
        phone: phone.trim(),
        useCase: withReferral(useCase.trim(), referralCode),
      });
      setSubmitted(true);
      toast.success("Request received — we'll be in touch shortly.");
    } catch (err) {
      // Backend rate-limits this endpoint to 5/min by IP — surface a friendlier
      // message than the raw "HTTP 429".
      const friendly =
        err instanceof ApiError && err.status === 429
          ? "Too many requests — please wait a minute and try again."
          : err instanceof Error
            ? err.message
            : "Couldn't send your request. Please try again.";
      toast.error(friendly);
    } finally {
      setPending(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Thanks — request received</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Our team reviews access requests within one business day. We&apos;ll
            email <span className="text-foreground">{email}</span> with next steps.
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Urgent? Email{" "}
          <a href="mailto:hello@avortyx.io" className="text-accent hover:underline">
            hello@avortyx.io
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="organization">Company</Label>
          <Input
            id="organization"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="use-case">What are you looking to route?</Label>
        <Textarea
          id="use-case"
          rows={3}
          placeholder="A few words on your verticals, monthly call volume, and current stack."
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            Request access <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        Avortyx is invite-only. We&apos;ll review your request and reach out.
      </p>
    </form>
  );
}

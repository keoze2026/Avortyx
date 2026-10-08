"use client";

/**
 * Onboarding gate — sits between the auth guard and the app content. The
 * authenticated user must clear two requirements before the panel unlocks:
 *
 *   1. KYC submission status === "approved"
 *   2. Billing account balance > 0
 *
 * Until both are satisfied the gate replaces the page with a setup screen
 * pointing the user at the right action. A small exception list allows the
 * user to actually reach the pages they need to clear the gate (/kyc and
 * /billing), plus settings + logout escape hatches.
 *
 * Admin users (role === "admin") and superusers (is_superuser === true)
 * bypass both checks entirely — they always have full access without
 * needing to verify KYC or maintain a balance.
 */

import { useEffect } from "react";

import { isDemoMode } from "@/lib/demo/flag";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CreditCard, Loader2, LogOut, ScanFace, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/auth-store";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { cn } from "@/lib/utils";

/** Pages the user MUST be able to reach even when the gate would otherwise
 *  block them — otherwise they can't complete KYC or top up balance. */
const EXEMPT_ROUTES = new Set<string>([
  ROUTES.kyc,
  ROUTES.billing,
  ROUTES.settings,
]);

function isExempt(pathname: string): boolean {
  // Match the exempt route or any nested page under it (e.g. /kyc/identity).
  return Array.from(EXEMPT_ROUTES).some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { kycStatus, balance, loading, hydrated, refresh } = useOnboardingStore();
  const logout = useAuthStore((s) => s.logout);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // Admins and superusers bypass both gates entirely — no KYC, no balance
  // check, full access. Backend confirmed this on 2026-06-11.
  //
  // Buyers and publishers bypass them too, for a different reason: they are
  // guests in someone else's workspace. KYC and funding belong to the
  // workspace owner — a partner cannot even read the billing account (403 by
  // role), so their balance read as zero for ever and every invited partner
  // landed on "Add funds to activate your panel" instead of their data.
  const isPartner = user?.role === "buyer" || user?.role === "publisher";
  const isPrivileged = user?.role === "admin" || user?.isSuperuser === true || isPartner;

  // Fetch once on mount (only when the user is authenticated AND not a
  // privileged user — privileged users skip the gate so the fetch is wasted).
  // Exception: in demo mode we want the topbar wallet to show the seeded
  // balance even for the demo admin, so we always trigger the fetch.
  useEffect(() => {
    if (!isAuthed) return;
    if (isPrivileged && !isDemoMode()) return;
    if (hydrated) return;
    void refresh();
  }, [isAuthed, isPrivileged, hydrated, refresh]);

  // Privileged users never see the gate.
  if (isPrivileged) {
    return <>{children}</>;
  }

  // While the gate is still figuring out the user's state, render nothing
  // (AuthGuard already paints a loading shell, so there's no flash).
  if (!hydrated && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Logo animated className="h-10 w-10" uid="onboarding" />
          <p className="text-xs font-mono uppercase tracking-wider">Checking account…</p>
        </div>
      </div>
    );
  }

  const kycApproved = kycStatus === "approved";
  const balanceFunded = (balance ?? 0) > 0;
  const passes = kycApproved && balanceFunded;

  // Exempt pages always render normally so the user can complete the gate.
  if (passes || isExempt(pathname)) {
    return <>{children}</>;
  }

  // KYC takes priority over balance — they have to verify before they can pay.
  if (!kycApproved) {
    return (
      <GateScreen
        icon={ScanFace}
        title="Verify your account to continue"
        description={
          kycStatus === "rejected"
            ? "Your previous KYC submission was rejected. Resubmit your details below to regain access."
            : kycStatus === "submitted"
              ? "Your submission is under review. This usually takes a few hours during business days."
              : "We need to verify your identity before you can route calls. The process takes a few minutes."
        }
        status={kycStatus}
        primary={{
          label: kycStatus === "submitted" ? "View status" : "Start verification",
          href: ROUTES.kyc,
        }}
        secondary={{ label: "Sign out", onClick: () => void logout() }}
      />
    );
  }

  // KYC passed but balance is zero — block until they recharge.
  return (
    <GateScreen
      icon={CreditCard}
      title="Add funds to activate your panel"
      description="Your account is verified — add a starting balance to begin routing calls. The Recharge form on the Billing page supports card payments via Stripe and USDT via Capitalist."
      status="funded"
      primary={{ label: "Recharge balance", href: ROUTES.billing }}
      secondary={{ label: "Sign out", onClick: () => void logout() }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Gate screen — full-page centered card with a status badge + CTAs.   */
/* ─────────────────────────────────────────────────────────────────── */

function GateScreen({
  icon: Icon,
  title,
  description,
  status,
  primary,
  secondary,
}: {
  icon: typeof ScanFace;
  title: string;
  description: string;
  status: string | null;
  primary: { label: string; href: string };
  secondary: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
      <Logo animated className="h-10 w-10" uid="gate" />

      <Card className="relative w-full max-w-md overflow-hidden">
        {/* Soft accent wash so the card feels like the brand surface. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/[0.10] to-transparent"
        />

        <CardContent className="relative space-y-5 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Icon className="h-5 w-5" />
            </span>
            {status && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                  status === "rejected"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : status === "submitted"
                      ? "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
                      : "border-accent/40 bg-accent/10 text-accent",
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                {status === "funded" ? "Verified" : status}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="space-y-2 pt-2">
            <Link href={primary.href} className="block">
              <Button className="w-full justify-between" size="lg">
                {primary.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={secondary.onClick}
            >
              <LogOut className="h-3.5 w-3.5" />
              {secondary.label}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Need help?{" "}
        <a href="mailto:hello@avortyx.io" className="text-accent hover:underline">
          Contact support
        </a>
      </p>
    </div>
  );
}

/** Indicator the gate is loading something — used by the KYC + billing
 *  pages so they can show a refresh spinner while the gate is re-checking
 *  after a submission/recharge. */
export function OnboardingRefreshIndicator() {
  const loading = useOnboardingStore((s) => s.loading);
  if (!loading) return null;
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Re-checking account status…
    </div>
  );
}

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { BRAND } from "@/lib/constants";
import { REQUEST_ACCESS_MAILTO } from "@/lib/portal-access";

const STEPS = [
  { title: "You send a request", text: "Tell us who you are and what you want to do on the platform." },
  { title: "We review it", text: "Every request is looked at by our team - access is by invitation only." },
  { title: "You get a personal link", text: "If approved, we email you a secure link to set up your account." },
];

/** Reads ?ref= (referral links land here) and hands it to the form. */
function RequestForm() {
  const params = useSearchParams();
  return <SignupForm referralCode={params.get("ref")} />;
}

/**
 * The public site's Request Access page. It deliberately never mentions or
 * links to a sign-in page or to where the portal lives: customers are told
 * that address privately, in the email they receive once approved.
 */
export function RequestAccessPage() {
  return (
    <section className="relative overflow-hidden pt-36 pb-24 lg:pt-44 lg:pb-32">
      <div className="mx-auto grid max-w-[1100px] gap-14 px-2.5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:px-12">
        <div className="max-w-xl">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-keppel-400)]">
            By invitation only
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-balance text-[var(--color-baltic-sea-50)] sm:text-5xl">
            Request access to {BRAND.name}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--color-baltic-sea-400)]">
            {BRAND.name} is a private platform for pay-per-call buyers, publishers and networks. Tell us about your
            business and our team will review your request.
          </p>

          <ol className="mt-10 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-keppel-400)]/40 text-xs font-semibold text-[var(--color-keppel-400)]">
                  {i + 1}
                </span>
                <div>
                  <div className="font-semibold text-[var(--color-baltic-sea-100)]">{s.title}</div>
                  <div className="mt-0.5 text-sm leading-relaxed text-[var(--color-baltic-sea-400)]">{s.text}</div>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-10 text-sm text-[var(--color-baltic-sea-400)]">
            Prefer email?{" "}
            <a href={REQUEST_ACCESS_MAILTO} className="text-[var(--color-keppel-400)] hover:underline">
              {BRAND.email}
            </a>
          </p>
        </div>

        <AuthCard title="Tell us about your business" description="It takes a minute. We only use this to review your request.">
          <Suspense fallback={null}>
            <RequestForm />
          </Suspense>
        </AuthCard>
      </div>
    </section>
  );
}

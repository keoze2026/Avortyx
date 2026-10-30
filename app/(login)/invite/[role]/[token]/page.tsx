import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { InviteCard } from "@/components/auth/auth-cards";
import { loginFont } from "../../../font";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const VALID_ROLES = new Set(["buyer", "publisher"]);

interface PageProps {
  params: Promise<{ role: string; token: string }>;
}

/** /invite/<buyer|publisher>/<token> — the role invite, in the sign-in screen's frame. */
export default async function InvitePage({ params }: PageProps) {
  const { role, token } = await params;
  if (!VALID_ROLES.has(role)) notFound();
  return (
    <AuthShell fontClass={loginFont.variable}>
      <InviteCard role={role as "buyer" | "publisher"} token={token} />
    </AuthShell>
  );
}

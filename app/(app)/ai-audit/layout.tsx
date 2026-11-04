import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "AI Audit" };

export default function AiAuditLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

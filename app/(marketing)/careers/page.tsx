import type { Metadata } from "next";

import { CareersPage } from "@/components/marketing/careers";
import { BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Careers · ${BRAND.name}`,
  description:
    "Join the team building real-time call scoring, routing and settlement for pay-per-call networks. Remote roles in engineering, data, customer and sales.",
};

export default function Careers() {
  return <CareersPage />;
}

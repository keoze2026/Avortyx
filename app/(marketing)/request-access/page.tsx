import type { Metadata } from "next";

import { RequestAccessPage } from "@/components/marketing/request-access";
import { BRAND } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Request access · ${BRAND.name}`,
  description:
    "Avortyx is a private platform for pay-per-call buyers, publishers and networks. Tell us about your business and we will review your request.",
};

/**
 * The only way in from the public website. There is no sign-in or sign-up
 * here: this is a request form that an admin reviews (see proxy.ts).
 */
export default function RequestAccess() {
  return <RequestAccessPage />;
}

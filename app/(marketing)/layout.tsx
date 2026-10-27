import type { ReactNode } from "react";

import { ChatWidget } from "@/components/marketing/chat-widget";
import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";
import { BRAND } from "@/lib/constants";
import { SITE_URL } from "@/lib/seo";

/** CH-319: Google's "business card" for Avortyx - the name, site and logo, so a
 *  search for "avortyx" is read as our brand, not a typo of "vortex". */
const ORGANIZATION_JSON_LD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    email: BRAND.email,
    description: BRAND.description,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: SITE_URL,
  },
]);

/**
 * Marketing layout — the landing page's own dark canvas, header + footer.
 *
 * `.marketing-shell` scopes the landing page's palette and typeface (see
 * app/globals.css) and is what the chat widget's `--m-*` tokens resolve
 * against, so the widget picks up the same colours without any changes of
 * its own.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell min-h-screen bg-background overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORGANIZATION_JSON_LD }} />
      <Header />
      <main>{children}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

import type { ReactNode } from "react";

import { ChatWidget } from "@/components/marketing/chat-widget";
import { Footer } from "@/components/marketing/footer";
import { Header } from "@/components/marketing/header";

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
      <Header />
      <main>{children}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

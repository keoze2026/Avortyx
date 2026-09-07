import type { ReactNode } from "react";

import { ChatWidget } from "@/components/marketing/chat-widget";
import { Footer } from "@/components/marketing/footer";
import { Navbar } from "@/components/marketing/navbar";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Marketing layout — light canvas, public navbar + footer.
 * The app surface keeps the user's own theme; this shell is always light.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-shell min-h-screen overflow-x-clip">
      <Reveal />
      <Navbar />
      <main>{children}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

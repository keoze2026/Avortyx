import type { Metadata } from "next";
import type { ReactNode } from "react";

/** The public TFN Check page (CH-214): opened from a private link, no login. */
export const metadata: Metadata = {
  title: "TFN Check",
  // The link is private: keep these pages out of search engines.
  robots: { index: false, follow: false },
};

export default function CheckLayout({ children }: { children: ReactNode }) {
  return children;
}

import type React from "react";
import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { AppProviders } from "@/components/providers/app-providers";
import { BRAND } from "@/lib/constants";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s — ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: {
    icon: [{ url: "/avortyx-mark.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
};

/**
 * Applies the persisted accent class before first paint so the themed
 * surfaces don't flash the default first.
 *
 * Reads the same `vortyx.accent` zustand-persist key that AccentProvider
 * uses, so the marketing toggle and the in-app picker share one source of
 * truth. Every registry entry maps to `theme-<id>`, except `default` (blue,
 * the base tokens, no class) and `green`. Any failure falls through to blue.
 */
const themeInitScript = `(function(){try{var r=localStorage.getItem('vortyx.accent');if(!r)return;var id=(JSON.parse(r).state||{}).accent;if(!id||id==='default')return;document.documentElement.classList.add(id==='green'?'theme-green-accent':'theme-'+id);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} ${interTight.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}

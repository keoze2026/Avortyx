import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { AppProviders } from "@/components/providers/app-providers";
import { SITE_URL } from "@/lib/seo";
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
// The landing page's typeface (it ships with Geist). Only `.marketing-shell`
// switches to it — the product keeps Inter.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

// CH-319: what Google and link previews (WhatsApp, LinkedIn, Telegram) show.
const SEO_DESCRIPTION = `${BRAND.name} - ${BRAND.description.charAt(0).toLowerCase()}${BRAND.description.slice(1)}`;

const SHARE_TITLE = `${BRAND.name} · Call Tracking & Lead Automation`;
const SHARE_DESCRIPTION =
  "Call tracking, smart call routing and lead-to-call automation in one platform. Route every call to the right buyer and see the revenue behind it.";
const SHARE_IMAGE = "/og-image.png?v=2";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s — ${BRAND.name}`,
  },
  description: SEO_DESCRIPTION,
  applicationName: BRAND.name,
  keywords: [BRAND.name, "pay-per-call", "call tracking", "call routing", "call analytics", "toll-free numbers"],
  // Link previews (emails, Telegram, WhatsApp) show the same card as the
  // website (www.avortyx.com): its title, text and share image. `?v=` makes
  // apps that cached the old icon fetch the image again.
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [{ url: SHARE_IMAGE, width: 1440, height: 756, alt: SHARE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  // Browser-tab icon (favicon). The .ico is the fallback every browser
  // understands (Safari, bookmarks, old caches); the SVG is used where
  // supported; the PNGs cover Android / "add to home screen". All show the
  // Avortyx mark on its dark tile so it reads on light and dark tab bars.
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", sizes: "16x16 32x32 48x48" },
      { url: "/favicon.svg?v=3", type: "image/svg+xml" },
      { url: "/icon-192.png?v=3", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png?v=3", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico?v=3",
    apple: "/apple-icon.png?v=3",
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
  { "@context": "https://schema.org", "@type": "WebSite", name: BRAND.name, url: SITE_URL },
]);

/**
 * CH-675: the platform owner's read-only view of a client portal (Open their
 * portal). Runs before any other script. /owner-view#t=<pass>&a=<account>&u=<ends>
 * starts it: the pass is kept in THIS tab's sessionStorage, and for this tab
 * localStorage is pointed at sessionStorage - so the client's sign-in, saved
 * settings and caches never touch the owner's own sign-in in the other tabs,
 * and closing the tab ends the view. Ends by itself at <ends>. Changes are
 * refused by the server (backend accounts/owner_view.py), not here.
 */
const ownerViewInitScript = `(function(){try{var K='avortyx.ownerView',s=window.sessionStorage;if(location.pathname==='/owner-view'){var h=new URLSearchParams(location.hash.slice(1)),p=h.get('t');if(p){s.clear();s.setItem(K,JSON.stringify({account:h.get('a')||'',until:Number(h.get('u'))||0}));s.setItem('avortyx.tokens',JSON.stringify({access:p,refresh:''}));history.replaceState(null,'',location.pathname);}}var v=s.getItem(K);if(!v)return;if((JSON.parse(v).until||0)<Date.now()){s.clear();if(location.pathname!=='/owner')location.replace('/owner');return;}try{Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return s;}});if(window.localStorage!==s)throw 0;}catch(e){s.clear();return;}document.documentElement.setAttribute('data-owner-view','1');}catch(e){}})();`;

const themeInitScript = `(function(){try{var r=localStorage.getItem('vortyx.accent');if(!r)return;var id=(JSON.parse(r).state||{}).accent;if(!id||id==='default')return;document.documentElement.classList.add(id==='green'?'theme-green-accent':'theme-'+id);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${interTight.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ownerViewInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORGANIZATION_JSON_LD }} />
      </head>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
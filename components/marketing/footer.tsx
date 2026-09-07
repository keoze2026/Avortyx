"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { useTranslation } from "@/hooks/use-translation";

const FOOTER_COLUMNS: { headingKey: string; links: { key: string }[] }[] = [
  {
    headingKey: "marketingUI.footer.columns.platform",
    links: [
      { key: "marketingUI.footer.links.liveMonitor" },
      { key: "marketingUI.footer.links.routingBuilder" },
      { key: "marketingUI.footer.links.marketplace" },
      { key: "marketingUI.footer.links.aiInsights" },
      { key: "marketingUI.footer.links.numbers" },
      { key: "marketingUI.footer.links.analytics" },
    ],
  },
  {
    headingKey: "marketingUI.footer.columns.resources",
    links: [
      { key: "marketingUI.footer.links.documentation" },
      { key: "marketingUI.footer.links.apiReference" },
      { key: "marketingUI.footer.links.webhooks" },
      { key: "marketingUI.footer.links.changelog" },
      { key: "marketingUI.footer.links.status" },
      { key: "marketingUI.footer.links.sdk" },
    ],
  },
  {
    headingKey: "marketingUI.footer.columns.company",
    links: [
      { key: "marketingUI.footer.links.about" },
      { key: "marketingUI.footer.links.customers" },
      { key: "marketingUI.footer.links.careers" },
      { key: "marketingUI.footer.links.blog" },
      { key: "marketingUI.footer.links.press" },
      { key: "marketingUI.footer.links.contact" },
    ],
  },
  {
    headingKey: "marketingUI.footer.columns.legal",
    links: [
      { key: "marketingUI.footer.links.privacy" },
      { key: "marketingUI.footer.links.terms" },
      { key: "marketingUI.footer.links.security" },
      { key: "marketingUI.footer.links.tcpa" },
      { key: "marketingUI.footer.links.hipaa" },
      { key: "marketingUI.footer.links.soc2" },
    ],
  },
];

const SOCIAL_LINKS: Array<{ label: string; href: string; icon: ReactNode }> = [
  { label: "Telegram", href: "https://t.me/Avortyx_Sup", icon: <TelegramIcon /> },
  { label: "X", href: "#", icon: <XIcon /> },
  { label: "Discord", href: "#", icon: <DiscordIcon /> },
  { label: "Facebook", href: "#", icon: <FacebookIcon /> },
];

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer style={{ background: "var(--m-bg-alt)", borderTop: "1px solid var(--m-line)" }}>
      <div className="m-container" style={{ padding: "0 24px" }}>
        {/* Masthead band — brand left, live status right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            padding: "26px 0",
            borderBottom: "1px solid var(--m-line)",
          }}
        >
          <Wordmark size="sm" uid="footer" gradient={false} />
          <Link
            href="#"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px 5px 10px",
              borderRadius: 999,
              border: "1px solid var(--m-line-2)",
              background: "var(--m-surface)",
              fontSize: 12.5,
              color: "var(--m-fg-2)",
              textDecoration: "none",
            }}
          >
            <span
              className="m-pulse"
              style={{ width: 6, height: 6, borderRadius: 999, background: "var(--m-accent)" }}
            />
            {t("marketingUI.footer.allSystemsOperational")}
          </Link>
        </div>

        {/* Link grid */}
        <div
          style={{ display: "grid", gap: "36px 28px", padding: "36px 0" }}
          className="grid-cols-2 md:grid-cols-[1.5fr_repeat(4,1fr)]"
        >
          <div className="col-span-2 md:col-span-1">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--m-fg-2)", maxWidth: "30ch" }}>
              {t("marketingUI.footer.tagline")}
            </p>
            <ul style={{ display: "flex", gap: 8, listStyle: "none", padding: 0, margin: "20px 0 0" }}>
              {SOCIAL_LINKS.map((s) => (
                <li key={s.label}>
                  <SocialIconLink href={s.href} label={s.label}>
                    {s.icon}
                  </SocialIconLink>
                </li>
              ))}
            </ul>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.headingKey} aria-label={t(column.headingKey)}>
              <h3
                className="m-label"
                style={{ color: "var(--m-fg-3)", marginBottom: 14 }}
              >
                {t(column.headingKey)}
              </h3>
              <ul style={{ display: "flex", flexDirection: "column", gap: 9, listStyle: "none", padding: 0, margin: 0 }}>
                {column.links.map((link) => (
                  <li key={link.key}>
                    <Link
                      href="#"
                      className="m-underline"
                      style={{
                        fontSize: 13.5,
                        color: "var(--m-fg-2)",
                        textDecoration: "none",
                        transition: "color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--m-fg)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--m-fg-2)")}
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "18px 0 26px",
            borderTop: "1px solid var(--m-line)",
          }}
          className="flex-col md:flex-row"
        >
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--m-fg-3)" }}>
            © {new Date().getFullYear()} {t("marketingUI.footer.copyrightSuffix")}
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--m-fg-3)" }}>
            SOC 2 Type II · TCPA · HIPAA-tier
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialIconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      style={{
        display: "inline-flex",
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--m-r-sm)",
        border: "1px solid var(--m-line)",
        background: "var(--m-surface)",
        color: "var(--m-fg-3)",
        transition: "color 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--m-fg)";
        e.currentTarget.style.borderColor = "var(--m-line-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--m-fg-3)";
        e.currentTarget.style.borderColor = "var(--m-line)";
      }}
    >
      {children}
    </a>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="15" height="15" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0Zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212-.07-.062-.174-.041-.249-.024-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="14" height="14" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="15" height="15" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="15" height="15" fill="currentColor">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

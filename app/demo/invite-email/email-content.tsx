"use client";

/**
 * Subject + body for the invite email preview at /demo/invite-email.
 *
 * The designed Avortyx invitation, authored as a real email template (table
 * layout, inline styles only) and shown inside a frame, so it renders the way
 * an inbox would show it. This is a design preview: the invitations the
 * backend sends today are separate and are not changed by this file.
 *
 * Preview values are neutral samples ("The Avortyx team", you@example.com).
 * Images come from /email/avortyx-logo.png and /email/support-avatar.png.
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";

type Role = "buyer" | "publisher";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const ROLE_COPY: Record<Role, { label: string; workspace: string; pitch: string; benefits: string[] }> = {
  buyer: {
    label: "Buyer",
    workspace: "buyer workspace",
    pitch: "start buying qualified calls",
    benefits: [
      "Live view of every routed call, including caller geo and intent signals",
      "Daily and monthly cap controls, plus concurrency limits",
      "Per-vertical bidding with full call recording and dispute tools",
    ],
  },
  publisher: {
    label: "Publisher",
    workspace: "publisher workspace",
    pitch: "start monetizing your calls",
    benefits: [
      "Live revenue, payout share and per-campaign earnings",
      "Number provisioning and routing assignment in seconds",
      "Direct payouts with full transparency on every billable call",
    ],
  },
};

/** Sample values for the preview only. */
const PREVIEW = {
  inviter: "The Avortyx team",
  recipientEmail: "you@example.com",
  expiresHours: 48,
  contactName: "Avortyx Support",
  contactTitle: "Partner success team",
  contactEmail: "support@avortyx.com",
  siteUrl: "https://avortyx.com",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function useRole(): Role {
  const v = useSearchParams().get("role");
  return v === "publisher" ? "publisher" : "buyer";
}

function subjectFor(role: Role): string {
  return `You're invited to Avortyx — ${ROLE_COPY[role].pitch}`;
}

/** The invitation email markup (buyer / publisher). */
function renderInviteHtml(role: Role, origin: string): string {
  const copy = ROLE_COPY[role];
  const label = copy.label;
  const who = PREVIEW.inviter;
  const action = `to join their ${copy.workspace} on Avortyx`;
  const validFor = `${PREVIEW.expiresHours} hours`;
  const acceptUrl = `${origin}/invite/${role}/${role}-demo`;
  const asset = origin;
  const site = PREVIEW.siteUrl;
  const subject = subjectFor(role);
  const preheader = `${who} invited you to Avortyx. Your link is valid for ${validFor}.`;
  const url = esc(acceptUrl);
  const year = new Date().getFullYear();

  const benefits = copy.benefits
    .map(
      (b) => `
        <tr>
          <td width="30" valign="top" style="padding:0 0 12px 0;">
            <div style="width:20px;height:20px;border-radius:10px;background:#2563EB;color:#FFFFFF;font:700 12px/20px ${FONT};text-align:center;">&#10003;</div>
          </td>
          <td valign="top" style="padding:0 0 12px 0;font:400 14px/20px ${FONT};color:#334155;">${esc(b)}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F7;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
        <tr>
          <td align="center" bgcolor="#0B1530" style="background:#0B1530;background-image:linear-gradient(135deg,#0B1530 0%,#132A63 58%,#1D4ED8 100%);padding:36px 32px 32px;">
            <img src="${esc(asset)}/email/avortyx-logo.png" width="52" height="52" alt="Avortyx" style="display:block;margin:0 auto 12px;border:0;outline:none;">
            <div style="font:700 24px/30px ${FONT};color:#FFFFFF;letter-spacing:-0.3px;">Avortyx</div>
            <div style="font:400 13px/20px ${FONT};color:#A9BDF2;margin-top:4px;">Pay-per-call routing, reimagined.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 4px;">
            <span style="display:inline-block;background:#EAF1FF;color:#1D4ED8;font:700 11px/11px ${FONT};letter-spacing:1px;text-transform:uppercase;padding:7px 11px;border-radius:999px;">${esc(label)} invitation</span>
            <h1 style="margin:16px 0 0;font:700 24px/32px ${FONT};color:#0F172A;letter-spacing:-0.3px;">You're invited to Avortyx as a ${esc(label)}</h1>
            <p style="margin:16px 0 0;font:400 15px/24px ${FONT};color:#334155;">Hi there,</p>
            <p style="margin:8px 0 0;font:400 15px/24px ${FONT};color:#334155;"><strong style="color:#0F172A;">${esc(who)}</strong> invited you ${esc(action)}. Accept the invitation to set your password and get started.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 10px;">
              <tr>
                <td align="center" bgcolor="#2563EB" style="background:#2563EB;border-radius:10px;">
                  <a href="${url}" target="_blank" style="display:inline-block;padding:14px 30px;font:600 15px/20px ${FONT};color:#FFFFFF;text-decoration:none;border-radius:10px;">Accept invitation &rarr;</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;text-align:center;font:400 12px/18px ${FONT};color:#64748B;">This invitation link is valid for ${esc(validFor)}.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;">
              <tr>
                <td style="padding:20px 22px 8px;">
                  <div style="font:700 11px/16px ${FONT};letter-spacing:1px;text-transform:uppercase;color:#0F172A;margin:0 0 14px;">What you'll get</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${benefits}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E2E8F0;">
              <tr>
                <td width="96" valign="top" align="center" style="padding:24px 16px 0 0;">
                  <img src="${esc(asset)}/email/support-avatar.png" width="64" height="64" alt="${esc(PREVIEW.contactName)}" style="display:block;width:64px;height:64px;border-radius:32px;border:0;">
                  <div style="font:600 12px/16px ${FONT};color:#0F172A;margin-top:8px;">${esc(PREVIEW.contactName)}</div>
                  <div style="font:400 11px/14px ${FONT};color:#94A3B8;margin-top:2px;">${esc(PREVIEW.contactTitle)}</div>
                </td>
                <td valign="top" style="padding:24px 0 0;">
                  <div style="font:700 16px/22px ${FONT};color:#0F172A;">Have a question?</div>
                  <p style="margin:6px 0 0;font:400 14px/22px ${FONT};color:#475569;">Our team can help with setup, routing or pricing. Just reply to this email &mdash; we're here to help 24/7.</p>
                  <p style="margin:12px 0 0;font:600 14px/20px ${FONT};">
                    <a href="mailto:${esc(PREVIEW.contactEmail)}" style="color:#2563EB;text-decoration:none;">Talk to an expert</a>
                    <span style="color:#CBD5E1;">&nbsp;/&nbsp;</span>
                    <a href="${esc(site)}" target="_blank" style="color:#2563EB;text-decoration:none;">Visit avortyx.com</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font:400 12px/18px ${FONT};color:#64748B;">If the button doesn't work, copy this link into your browser:</div>
                  <div style="margin-top:6px;font:500 12px/18px Menlo,Consolas,'Courier New',monospace;color:#0F172A;word-break:break-all;"><a href="${url}" target="_blank" style="color:#0F172A;text-decoration:none;">${esc(acceptUrl)}</a></div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td align="center" style="padding:20px 24px 0;font:400 12px/18px ${FONT};color:#64748B;">
            You're receiving this because ${esc(who)} invited ${esc(PREVIEW.recipientEmail)} to Avortyx.
            If you weren't expecting it, you can safely ignore this email &mdash; nothing is activated until you accept.
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:10px 24px 24px;font:400 12px/18px ${FONT};color:#94A3B8;">
            &copy; ${year} Avortyx &middot; <a href="${esc(site)}" style="color:#94A3B8;text-decoration:underline;">avortyx.com</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function SubjectLine() {
  return <>{subjectFor(useRole())}</>;
}

/** The email itself, in a frame sized to its content (like an inbox). */
export function EmailBody() {
  const role = useRole();
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = React.useState("");
  const [height, setHeight] = React.useState(1100);

  React.useEffect(() => setOrigin(window.location.origin), []);

  const html = React.useMemo(() => (origin ? renderInviteHtml(role, origin) : ""), [role, origin]);

  const fit = React.useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (doc?.documentElement) setHeight(doc.documentElement.scrollHeight);
  }, []);

  React.useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  if (!html) return null;
  return (
    <iframe
      ref={frame}
      title="Invite email"
      srcDoc={html}
      onLoad={fit}
      style={{ display: "block", width: "100%", height, border: 0, background: "#EEF2F7" }}
    />
  );
}

#!/usr/bin/env node
/**
 * Avortyx Guard, layer 5 (CH-355): the robot browser check.
 *
 * Logs in to the live portal with the robot account and opens the main
 * pages. A page fails when it shows the error screen, throws in the browser,
 * gets a 5xx from the server, or takes longer than 30 s. On any failure a
 * Telegram message goes out with a screenshot of that page, and the job
 * fails. Read only: it opens pages, it never clicks Save, Delete or Apply.
 *
 * Runs from .github/workflows/smoke.yml after every production deploy and
 * every 6 hours. Environment:
 *   PORTAL_URL           https://... (the live portal)
 *   GUARD_EMAIL          the robot account (a team login, MFA off, view only)
 *   GUARD_PASSWORD
 *   GUARD_REPORTS_PIN    optional: the robot's Reports PIN, to open Reports
 *   TELEGRAM_BOT_TOKEN   optional: alerts
 *   GUARD_CHAT_ID        optional: the team chat for alerts
 *
 *   NODE_PATH=<dir with playwright>/node_modules node scripts/smoke.cjs
 */
const { chromium } = require("playwright");

const BASE = (process.env.PORTAL_URL || "").replace(/\/$/, "");
const PAGES = [
  ["Dashboard", "/dashboard"],
  ["Call Logs", "/calls"],
  ["Reports", "/reports"],
  ["Campaigns", "/campaigns"],
  ["Campaign Groups", "/campaigns/groups"],
  ["TFN Check", "/tfn-check"],
  ["Numbers", "/numbers"],
  ["Buyers", "/buyers"],
  ["Publishers", "/publishers"],
  ["Destinations", "/destinations"],
  ["Billing", "/billing"],
];
const SLOW_MS = 30_000;
const ERROR_TEXT = /Application error|Something went wrong|Unhandled Runtime Error|This page could not be found/i;

async function telegram(text, png) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.GUARD_CHAT_ID;
  if (!token || !chat) return;
  try {
    if (png) {
      const form = new FormData();
      form.append("chat_id", chat);
      form.append("caption", text.slice(0, 1000));
      form.append("parse_mode", "HTML");
      form.append("photo", new Blob([png], { type: "image/png" }), "page.png");
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
    } else {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML" }),
      });
    }
  } catch (e) {
    console.log("Telegram not sent:", e.message);
  }
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  if (!BASE || !process.env.GUARD_EMAIL || !process.env.GUARD_PASSWORD) {
    console.log("PORTAL_URL, GUARD_EMAIL and GUARD_PASSWORD are needed.");
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  let errors = [];
  let serverErrors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  page.on("response", (r) => {
    if (r.status() >= 500 && r.url().includes("/api/")) serverErrors.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });

  const results = [];
  let firstFail = null;

  // 1. Log in.
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: SLOW_MS });
    await page.locator("#email").fill(process.env.GUARD_EMAIL);
    await page.locator("#password").fill(process.env.GUARD_PASSWORD);
    await page.locator("#password").press("Enter");
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: SLOW_MS });
    results.push(["Log in", true, ""]);
  } catch (e) {
    const mfa = await page.getByText(/code|verification|authenticator/i).first().isVisible().catch(() => false);
    const why = mfa ? "the robot account asks for a 2FA code - turn 2FA off for it" : `login failed (${e.message.split("\n")[0]})`;
    results.push(["Log in", false, why]);
    firstFail = { name: "Log in", png: await page.screenshot().catch(() => null) };
  }

  // 2. Every page.
  if (results[0][1]) {
    for (const [name, path] of PAGES) {
      errors = [];
      serverErrors = [];
      const started = Date.now();
      let ok = true;
      let why = "";
      try {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: SLOW_MS });
        await page.waitForLoadState("networkidle", { timeout: SLOW_MS }).catch(() => {});
        if (name === "Reports" && process.env.GUARD_REPORTS_PIN) {
          const pin = page.locator('input[type="password"][inputmode="numeric"]');
          if (await pin.isVisible().catch(() => false)) {
            await pin.fill(process.env.GUARD_REPORTS_PIN);
            await pin.press("Enter");
            await page.waitForLoadState("networkidle", { timeout: SLOW_MS }).catch(() => {});
          }
        }
        await page.waitForTimeout(1500);
        const body = await page.locator("body").innerText().catch(() => "");
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        if (ERROR_TEXT.test(body)) [ok, why] = [false, "shows the error screen"];
        else if (/\/login/.test(new URL(page.url()).pathname)) [ok, why] = [false, "sent back to the login page"];
        else if (serverErrors.length) [ok, why] = [false, `server errors: ${[...new Set(serverErrors)].slice(0, 3).join(", ")}`];
        else if (errors.length) [ok, why] = [false, `browser error: ${errors[0]}`];
        else if (Date.now() - started > SLOW_MS) [ok, why] = [false, `took ${secs} s`];
        else why = `${secs} s`;
      } catch (e) {
        [ok, why] = [false, e.message.split("\n")[0].slice(0, 160)];
      }
      results.push([name, ok, why]);
      if (!ok && !firstFail) firstFail = { name, png: await page.screenshot({ fullPage: false }).catch(() => null) };
    }
  }
  await browser.close();

  for (const [name, ok, why] of results) console.log(`${ok ? "OK  " : "FAIL"} ${name.padEnd(16)} ${why}`);
  const failed = results.filter((r) => !r[1]);
  if (failed.length) {
    const text =
      `<b>Avortyx Guard · robot check failed</b>\n` +
      failed.map(([n, , w]) => `🔴 ${esc(n)}: ${esc(w)}`).join("\n") +
      `\n✅ ${results.length - failed.length} of ${results.length} fine` +
      (process.env.GITHUB_SERVER_URL ? `\n<a href="${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}">Run details</a>` : "");
    await telegram(text, firstFail && firstFail.png);
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.log("Robot check crashed:", e);
  await telegram(`<b>Avortyx Guard · robot check could not run</b>\n${esc(e.message)}`);
  process.exit(1);
});

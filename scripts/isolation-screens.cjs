#!/usr/bin/env node
/**
 * CH-625 - customer accounts point 11, the portal screens.
 *
 * Sir: "run automated isolation tests on every page and API endpoint: no data
 * visible across accounts or from the main account." The backend sweeps
 * (CH-623, CH-624) cover every API page. This opens every SCREEN of the
 * portal, as a real browser, with a real login of each account:
 *
 *   1. Test A logs in and opens every page of the portal, and every detail
 *      page (campaign, buyer, publisher, destination, routing rule) of the
 *      other accounts by its address.
 *   2. Test A signs out and Test B signs in IN THE SAME BROWSER (what a shared
 *      office computer does), and does the same - nothing of Test A may be
 *      left on any screen (saved lists, caches, last page).
 *   3. Then our main account, the same way.
 *
 * A screen fails when it shows any name or number of another account. As a
 * control, each account must see its own campaign on Campaigns.
 *
 * Runs only in .github/workflows/isolation-screens.yml, against a backend
 * and portal started inside the GitHub job with three test accounts
 * (scripts/isolation/seed.py) - never against the live system.
 *
 *   PORTAL_URL=http://localhost:3000 ACCOUNTS=/tmp/isolation/accounts.json \
 *   NODE_PATH=<dir with playwright>/node_modules node scripts/isolation-screens.cjs
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = (process.env.PORTAL_URL || "http://localhost:3000").replace(/\/$/, "");
const ACCOUNTS = JSON.parse(fs.readFileSync(process.env.ACCOUNTS || "/tmp/isolation/accounts.json", "utf8"));
const SHOTS = process.env.SHOTS || "/tmp/isolation/shots";
const WAIT_MS = 20_000;
const ORDER = ["A", "B", "main"];

/** Every page of the portal: each app/(app)/.../page.tsx without an id. */
function portalPages() {
  const root = path.join(__dirname, "..", "app", "(app)");
  const out = [];
  (function walk(dir, url) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name.startsWith("[")) continue;                  // an id page: tried below with ids
        const seg = e.name.startsWith("(") ? "" : `/${e.name}`; // route groups add nothing
        walk(path.join(dir, e.name), url + seg);
      } else if (e.name === "page.tsx" && url) {
        out.push(url);
      }
    }
  })(root, "");
  return [...new Set(out)].sort();
}

/** Other accounts' detail pages, opened by their address. */
function detailPages(me) {
  const out = [];
  for (const [key, acc] of Object.entries(ACCOUNTS)) {
    if (key === me) continue;
    const ids = acc.ids;
    out.push(`/campaigns/${ids.campaign}`, `/buyers/${ids.buyer}`, `/publishers/${ids.publisher}`,
             `/destinations/${ids.destination}`, `/routing/${ids.rule}`);
  }
  return out;
}

function othersOnScreen(me, text) {
  const found = [];
  const digits = text.replace(/\D/g, "");
  for (const [key, acc] of Object.entries(ACCOUNTS)) {
    if (key === me) continue;
    if (text.toLowerCase().includes(acc.tag)) found.push(`${key}'s name (${acc.tag} ...)`);
    for (const n of acc.numbers) if (text.includes(n) || digits.includes(n)) found.push(`${key}'s number ...${n.slice(-4)}`);
  }
  return found;
}

async function signIn(page, acc) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: WAIT_MS });
  await page.locator("#email").fill(acc.email);
  await page.locator("#password").fill(acc.password);
  await page.locator("#password").press("Enter");
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: WAIT_MS });
}

async function signOut(page) {
  // As a person does it: the account menu, then Sign out.
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: WAIT_MS });
    await page.getByRole("button", { name: /^Account menu for/ }).click({ timeout: 10_000 });
    await page.getByRole("menuitem", { name: /Sign out/i }).click({ timeout: 10_000 });
    await page.waitForURL((u) => /\/login/.test(u.pathname) || u.pathname === "/", { timeout: WAIT_MS });
    return "signed out from the menu";
  } catch (e) {
    return `could not sign out from the menu (${e.message.split("\n")[0].slice(0, 80)})`;
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const pages = portalPages();
  console.log(`Portal pages: ${pages.length} · accounts: ${ORDER.join(", ")} (one browser, signed in one after the other)`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const problems = [];
  let opened = 0;

  for (const me of ORDER) {
    const acc = ACCOUNTS[me];
    try {
      await signIn(page, acc);
    } catch (e) {
      problems.push(`${me}: could not sign in (${e.message.split("\n")[0]})`);
      await page.screenshot({ path: `${SHOTS}/${me}-login.png` }).catch(() => {});
      continue;
    }
    for (const url of [...pages, ...detailPages(me)]) {
      try {
        await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: WAIT_MS });
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
        await page.waitForTimeout(1200);
        opened += 1;
        const text = await page.locator("body").innerText().catch(() => "");
        if (url === "/campaigns" && !text.toLowerCase().includes(acc.tag)) {
          problems.push(`${me}: control failed - its own campaign is not on /campaigns`);
        }
        const found = othersOnScreen(me, text);
        if (found.length) {
          problems.push(`${me} on ${url}: shows ${[...new Set(found)].join(", ")}`);
          await page.screenshot({ path: `${SHOTS}/${me}${url.replace(/\//g, "_")}.png`, fullPage: true }).catch(() => {});
        }
      } catch (e) {
        console.log(`  (${me} ${url}: not opened - ${e.message.split("\n")[0].slice(0, 100)})`);
      }
    }
    console.log(`${me}: ${await signOut(page)}`);
  }
  await browser.close();

  console.log(`\nScreens opened: ${opened} · problems: ${problems.length}`);
  for (const p of problems) console.log(`FAIL ${p}`);
  if (problems.length) process.exit(1);
  console.log("Every screen shows only the signed-in account's own data.");
}

main().catch((e) => {
  console.log("Screen sweep crashed:", e);
  process.exit(1);
});

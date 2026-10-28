#!/usr/bin/env node
/**
 * Avortyx Guard, layer 3 (CH-355): every API path the portal calls exists on
 * the server.
 *
 * The server's list is contract/api-paths.txt - a copy of the backend's
 * docs/api-paths.txt (`python manage.py api_paths --write` there). In CI the
 * latest copy is fetched from the backend repo first when BACKEND_REPO_TOKEN
 * is set, so a path renamed or removed on the server fails here before the
 * portal ships.
 *
 * Every "/api/..." string or template in app/, components/, hooks/ and lib/
 * (not lib/demo, the offline mock) is checked; the portal's own route
 * handlers (app/api/.../route.ts) count as found. `${id}` matches any one segment, a string ending in "/" (a base
 * like "/api/campaign-groups/") only needs some path under it.
 * contract/api-paths-unknown.txt lists the ones already unmatched when this
 * check started; only a NEW unmatched path fails.
 *
 *   node scripts/check-api-paths.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DIRS = ["app", "components", "hooks", "lib"];

const server = readFileSync(join(ROOT, "contract/api-paths.txt"), "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split(" ")[1]);
const known = existsSync(join(ROOT, "contract/api-paths-unknown.txt"))
  ? new Set(readFileSync(join(ROOT, "contract/api-paths-unknown.txt"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")))
  : new Set();

// The portal's own route handlers (app/api/.../route.ts) answer these, not the server.
function* routeFiles(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* routeFiles(p);
    else if (/^route\.(ts|js)$/.test(name)) yield p;
  }
}
const own = [...routeFiles(join(ROOT, "app"))]
  .map((f) => "/" + relative(join(ROOT, "app"), f).replace(/\\/g, "/").replace(/\/route\.(ts|js)$/, ""))
  .map((r) => r.replace(/\/\([^)]*\)/g, "").replace(/\[[^\]]+\]/g, "{}"))
  .filter((r) => r.startsWith("/api/"));

const segs = (p) => p.replace(/^\/|\/$/g, "").split("/");
function matches(portal) {
  const prefixOnly = portal.endsWith("/");
  const a = segs(portal);
  return [...server, ...own].some((s) => {
    const b = segs(s);
    if (prefixOnly ? b.length < a.length : b.length !== a.length) return false;
    return a.every((x, i) => x === "{}" || b[i] === "{}" || x === b[i]);
  });
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".") || name === "demo") continue;   // lib/demo = offline mock
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const found = new Map(); // path -> first place it is used
const LITERAL = /(["'`])(\/api\/[^"'`\s]*)\1/g;
for (const d of DIRS) {
  if (!existsSync(join(ROOT, d))) continue;
  for (const f of files(join(ROOT, d))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(LITERAL)) {
      let p = m[2].replace(/\$\{[^}]*\}/g, "{}").split("?")[0].replace(/\{\}\{\}/g, "{}");
      if (!/^\/api\/[a-z]/.test(p)) continue;
      if (/\{\}[^/]/.test(p) || /[^/]\{\}/.test(p)) p = p.replace(/[^/]*\{\}[^/]*/g, "{}");
      if (!found.has(p)) found.set(p, `${relative(ROOT, f)}:${src.slice(0, m.index).split("\n").length}`);
    }
  }
}

const unmatched = [...found.keys()].filter((p) => !matches(p)).sort();
const fresh = unmatched.filter((p) => !known.has(p));
const fixed = [...known].filter((p) => !unmatched.includes(p));
console.log(`API paths the portal calls: ${found.size}; on the server: ${server.length}; unmatched: ${unmatched.length} (${known.size} known)`);
if (fixed.length) console.log(`Now found on the server (remove from contract/api-paths-unknown.txt): ${fixed.join(", ")}`);
if (process.argv.includes("--list")) for (const p of unmatched) console.log(p);
if (fresh.length) {
  console.log("\nNot on the server - renamed, removed, or not deployed yet:");
  for (const p of fresh) console.log(`  ${p}   (${found.get(p)})`);
  process.exit(1);
}

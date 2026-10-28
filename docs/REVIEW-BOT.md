# Avortyx portal - notes for the review bot

Read `docs/SYSTEM-MAP.md` first (a copy of the backend's): what each section
does, which API and tables it reads, and what must always stay true. Past
changes are in `CHANGES.md` (search it for any name before changing it).

## Working rules

- Type check: `node node_modules/typescript/bin/tsc --noEmit -p .` - no NEW
  errors (the old ones are counted in `.github/type-errors-allowed`; lower it
  when you fix some, never raise it).
- API contract: `node scripts/check-api-paths.mjs` - every `/api/...` path the
  portal calls must be in `contract/api-paths.txt` (copied from the backend's
  `docs/api-paths.txt`). A new endpoint lands in the backend first.
- `lib/api/http.ts` converts camelCase <-> snake_case both ways, deeply: send
  camelCase bodies, read camelCase fields.
- The portal goes live on push, the server only after its quiet-time restart:
  a feature needing new backend code must handle the old server (check the
  response, or `/api/guard/status`) and never fail silently.
- Every text in all four languages: `lib/i18n/extra/*.ts` (en, ru, ja, zh).
- Publisher and buyer logins never see cost, other parties' money, or TTC for
  buyers; Campaign Groups and the guard are team only.
- No secrets in code (Vercel environment only).

## Reviewing a pull request (Avortyx Guard)

The review bot (`.github/workflows/review-bot.yml`) asks for an impact
report: sections touched, other sections that share the same store, service
or component, backend changes needed, server restart needed, missing
translations, tests or checks that prove it.

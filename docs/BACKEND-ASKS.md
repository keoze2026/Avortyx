# Backend Work Request — Avortyx Portal Completion

> **Context.** The frontend completeness sweep is finished. Every item below
> is the **only** thing blocking a corresponding portal feature from being
> fully real (no mocks, no fake toasts, persists across refresh). For each
> item we've documented the **exact wire shape** the frontend already expects,
> the **user-visible feature** it unlocks, and **what the frontend will do**
> when it ships so integration is one-step on our side.
>
> Companion document: [BACKEND-API-CONTRACT.md](BACKEND-API-CONTRACT.md)
> describes the canonical contract for every existing endpoint.

---

## Table of contents

1. [How this is organized](#how-this-is-organized)
2. [Group A — New endpoints (high-impact user-visible features)](#group-a--new-endpoints-high-impact-user-visible-features)
   - A1 — Integrations catalog
   - A2 — AI Chat
   - A3 — Settings: workspace activity, sessions, role catalog
   - A4 — Routing: test caller simulation
3. [Group B — PATCH field allowlist expansions](#group-b--patch-field-allowlist-expansions-existing-endpoints)
   - B1 — `/api/numbers/{id}` payout & traffic-source fields
   - B2 — `/api/campaigns/{id}` call audio fields
   - B3 — `/api/numbers/{id}` accept `campaign_id: null` to detach
   - B4 — `/api/spam/shields/{id}/` field-shape consistency check
4. [Group C — Wire shape additions](#group-c--wire-shape-additions)
   - C1 — `/api/dni/pools/{id}` detail-page editable fields
   - C2 — `/api/webhooks/` secret + custom headers
   - C3 — `/api/campaigns/{id}` advanced settings persistence
   - C4 — `/api/analytics/{campaigns,buyers,publishers}` Call Summary counters (shipped)
5. [Group D — Cleanup / decisions](#group-d--cleanup--decisions)
   - D1 — `POST /api/numbers/search`
6. [Suggested priority order](#suggested-priority-order)
7. [What the frontend will do when each item ships](#what-the-frontend-will-do-when-each-item-ships)

---

## How this is organized

| Group | What it is | Effort signature |
| --- | --- | --- |
| **A** | Brand-new endpoints. Each unlocks an entire page or panel. | Medium-to-large per item |
| **B** | Existing endpoints that need more PATCH-allowed fields. The frontend already sends these; the backend silently drops them today, so saves appear successful but revert on refresh. | Small per item |
| **C** | Existing endpoints that need new fields added to the wire shape (both read and write). | Small-to-medium per item |
| **D** | Endpoints that exist but nobody calls. Decide: wire to UI or remove. | Trivial |

---

## Group A — New endpoints (high-impact user-visible features)

### A1 — Integrations catalog

**Status now.** The Integrations marketplace page renders a hard-coded
catalog of ~12 third-party apps (`MOCK_INTEGRATIONS`). Connect/disconnect
toggles only change local UI state — nothing persists.

**What we need.**

```http
GET /api/integrations/
→ 200 {
    "items": [
      {
        "id":           "string (slug, e.g. 'salesforce')",
        "name":         "string",
        "description":  "string",
        "category":     "crm | analytics | telephony | billing | other",
        "color":        "string (hex, e.g. '#1976d2' — used as logo tile background)",
        "mark":         "string (1–2 char monogram, e.g. 'SF')",
        "connected":    "boolean",
        "connected_at": "iso-8601 | null"
      }
    ]
  }

POST   /api/integrations/{id}/connect      → 200 (or 302 to OAuth start URL)
DELETE /api/integrations/{id}/disconnect   → 204
```

The first endpoint alone is enough to ship the catalog. Connect/disconnect
can land in a follow-up.

---

### A2 — AI Chat

**Status now.** The AI Insights chat panel uses canned responses
(`MOCK_CHAT_SUGGESTIONS` + `CHAT_REPLIES`) with a fake `setTimeout`
"thinking" delay.

**What we need.**

```http
POST /api/ai/chat
body: { "question": "string", "session_id"?: "string (uuid, for follow-ups)" }
→ 200 {
    "session_id":  "string (uuid)",
    "answer":      "string",
    "suggestions"?: [{ "id": "string", "question": "string" }]
  }
```

**Question for the backend team.** If real chat isn't on the roadmap, tell us
— the frontend will remove the panel rather than ship something fake.

---

### A3 — Settings: workspace activity, sessions, role catalog

**Status now.** Three settings sub-screens render entirely from
`WORKSPACE_ACTIVITY`, `MOCK_SESSIONS`, `ROLES_IN_ORDER` mocks.

**What we need.**

#### Workspace activity log

```http
GET /api/accounts/workspace/activity?page=&page_size=
→ Paginated of:
  {
    "id":           "string (uuid)",
    "actor_id":     "string (uuid)",
    "actor_name":   "string",
    "action":       "string (e.g. 'campaign.created', 'buyer.paused')",
    "target_type":  "string (e.g. 'campaign', 'buyer')",
    "target_id"?:   "string (uuid)",
    "target_name"?: "string",
    "created_at":   "iso-8601"
  }
```

#### Active sessions

```http
GET /api/accounts/workspace/sessions
→ [{
    "id":             "string (uuid)",
    "user_id":        "string (uuid)",
    "user_name":      "string",
    "ip":             "string",
    "location"?:      "string (e.g. 'Austin, TX')",
    "user_agent":     "string",
    "last_active_at": "iso-8601",
    "current":        "boolean (true for the requesting session)"
  }]

DELETE /api/accounts/workspace/sessions/{id}   # revoke session
→ 204
```

#### Role catalog

```http
GET /api/accounts/roles
→ [{
    "id":           "admin | manager | agent | buyer | publisher | viewer",
    "name":         "string",
    "description":  "string",
    "capabilities": ["call.view", "buyer.edit", "campaign.create", ...]
  }]
```

The role catalog is the cheapest of the three — even a hard-coded list
returned by the API is fine; the frontend just needs it from a single
source of truth.

---

### A4 — Routing: test caller simulation

**Status now.** "Test caller" button on the routing detail page shows a
"coming soon" toast.

**Question for the backend team.** Is graph simulation on the roadmap? If
yes:

```http
POST /api/routing/rules/{rule_id}/simulate
body: {
  "caller_number":  "string (E.164)",
  "caller_state"?:  "string",
  "caller_country"?: "string"
}
→ 200 {
    "matched_conditions": [{ "condition_id": "string", "matched": "boolean" }],
    "selected_destination"?: {
      "id":         "string",
      "name":       "string",
      "buyer_name": "string",
      "weight":     "int",
      "priority":   "int"
    },
    "trace": [{ "step": "string", "outcome": "string" }]
  }
```

If not, say so and the frontend will remove the button.

---

## Group B — PATCH field allowlist expansions (existing endpoints)

These endpoints exist and work. We just need more fields accepted in the
PATCH body **and** echoed back in the response so the response-reconcile
pattern doesn't revert the optimistic UI. The frontend already collects
these values; right now they're either dropped on the wire or silently
ignored by the backend.

### B1 — `PATCH /api/numbers/{id}` — payout & traffic-source fields

The Tracking Number edit dialog
(`components/campaigns/settings/tracking-number-edit-dialog.tsx`) collects
these but the service drops them because they're not accepted.

**Please add to the PATCH-allowed field list AND echo back in the GET / PATCH responses:**

```
label                   string?
allocated_capacity      int?
cap_enabled             boolean?
daily_cap               int?
monthly_cap             int?
concurrency_enabled     boolean?
concurrency_cap         int?

publisher_id            string (uuid)?
vendor_enabled          boolean?
payout_per_call         decimal?
payout_type             "amount" | "percentage"?
payout_on               "converted" | "connected" | "length"?
dupe_revenue            "disabled" | "enabled" | "time_limit"?
dupe_revenue_days       int?

traffic_source_enabled  boolean?
traffic_source_id       string (uuid)?
```

**User impact.** Every editable field in the per-number edit dialog
currently reverts on save unless it's `campaign_id` or `status`. This
single allowlist expansion fixes the entire dialog.

---

### B2 — `PATCH /api/campaigns/{id}` — call audio fields

The CampaignWire shape already documents these on the **read** side
(`recording_enabled`, `greeting_enabled`, `greeting_message`,
`whisper_enabled`, `whisper_message`) but **writes** don't accept them.

**Please add to PATCH allowlist:**

```
recording_enabled            boolean?
greeting_enabled             boolean?
greeting_message             string?
whisper_enabled              boolean?
whisper_message              string?
duplicate_call_block         boolean?
duplicate_call_block_hours   int?
```

**User impact.** Powers the "Auto Record Calls" / "Greeting" / "Whisper" /
"Duplicate Handling" toggles in the campaign settings page — currently all
12 advanced-settings cards persist to localStorage only (see C3 for the
full fix).

---

### B3 — `PATCH /api/numbers/{id}` — accept `campaign_id: null` to detach

**Status now.** The "Detach" button under Campaign → Tracking Numbers sends
`{"campaign_id": null}` to clear the FK. Either the backend serializer
rejects null (`allow_null=False`) or it silently keeps the old value —
either way, the number reappears in the campaign after refresh.

**Please confirm:** `campaign_id` on the serializer has `allow_null=True,
required=False`, and the FK column on the model is nullable. After the fix,
sending `null` should clear the association and the GET response should
return `"campaign_id": null`.

---

### B4 — `PATCH /api/spam/shields/{id}/` — field-shape consistency check

Per the last round, the list endpoint was fixed to include
`blocked_carriers`. **Sanity check ask:** please confirm both the list AND
detail responses include all of `name`, `campaign_ids`, `is_active`,
`blocked_carriers` consistently. Helps us avoid the "list returns less than
detail" failure mode that caused the original silent-revert bug.

---

## Group C — Wire shape additions

### C1 — `/api/dni/pools/{id}` — detail-page editable fields

The number-pool detail page edits these fields but they're missing from the
wire shape on both reads and writes, so they disappear on refresh.

**Please add to both GET response and PATCH body acceptance:**

```
replacement_number       string?                                           # the number to replace with one from the pool
phone_number_format      "E164" | "national" | "international"?
vendor_enabled           boolean?
vendor_id                string (uuid)?
traffic_sources_enabled  boolean?
traffic_sources          [{ "id", "name", "integration", "events", "conversions" }]?
```

Single and list endpoints should both include these.

---

### C2 — `/api/webhooks/` — secret + custom headers

The Webhook dialog already collects a signing **secret** + arbitrary
**custom header pairs**. We send `name`/`url`/`events` today and let those
two fields die on the wire.

**To round-trip them:**

```http
POST /api/webhooks/
body: {
  "name":     "string",
  "url":      "string (url)",
  "events":   ["string", ...],
  "secret"?:  "string (optional; backend can generate one if absent)",
  "headers"?: [{ "key": "string", "value": "string" }]
}
→ 201 { ..., "secret": "string", "headers": [{...}, ...] }
```

**The secret should be returned ONCE on create + visible on detail.**
Rotation via:

```http
POST /api/webhooks/{id}/rotate-secret
→ 200 { "secret": "string (new value)" }
```

Use the secret to HMAC-SHA256 sign delivery payloads (header:
`X-Avortyx-Signature`).

---

### C3 — `/api/campaigns/{id}` — advanced settings persistence

**The big one.** There are 12 advanced-settings cards on the Campaign
detail page (Filter, Call Queue, Auto Record, Spam Filter, Business Hours,
Call Length, RTB, VoIP Shield, etc.). Right now they all persist to
`localStorage` only.

**Suggested simplest path — one JSON field on the campaign:**

```http
PATCH /api/campaigns/{id}
body: { "advanced_settings": { /* arbitrary JSON */ } }
→ 200 { ..., "advanced_settings": {...} }
```

The frontend manages the schema; the backend just accepts and echoes the
blob. **One field added to the campaign resource unblocks 12 currently-broken
UI surfaces at once.**

**Alternative if you prefer typed columns:** we can split each setting into
its own typed field, but the JSON blob is the smallest diff for you. Let
us know your preference.

---

### C4 — `GET /api/analytics/campaigns` | `/buyers` | `/publishers` — Call Summary counters

**Status: shipped (2026-09-20).** All three endpoints return the full row
for a `date_from` / `date_to` range and the Reports → Call Summary
Campaign / Buyer / Publisher tabs read every counter from them:

| Column | Field | Backend definition |
|---|---|---|
| Incoming | `total_calls` | |
| Connected | `connected_calls` | completed or in-progress |
| Not Connected | `not_connected_calls` | everything else (sums with Connected to `total_calls`) |
| Qualified | `qualified_calls` | |
| Paid | `paid_calls` | converted on a campaign with a payout set |
| Converted | `converted_calls` | |
| Dupe | `duplicate_calls` | |
| Live | `live_calls` | ringing or in-progress |
| TCL | `total_duration_sec` | Σ duration across all calls |
| ACL | *(frontend: TCL / Connected)* | |
| Revenue / Payout | `total_revenue` / `total_payout` | |

The other tabs (Destination, Date, Traffic source, …) still sum the call
log, using the per-record `is_qualified`, `is_converted`, `is_duplicate`
flags (all present on `/api/analytics/calls` since 2026-09-20; the
`is_qualified` / `is_converted` / `is_duplicate` / `is_spam` query filters
also work now).

Frontend caveat: an aggregate is per entity for the whole range, so a tab
only uses it when no *other* entity filter or status filter is active on
the page — otherwise that tab falls back to the call-log sum.

---

## Group D — Cleanup / decisions

### D1 — `POST /api/numbers/search`

The service is exposed in the frontend but nothing calls it. **What's the
intended use case?**

- If it's "find an available number to purchase," that'd be a great
  addition to the carrier-search flow on the Numbers page — say the word
  and we'll wire it up.
- If it's deprecated, the frontend will delete it.

---

## Suggested priority order

If you'd like a recommended sequence (smallest blast radius / highest user
impact first):

1. **Group B (all four items)** — smallest, all touch existing endpoints.
   Unblocks every "edit doesn't persist" complaint. Probably one afternoon.
2. **C2 (webhook secret + headers)** — small, high-value for the
   security/integration story.
3. **C3 (campaign `advanced_settings` JSON blob)** — simplest path to
   unblock 12 UI surfaces at once. Single field on the model.
4. **A3 (workspace activity / sessions / role catalog)** — three separate
   endpoints but they're read-mostly with simple shapes.
5. **A1 (integrations catalog)** — depends on whether you have a partner
   list ready or it's still TBD.
6. **A2 (AI chat) + A4 (routing simulate)** — decide if they're on the
   roadmap or we remove the UI surfaces.
7. **C1 (DNI pool extra fields)** — last; smaller user-facing impact than
   the others.

---

## What the frontend will do when each item ships

For each backend ask, here's exactly what changes on the FE side. Use this
table to plan when each item is "really done" end-to-end:

| Ask | FE change on delivery | Estimated FE effort |
| --- | --- | --- |
| A1 | Build `useIntegrationsStore`, replace `MOCK_INTEGRATIONS`, wire connect/disconnect | 2–3 hours |
| A2 | Build `useAiChatStore`, replace `MOCK_CHAT_SUGGESTIONS` + `CHAT_REPLIES` | 1–2 hours |
| A3 | Three small stores (workspace activity, sessions, roles) wired to the existing settings sections | 3–4 hours |
| A4 | `<TestCallerDialog>` calling the new endpoint, or remove the button | 1 hour |
| B1 | Extend `numbersService.update` body builder + `NumberWire` to include the new fields | 30 min |
| B2 | Add the audio fields to `Campaign` FE type and `campaignsService.update` body | 30 min |
| B3 | Already done — sending `null` works as soon as serializer accepts it | 0 |
| B4 | Already done — depends on backend status | 0 |
| C1 | Extend `PoolWire` + `poolsService` update body | 30 min |
| C2 | Wire `secret` + `headers` in `WebhookDialog` → `webhooksService.create/update` | 1 hour |
| C3 | Wire `useCampaignSettingsStore` to PATCH the `advanced_settings` blob on every change, replace `localStorage` with backend-driven state | 1–2 hours |

---

## Final notes

- **No remaining frontend-only work is blocking us.** Every open item in
  the portal depends on one of the asks above (or is intentionally
  roadmap-deferred, like the IVR drag-canvas editor).
- **For each item, the frontend will own integration the day it ships** — no
  cross-team coordination needed beyond confirming the shape matched.
- **Happy to discuss priorities, wire shapes, or any concerns about
  specific fields** before you start any of them.

Reach out anytime. We're ready to ship as each item lands.

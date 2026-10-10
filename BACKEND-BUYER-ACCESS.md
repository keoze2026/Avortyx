# Buyer access (permissions + time zone): backend work

**From:** frontend · **For:** backend developer · **Priority:** ASAP (boss request)
**Frontend status:** done. Edit buyer and the buyer's Settings tab now look like a publisher's settings. They show the time zone, Members, **Permissions (Block Numbers, Download Reports)** and Reporting Visibility. Until the endpoints below exist, the time zone and permissions are kept **in the admin's browser only**, and the screen shows a yellow notice saying so.

---

## Problem statement
The boss wants to control what each **buyer login** can do, the same way we do for publishers. Manage Traffic, Number Creation and Audio Recording are left out; they are for publishers only.

| Setting | Meaning |
|---|---|
| **Block Numbers** | The buyer's users may block caller numbers. Calls from those numbers are no longer sent to that buyer. |
| **Download Reports** | The buyer's users may download / export their reports (CSV / Excel). |
| **Time zone** | The zone the buyer's reports are counted in (where "today" starts). |

**Already working, no change needed:**
- members: `POST /api/buyers/{id}/invite` and removing a member;
- reporting visibility: `GET/PUT /api/buyers/{id}/reporting-config`.

---

## 1. Model + migration
Add to `Buyer`:

```python
timezone = models.CharField(max_length=64, default='UTC')
can_block_numbers = models.BooleanField(default=False)
can_download_reports = models.BooleanField(default=False)
```

## 2. Endpoints (admin / owner only, `Capability.EDIT`, same organization)

**`GET /api/buyers/{id}/access`** returns:

```json
{ "timezone": "America/New_York",
  "permissions": { "block_numbers": false, "download_reports": true } }
```

**`PATCH /api/buyers/{id}/access`**
- Request body: the same shape. Every field is optional; save only the fields that are sent.
- Response: the same shape as GET.
- Validate `timezone` with `zoneinfo.ZoneInfo(...)`. If it is invalid, return **400** `{"detail": "Unknown time zone"}`.

The frontend already calls these exact URLs. It reads `permissions.block_numbers` and `permissions.download_reports`.

## 3. Tell the frontend who may do what
For a user who is a **buyer member**, add this to `GET /api/accounts/me`:

```json
"partner_timezone": "America/New_York",
"partner_permissions": { "block_numbers": false, "download_reports": true }
```

With that, the frontend can hide the Download and Block buttons for that user (next frontend step).

## 4. Enforce it on the server (the important part)
The buttons being hidden is not enough. The API must refuse.

**Download Reports**
- If the buyer user's buyer has `can_download_reports = False`, then every export / download endpoint returns **403** `{"detail": "Your account is not allowed to download reports"}`.
- This includes `GET /api/analytics/calls/export` and any other endpoint that returns CSV / Excel.
- Viewing reports on screen stays allowed.
- Admins are never affected.

**Block Numbers**
- If `can_block_numbers = False`, a buyer user gets **403** on create / delete in the blocked-numbers API.
- If `True`, a buyer user may add or remove blocks **for their own buyer only**:
  - add a nullable `buyer` FK to the blocked-number model;
  - a buyer's own blocks are saved with their buyer;
  - a buyer user can list only those blocks.
- Routing: if the caller is on a **buyer's** block list, **skip that buyer** and try the next buyer / destination. Do not reject the whole call. Organization-wide blocks (no buyer) work exactly as today.

**Time zone**
- For a buyer user, if a reports / analytics request has no `timezone` parameter, count days in the buyer's `timezone`.

## 5. Optional: publishers, same pattern
Publisher Permissions and the publisher time zone are still saved only in the browser too (the yellow "Preview" notice on the publisher screen). For publishers, `GET/PATCH /api/publishers/{id}/access` with the same shape, plus the 3 extra permissions (`manage_traffic`, `number_creation`, `audio_recording`), would finish that as well.

---

## Acceptance tests
| # | Do | Expected |
|---|---|---|
| 1 | Admin → Buyers → Edit (Q32) → switch **Download Reports** on, reload the page | Still on. The yellow "this browser only" notice is gone. |
| 2 | `GET /api/buyers/{id}/access` | Returns the values saved in test 1 |
| 3 | Buyer user (Download Reports **off**) calls the export endpoint | **403** |
| 4 | Same buyer, admin switches it **on** | Export works |
| 5 | Buyer user (Block Numbers **off**) tries to block a number | **403** |
| 6 | Block Numbers **on**: buyer blocks +1555…; a call comes from +1555… | That buyer is skipped; the call still goes to another buyer if there is one |
| 7 | Set the buyer time zone to New York; the buyer opens Reports with no zone chosen | "Today" starts at midnight New York time |
| 8 | `GET /api/accounts/me` as the buyer user | Contains `partner_permissions` and `partner_timezone` |

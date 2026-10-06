# Reports PIN — backend work

**For:** backend developer (Django / Django Ninja, `call_platform`)
**Frontend status:** done and tested against the contract below. It already calls these endpoints and already reacts to the `423` reply described in section 4. Nothing in the frontend needs to change when you ship this.

---

## 0. Short version (read this first)

The client wants **one PIN per workspace** that locks **yesterday-and-older report data** for **every login** in that workspace — the main account, buyers, publishers and team members.

Today the PIN exists only in the user's browser (localStorage, plain digits). It protects nothing: it is per browser, buyers and publishers never have it, and anyone can read the data straight from the API. **The PIN has to live on the server and the server has to refuse the data.** That is the whole job:

1. Store one hashed PIN per organization.
2. Let only the main account (role `admin`) create / change / remove it, and only after re-entering their **account password**.
3. Let any login unlock history by entering the PIN (with attempt limiting and a lock-out).
4. On every endpoint that can return data older than today, answer **`423 Locked` with `code: "reports_pin_required"`** unless the caller has unlocked.

---

## 1. What the client asked for (their words, in rules)

| # | Rule |
|---|---|
| 1 | After a PIN is created, yesterday's (and older) reports are only visible after the PIN is entered. |
| 2 | The Reporting section must not show today's live data. |
| 3 | A report for a previous date, opened during live hours, must not carry live figures. Only the **Live / Total in the top header** show them. |
| 4 | Creating, changing or deleting a PIN is only possible after the main user enters the **account password**. |
| 5 | Once a PIN exists, access is locked for **buyers and publishers as well**, not just the main account. |
| 6 | Anything configured under the main account (including access given to publishers, buyers or employees) applies everywhere. |

Rules 2 and 3 are handled in the frontend (Reports now covers completed days only, and the live column/chip are gone from it). **Rules 1, 4, 5 and 6 are yours.**

---

## 2. Assumptions I made (please confirm with the client — each is easy to change)

1. "Password for reporting" in the client's message means the **PIN**.
2. "Main user" = the organization's `admin` role (there is no `owner` role in `accounts.models.User.Role`).
3. **One shared PIN** for the workspace. The admin tells buyers/publishers the PIN; they do not get their own.
4. An unlock lasts **30 minutes** (config `REPORTS_PIN_UNLOCK_MINUTES`), per login session, then locks again.
5. PIN is exactly **4 digits** (matches the existing UI).
6. Tracking numbers / campaign **Monthly and Global counters** shown on list pages (Campaigns, Destinations) are *not* treated as "historical reports" and stay open. Only report data is locked (list in section 5).

---

## 3. Data model

```python
# new app, e.g. `security`

class ReportsPin(models.Model):
    organization = models.OneToOneField("accounts.Organization", on_delete=models.CASCADE,
                                        related_name="reports_pin")
    pin_hash   = models.CharField(max_length=128)         # django.contrib.auth.hashers.make_password(pin)
    version    = models.PositiveIntegerField(default=1)   # bump on every set / change / remove
    updated_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

class ReportsPinUnlock(models.Model):                     # one row per unlocked login session
    user        = models.ForeignKey("accounts.User", on_delete=models.CASCADE)
    session_key = models.CharField(max_length=64)         # see "Session binding" below
    version     = models.PositiveIntegerField()           # must equal ReportsPin.version to count
    expires_at  = models.DateTimeField()

class ReportsPinAttempt(models.Model):                    # wrong-PIN counter, per user
    user         = models.OneToOneField("accounts.User", on_delete=models.CASCADE)
    failed_count = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
```

* Use the **database** (or Redis), **not** `LocMemCache`: with several workers a local cache gives random "locked / unlocked" answers.
* **Never** store, log or return the PIN. Hash it with `make_password` and compare with `check_password`.
* **Changing or removing the PIN bumps `version`** (or deletes the row), which instantly invalidates every existing unlock in the workspace.

### Session binding
Bind an unlock to the login session, not just the user, so signing in on a second device does not inherit it. Best: add a custom `sid` claim (the refresh token's `jti`) when issuing JWTs and read it from `request.auth`'s token. If that is too much work for now, bind to the user only — the 30-minute expiry then limits the exposure.

---

## 4. Endpoints

New router, e.g. `api.add_router("/security/", security_router)` → paths below. All require a valid JWT and are scoped to `request.auth.organization`. The frontend sends JSON bodies in **snake_case** and reads snake_case replies (it converts for itself).

### 4.1 `GET /api/security/reports-pin/status`
Any logged-in user. Never returns the PIN.

```json
{
  "configured": true,
  "unlocked": false,
  "unlock_expires_at": null,
  "can_manage": false,
  "locked_out_until": null,
  "attempts_left": 5
}
```
* `configured` — the organization has a PIN.
* `unlocked` — **this login session** is currently unlocked (`ReportsPinUnlock` exists, `version` matches, not expired).
* `unlock_expires_at` — ISO-8601 time, or `null`.
* `can_manage` — `request.auth.role == "admin"`.
* `locked_out_until` — ISO time while verifying is blocked, else `null`.
* `attempts_left` — wrong tries remaining before a lock-out, or `null` when no PIN.

### 4.2 `PUT /api/security/reports-pin` — create or change
Admin only. Body:
```json
{ "pin": "4321", "current_password": "the admin's login password" }
```
Order of checks: role → password → PIN format.

| Case | Status | Body |
|---|---|---|
| Caller is not `admin` | **403** | `{"detail": "Only the main account can change the PIN.", "code": "not_allowed"}` |
| Password missing / wrong | **400** | `{"detail": "Incorrect account password.", "code": "password_incorrect"}` |
| PIN is not exactly 4 digits | **400** | `{"detail": "The PIN must be exactly 4 digits.", "code": "pin_invalid"}` |
| OK | **200** | the status object (4.1). Bump `version`; the admin who set it is left **unlocked**. |

> Use **400**, not 403, for a wrong password — the frontend treats 401/403 as "session problem".
> Rate-limit wrong-password attempts here too (same counter idea as 4.4); otherwise this endpoint becomes a password-guessing oracle for anyone holding a stolen token. If the admin has MFA enabled, consider also requiring a current TOTP code.

### 4.3 `POST /api/security/reports-pin/remove` — delete
Admin only. Body: `{ "current_password": "…" }`. Same errors as 4.2 (`not_allowed`, `password_incorrect`). OK → **200** status object (`configured: false`). Delete the `ReportsPin` row (or bump `version`) so all unlocks die.

(`POST` rather than `DELETE`-with-a-body: several proxies drop bodies on DELETE.)

### 4.4 `POST /api/security/reports-pin/verify` — unlock this login
Any logged-in user in an organization that has a PIN. Body: `{ "pin": "1234" }`.

| Case | Status | Body |
|---|---|---|
| Correct | **200** | status object with `unlocked: true`, `unlock_expires_at` set. Create/refresh the `ReportsPinUnlock` row; reset the failed counter. |
| Wrong | **400** | `{"detail": "Incorrect PIN.", "code": "pin_incorrect", "attempts_left": 2}` |
| Too many wrong tries | **423** | `{"detail": "Too many wrong attempts.", "code": "pin_locked_out", "locked_until": "2026-10-07T09:15:00Z", "retry_after_seconds": 240}` |

* Allow **5** wrong tries, then block for **5 minutes** (make both settings). A 4-digit PIN has only 10 000 combinations — without this limit it can be brute-forced in minutes.
* **While locked out, refuse even the correct PIN.**
* Count per **user**; also add a per-IP / per-organization throttle so one attacker cannot rotate through accounts.
* Constant-time compare (`check_password` already is).
* If the organization has no PIN: **400** `{"code": "pin_not_set"}`.

### 4.5 `POST /api/security/reports-pin/lock`
Any logged-in user. Deletes this session's `ReportsPinUnlock`. **200** status object (`unlocked: false`).

---

## 5. Enforcement — the part that actually protects the data

> If this section is skipped, the PIN is only decoration again.

**Rule:** when the organization has a PIN, and the request can return anything dated **before today**, and the caller's session is not unlocked → respond

```
HTTP 423 Locked
{ "detail": "Enter the reports PIN to view reports before today.", "code": "reports_pin_required" }
```

The frontend watches for exactly this status + code on **every** request. When it sees it, the whole app switches to the PIN screen and stops requesting history. So a missed endpoint is not a crash — but it is a hole, so cover them all.

**Applies to every login in the workspace, including the main account** (rule 5), buyers and publishers.

### 5.1 What "before today" means
Use the **`timezone`** query parameter the frontend sends on report requests (IANA name, e.g. `America/New_York`). **Reuse the resolver the reports already use** — `_tz(filters)` in `analytics/services.py`, which reads `filters.timezone` and falls back to `timezone.get_current_timezone()` (the server's zone). That way "today" for the PIN is exactly the "today" the report buckets use. (`Organization` has no time-zone field, so there is nothing else to fall back to.) A request is *historical* if its `date_from` / `start_date` is **earlier than today** in that zone. For a single record (a call), compare that record's start time.

### 5.2 Endpoints to protect (found in the current code)

`analytics/api.py` (router mounted at `/api/analytics/`):

| Endpoint | Note |
|---|---|
| `GET /calls` | call log |
| `GET /calls/export` | CSV/Excel export — **easy to forget** |
| `GET /calls/{id}/recording` | audio |
| `GET /calls/{id}/detail` | protect when that call started before today |
| `GET /campaigns`, `/buyers`, `/publishers`, `/carriers` | the Call Summary aggregates |
| `GET /time-series` | hourly/daily charts |
| `GET /dashboard`, `GET /snapshot` | only when `date_from`/`start_date` is before today |
| `GET /caller-profile/{number}` | review: returns history for a caller |

`analytics/scheduled_reports_api.py` (`/api/analytics/reports/`): `run-now` and anything that emails or returns report data. A scheduled report running automatically at 07:00 is fine (the admin configured it); a user pressing **run-now** for a past range must be unlocked.

Also grep for any other endpoint that takes `date_from`, `date_to`, `start_date`, `end_date` or returns old calls (for example per-buyer / per-publisher call lists in `buyers/api.py` and `publishers/api.py`) and apply the same check. Easiest is one shared helper (5.4) called at the top of each.

### 5.3 Requests with **no dates**
`/calls` may be called without dates and return "recent" calls, which include old rows. While locked, **clamp the result to today's rows** (preferred — pages like Call Logs keep working for today) or return 423. Pick one and keep it consistent.

### 5.4 Sketch (illustrative — adapt to your conventions)

```python
class ReportsPinRequired(Exception):
    pass

@api.exception_handler(ReportsPinRequired)
def _pin_required(request, exc):
    return api.create_response(
        request,
        {"detail": "Enter the reports PIN to view reports before today.",
         "code": "reports_pin_required"},
        status=423,
    )

def require_reports_unlock(request, *, date_from=None, tzinfo=None):
    """Call at the top of every endpoint that can return history.

    `tzinfo` = the zone the report uses (reuse analytics' own resolver)."""
    org = request.auth.organization
    pin = getattr(org, "reports_pin", None)
    if pin is None:
        return                                   # no PIN set -> nothing changes
    if not _is_historical(date_from, tzinfo or timezone.get_current_timezone()):
        return                                   # today only
    if _is_unlocked(request, pin):
        return
    raise ReportsPinRequired()

def _is_historical(date_from, tzinfo):
    today = timezone.now().astimezone(tzinfo).date()
    start = parse_date(date_from) if date_from else None
    return start is None or start < today        # no start date = unbounded = includes history

def _is_unlocked(request, pin):
    return ReportsPinUnlock.objects.filter(
        user=request.auth, session_key=_session_key(request),
        version=pin.version, expires_at__gt=timezone.now(),
    ).exists()
```

---

## 6. Security checklist

- [ ] PIN stored with `make_password`; never logged, never returned, never in error text.
- [ ] Attempt limit + lock-out on `verify` (and on the password check in 4.2 / 4.3).
- [ ] Correct PIN refused during a lock-out.
- [ ] Set / change / remove require the admin's **current password** every time (not "remembered").
- [ ] `version` bump invalidates all unlocks on change / remove.
- [ ] Unlock rows expire (30 min) and are bound to the session.
- [ ] Audit log entries for: PIN set / changed / removed (who, when), failed verifies, lock-outs. (There is already a workspace activity log — reuse it.)
- [ ] No endpoint listed in 5.2 returns data before today to a locked caller — **test each one with a buyer token and with a publisher token.**

---

## 7. Decision needed: API keys

`/api/accounts/api-keys` lets an admin issue keys that read reports for integrations. A key cannot type a PIN. Options:
* **A (recommended):** keys are *not* affected by the PIN — the admin issued them deliberately. Document it.
* **B:** keys are refused on historical report endpoints while a PIN exists.

Ask the client which they want; A needs no code, B needs one extra check in the helper.

---

## 8. Acceptance tests

| # | Scenario | Expected |
|---|---|---|
| 1 | No PIN set, any user requests last week's calls | 200, unchanged behaviour |
| 2 | Admin sets a PIN with the right password | 200, `configured: true`, admin `unlocked: true` |
| 3 | Admin sets a PIN with a wrong / empty password | 400 `password_incorrect`, PIN unchanged |
| 4 | Buyer / publisher / agent calls `PUT` or `remove` | 403 `not_allowed` |
| 5 | Buyer requests `GET /analytics/calls?date_from=<yesterday>` | **423** `reports_pin_required` |
| 6 | Same, with `date_from=<today>` | 200 |
| 7 | Publisher `GET /calls/export` for last week | **423** |
| 8 | Publisher requests a recording of yesterday's call | **423** |
| 9 | Buyer posts the correct PIN | 200 `unlocked: true`; step 5 now returns 200 |
| 10 | Buyer posts wrong PIN ×5 | 400 ×4 with `attempts_left` falling, then **423** `pin_locked_out`; correct PIN still refused |
| 11 | Unlock older than 30 minutes | step 5 returns 423 again |
| 12 | Admin changes the PIN | every existing unlock (all users) is invalid immediately |
| 13 | Admin removes the PIN | step 5 returns 200 for everyone |
| 14 | `POST /lock` | step 5 returns 423 immediately |
| 15 | Second device / new login for the same user | starts locked (if session-bound) |
| 16 | Admin (main account) after PIN exists, new session, no unlock | **423** — the rule applies to the main account too |

---

## 9. How the frontend behaves (so you can rely on it)

* On sign-in it calls `GET …/status` for **every role** and keeps nothing in the browser. The old browser-stored PIN is deleted on first load.
* Reports (now yesterday-and-earlier only) sends **no** report requests while locked, and drops what it holds the moment it locks.
* Any `423` + `reports_pin_required` from any endpoint locks the app. The PIN endpoints themselves are exempt from that rule so a `pin_locked_out` 423 is not mistaken for it.
* If `…/status` is missing (404) the frontend treats PIN protection as "not available" and stays out of the way — so you can deploy in any order.
* Request shapes it sends (verified by test):
  ```
  PUT  /api/security/reports-pin          {"pin":"4321","current_password":"…"}
  POST /api/security/reports-pin/remove   {"current_password":"…"}
  POST /api/security/reports-pin/verify   {"pin":"4321"}
  POST /api/security/reports-pin/lock
  ```

## 10. Rollout

1. Migration (3 small tables). Default = no PIN → **no behaviour change** for anyone.
2. Deploy backend, then frontend (either order works).
3. PINs users created in the old browser-only version are gone (they were never real). Admins create the real one from **Settings → Security**.

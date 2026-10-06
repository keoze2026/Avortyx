# Customer portal on its own address (app.avortyx.io)

## What the client asked for

> Create a separate login page on a subdomain for anyone who wants to access their portal. Keep avortyx.com as it is, with the "Request Access" option, but don't allow anyone to sign up or log in through avortyx.com or avortyx.io. When we launch our panel, competitors could sign up with us, use black-hat tactics, and report us to the FCC. It may be safer to keep the login separate and less visible.

In plain words:

| | Public website (`avortyx.com`) | Portal (`app.avortyx.io`) |
|---|---|---|
| Who uses it | Anyone | Only people we have approved |
| Pages | Home, Careers, **Request access** | Log in, dashboard, everything else |
| Log in / sign up | **Does not exist** (the address returns "not found") | Log in only |
| Search engines | Normal | Told not to list it (`noindex`) |
| Where people learn the address | — | Only in the email we send once their request is approved |

## How it is built (nothing new to learn)

One frontend build serves both addresses. `proxy.ts` looks at which address the visitor used:

* **Public address** → shows only `/`, `/careers` and `/request-access`. Every other page answers "404 Not Found" (not a redirect, so the portal's address is never revealed).
* **Portal address** (listed in `PORTAL_HOSTS`) → the marketing pages redirect to `/login`; everything else works, and every response says `noindex`.
* **`PORTAL_HOSTS` not set** → nothing is hidden (local development, demos).

The public site's buttons say **Request access** and open `/request-access`, a form that an admin reviews. When a request is approved the backend emails a setup link built from `FRONTEND_URL` — that email is the only place the portal address is given out.

The backend already refuses self-registration (`OPEN_REGISTRATION` is off), so even a direct call to the API cannot create an account.

---

## Switch-on checklist

Do the steps **in this order**. Steps 1–4 change nothing visible; step 5 is the switch.

### 1. Deploy the new code (frontend + backend)
Frontend: the files from this change. Backend: `config/urls.py` and `accounts/partner_invites.py`.
Safe to do first: with `PORTAL_HOSTS` unset, the site behaves as before except that the "Request access" buttons now open the form instead of an email link.

### 2. Backend environment (`.env` of the Django app)

```
FRONTEND_URL=https://app.avortyx.io            # where customers log in; every email link uses this
PUBLIC_SITE_URL=https://www.avortyx.com        # the public site (referral links, email logo)
CORS_ALLOWED_ORIGINS=https://app.avortyx.io,https://www.avortyx.com,https://avortyx.com,https://avortyx.io
CSRF_TRUSTED_ORIGINS=https://app.avortyx.io,https://avortyx.io,https://www.avortyx.io
# OPEN_REGISTRATION must NOT be set to True (default is closed)
```

Why both origins in CORS: the portal needs it to log in; the public site needs it only for the Request Access form. Restart the backend afterwards.

### 3. DNS and certificate
* Create `app.avortyx.io` pointing at the same place that serves the frontend today.
* Issue a TLS certificate for it.
* The reverse proxy must pass the original address on: either keep the `Host` header or send `X-Forwarded-Host`. (`proxy.ts` reads `X-Forwarded-Host` first.)

### 4. Frontend environment (production)

```
PORTAL_HOSTS=app.avortyx.io          # <- this is the switch (step 5)
# NEXT_PUBLIC_DEMO_MODE            must NOT be set
# NEXT_PUBLIC_PUBLIC_PORTAL_LINKS  must NOT be set (it would put Sign in buttons back on the public site)
NEXT_PUBLIC_API_BASE_URL=...       # unchanged
NEXT_PUBLIC_WS_BASE_URL=...        # unchanged
```
Set the values but do not restart the frontend yet.

### 5. Switch on
Restart / redeploy the frontend. From this moment:
* `https://www.avortyx.com/login`, `/signup`, `/dashboard` … → **404**
* `https://www.avortyx.com/request-access` → the form
* `https://app.avortyx.io/` → redirects to `/login`

### 6. Tell people
* **Existing users** must log in again at `https://app.avortyx.io`. Their saved sign-in lives in the browser *per address*, so it does not carry over from `www.avortyx.com`.
* **Old links stop working**: bookmarks to `www.avortyx.com/dashboard` and any invite / set-password emails sent before the switch (they point at the old address). Re-send any invitations that were still pending.
* Give the new address only to customers, privately.

### Rollback
Unset `PORTAL_HOSTS` and restart the frontend: everything is reachable on the old address again. (Set `FRONTEND_URL` back too if emails should point there.)

---

## Check it worked

```
curl -s -o /dev/null -w "%{http_code}\n" https://www.avortyx.com/login            # 404
curl -s -o /dev/null -w "%{http_code}\n" https://www.avortyx.com/signup           # 404
curl -s -o /dev/null -w "%{http_code}\n" https://www.avortyx.com/dashboard        # 404
curl -s -o /dev/null -w "%{http_code}\n" https://www.avortyx.com/request-access   # 200
curl -s -o /dev/null -w "%{http_code}\n" https://app.avortyx.io/login             # 200
curl -sI https://app.avortyx.io/login | grep -i x-robots-tag                      # noindex, nofollow, noarchive
curl -sI https://app.avortyx.io/ | grep -i location                               # /login
```
Then in a browser: submit a Request Access form on the public site, approve it in the admin, and confirm the email's button goes to `https://app.avortyx.io/set-password?...`. Open an invitation email and confirm the logo loads (it is served from the public site).

---

## What this does and does not protect

* **Hides** the portal: it has no link anywhere on the public site, returns "not found" there, is marked `noindex`, and its address is only ever in emails to approved customers.
* **Stops** sign-up through the website *and* through the API (registration is closed on the server).
* **Does not make the address secret forever.** Anyone given the address can pass it on, and the API address (`avortyx.io`) must stay reachable for the portal to work, so a direct call to its log-in endpoint is still possible — but it needs a real, approved account and is rate-limited.
* The real gate is **who gets approved**. A competitor can still send a Request Access form; vet every request before approving it. Consider requiring two-factor sign-in (MFA) for all accounts.

## Open questions for the client
1. The message says `avortx.io` — is that a typo for `avortyx.io`?
2. Is `app.avortyx.io` the final name? (Only `PORTAL_HOSTS`, `FRONTEND_URL`, DNS and the CORS list change if it moves; no code does.)
3. Should the public site's request form also email the team when a request arrives? (The backend already notifies `PLATFORM_SUPPORT_EMAIL`.)

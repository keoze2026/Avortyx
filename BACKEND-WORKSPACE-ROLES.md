# Workspace roles & permissions: backend work

**From:** frontend · **For:** backend developer · **Priority:** ASAP (Sir's request)

## Problem statement
Sir: *"Workspace is provided to employees so they can manage the portal without being given the main account ID and password. This helps prevent unauthorized activity. Check that all Workspace options are working correctly and verify that access can be granted or added as specified in the Workspace settings under Manager."*

Test done: Workspace → Roles → **Manager → Edit**, untick **Reporting**, Save. Result: Manager still shows **7 / 55**, and the employee with the Manager role **still sees Reports**.

What we found (code checked on both sides):
1. **Role permissions are hardcoded.** `ROLE_CAPABILITIES` in `accounts/permissions.py` fixes what each built-in role can do. `PATCH /api/accounts/workspace/roles/{id}` only works for `CustomRole`, so Manager / Viewer / Agent can never be changed.
2. **Custom roles do nothing.** They are saved, but no member can be given one, and `capabilities_for()` ignores them.
3. **The rights don't match the Roles screen.** The screen has **55 permissions in 21 areas** (Reporting → View / Edit / Listen to Recordings / Download Reports, etc.). The server only knows ~10 broad rights (view, edit, create, delete, billing, members, settings, recordings, block_numbers, export), so "no Reports for Manager" can't be expressed.
4. **"7 / 55" was the count of the 7 broad rights,** not of ticks. The **"viewer"** role isn't in `User.Role` (it only works because unknown roles fall back to VIEW).

## The rule (decided)
For every area on the Roles screen:
- **Area unticked completely** → members of that role can't see that area at all: the page is hidden and every endpoint of that area answers **403**, including reads.
- **View ticked** → they can open and read it.
- **Each other tick** (Edit, Delete, Listen to Recordings, Download Reports, Edit Tracking Numbers…) allows exactly that action, nothing more. Example: Reporting with View ticked and Edit unticked → they can look at reports but not change anything in them.
- **Same for all areas.**

## Permission catalogue (55)
Stored as dotted strings `"<area>.<action>"`, e.g. `"reporting.view"`, `"campaigns.edit-forward"`.

| Area | Key | Actions |
|---|---|---|
| Reporting | `reporting` | `view`, `edit`, `listen`, `download` |
| Campaigns | `campaigns` | `view`, `edit-campaign`, `edit-numbers`, `edit-forward`, `edit-advanced`, `delete` |
| Call Flows | `call-flows` | `view`, `edit`, `delete` |
| Tracking Numbers | `tracking-numbers` | `view`, `edit`, `delete` |
| Number Pools | `number-pools` | `view`, `edit`, `delete` |
| Manage Destinations | `destinations` | `view`, `edit`, `delete` |
| Manage Groups | `groups` | `view`, `edit`, `delete` |
| Ping/Post Log | `ping-post-log` | `view` |
| Rtb Bid Log | `rtb-bid-log` | `view` |
| Buyers | `buyers` | `view`, `edit`, `delete` |
| Vendors | `vendors` | `view`, `edit`, `delete` |
| Traffic Sources (publishers) | `traffic-sources` | `view`, `edit`, `delete` |
| Integrations | `integrations` | `view`, `edit`, `delete` |
| Manage Leads | `leads` | `view`, `delete` |
| Custom Parameters | `custom-parameters` | `view`, `edit`, `delete` |
| VoIP Shield | `voip-shield` | `view`, `edit`, `delete` |
| Dispute | `dispute` | `view` |
| TCPA Shield | `tcpa-shield` | `view` |
| Billing | `billing` | `view`, `edit` |
| Blocked Numbers | `blocked-numbers` | `view`, `edit`, `delete` |
| Global Offers | `global-offers` | `view` |

The frontend's list is in `lib/workspace-permissions.ts` (`PERMISSION_GROUPS`).

## What to build

### 1. Store role permissions per workspace (database, not code)
- **Model:** `WorkspaceRole(organization, slug, name, description, permissions: JSON list, is_builtin)`. Reuse `CustomRole` if easier.
- **Seed every workspace's built-in roles** with these defaults:
  - **admin:** all 55, **locked** (can't be edited, so a workspace can never lock itself out). Admin also keeps members / billing / settings.
  - **manager:** the frontend's `defaultManagerRestrictedPermissions()`. In short:
    - Reporting: all 4.
    - Campaigns: view, edit-campaign, edit-forward, edit-advanced.
    - View + edit (no delete) on call-flows, tracking-numbers, number-pools, destinations, groups, buyers, vendors, traffic-sources, integrations, custom-parameters, voip-shield, blocked-numbers.
    - ping-post-log view, leads view, billing view.
  - **viewer:** every `view`, nothing else. Please add `viewer` to `User.Role`.
  - **agent:** keep today's behaviour mapped onto the ticks: views plus edits, no deletes.

### 2. Endpoints (admin only, `Capability.MEMBERS`)
**`GET /api/accounts/workspace/roles`** returns built-in and custom roles. Each role:
```json
{ "id": "manager", "slug": "manager", "name": "Manager", "description": "...",
  "is_builtin": true, "capabilities": ["reporting.view", "reporting.edit", "..."],
  "member_count": 1 }
```
For custom roles, `id` is the UUID.

The frontend reads the dotted list from **`capabilities`**, and sends it with that name.

**`PATCH /api/accounts/workspace/roles/{id_or_slug}`**
- Body: `{ name?, description?, capabilities? }`.
- Must work for built-in slugs too (`manager`, `viewer`, `agent`), not only UUIDs. Today a slug gives 404/500.
- Refuse `admin`.
- Drop or refuse unknown keys.

**`POST /api/accounts/workspace/roles`** creates a custom role (unchanged).

**`DELETE /api/accounts/workspace/roles/{id}`** deletes a custom role. Refuse it while members still have that role.

### 3. Members can have custom roles
- `POST /workspace/members/invite` and `PATCH /workspace/members/{id}` accept `role` = a built-in slug **or** a custom role id. Validate that it exists in this workspace.
- At the moment any string is saved without checking.

### 4. Enforce it on every request
- **Add a helper:** `require_perm(user, "reporting", "view")`.
  - Admins and superusers always pass.
  - Buyer and publisher logins keep their own Partner Access rules, unchanged.
  - Employees pass only if their role's permissions contain the key.
- **Apply it per area:**
  - `GET` → `view`
  - create / update → `edit`, or the specific edit tick below
  - `DELETE` → `delete`
- **Specific ticks:**
  - Reporting → `listen` for call recordings, `download` for every export / CSV / Excel endpoint.
  - Campaigns:
    - `edit-campaign` for the basic campaign fields;
    - `edit-numbers` for attaching tracking numbers;
    - `edit-forward` for the forward-to destinations / routing targets;
    - `edit-advanced` for advanced settings (duplicates, recording, queue…);
    - `delete` for deleting a campaign.
- **Page → area (the frontend uses the same mapping):**

| Page | Area |
|---|---|
| Reports, Call Logs | `reporting` |
| Campaigns | `campaigns` |
| Phone Numbers | `tracking-numbers` |
| Routing, IVR, Call Queue | `call-flows` |
| Destinations | `destinations` |
| Buyers | `buyers` |
| Publishers | `traffic-sources` |
| VoIP Shield | `voip-shield` |
| TCPA Shield | `tcpa-shield` |
| Blocked Numbers | `blocked-numbers` |
| Billing | `billing` |
| Integrations, Marketplace | `integrations` |

- Members management and workspace settings stay **admin only**.

### 5. Tell the frontend
`GET /api/accounts/me` for an employee login adds:
```json
"permissions": ["reporting.view", "campaigns.view", "..."]
```
These are the **effective** permissions of their role. For an admin, send all, or omit the field.

## What the frontend has done (ready now; it switches on when your part is live)
- **Roles → Edit** now edits **that** role:
  - it loads the role's saved ticks, name and description;
  - **Save** sends `PATCH /workspace/roles/{slug or id}` with `capabilities`.
  - Before, Edit opened a blank "create a role" form, so saving made a new role and Manager never changed.
- **New role** button → create a custom role. Admin is shown locked.
- **Roles table:** counts real ticks (x / 55) and lists custom roles.
- **Menu and pages:** read `permissions` from `/me`. An area with **View** unticked disappears from the menu, and opening its page directly goes back to the Dashboard with "Your role doesn't have access".
- **Before your part:** nothing changes for anyone until `/me` sends `permissions`.

**Why the frontend alone is not enough:**
- Hiding a menu item doesn't stop someone calling the API directly, so only your 403s actually protect the data.
- "View but not Edit" inside a page is also enforced by your 403 on the save.

## Acceptance tests
| # | Do | Expected |
|---|---|---|
| 1 | Roles → Manager → untick all of Reporting → Save | Manager count drops by 4; reload → still unticked |
| 2 | Manager employee: reload | Reports and Call Logs gone from the menu; `GET /api/analytics/calls` → 403 |
| 3 | Tick Reporting → View only | Reports visible; changing anything there → 403; export → 403 |
| 4 | Tick Download Reports | Export works |
| 5 | Campaigns: View on, Delete off | Deleting a campaign → 403 |
| 6 | New role "Compliance" with Reporting View only → assign to a member | That member sees only Reports (read-only) |
| 7 | Try to edit Admin | Refused |
| 8 | Delete a custom role that still has members | Refused |
| 9 | `GET /api/accounts/me` as the Manager | Contains `permissions` with the saved ticks |

# Change Log — Avortyx Portal (frontend)

Running record of portal changes, newest at the bottom. Each change has an ID;
the backend half of a change, when there is one, has the same ID in the backend
repository's CHANGES.md.

Entries from CH-147 (19 Oct 2026) are written from each change's own commit
message. "Commit: see git log --grep CH-xxx" means the change was applied from a
patch; search the log for its ID.

## CH-147 - Hide buttons without a tick, compact activity log in portal time zone
**2026-10-19 · Portal**

Commit: `4efabae2`.

## CH-148 - Daily News and Coin Market open instantly (warm cache, prefetch, no flash)
**2026-10-19 · Portal**

Commit: `c44885f8`.

## CH-149 - Solid top bar on phones, closed donut ring, full Autopilot options
**2026-10-20 · Portal**

Commit: `c2725194`.

## CH-150 - Members in one blue colour, ordered Admin, Manager, Billing, Viewer, Publisher, Buyer
**2026-10-20 · Portal**

Commit: `f9f9be5f`.

## CH-151 - Show No Destination instead of Destination Missed
**2026-10-20 · Portal**

Commit: `7948470c`.

## CH-152 - Call Summary: copy TFN without filtering, filter button per row, Show all calls bar
**2026-10-20 · Portal**

Commit: `8b753e08`.

## CH-153 - Call Summary: double-click copies TFN, click never clears, Reset filter bar
**2026-10-20 · Portal**

Commit: `0e5601a7`.

## CH-154 - Owner > Carrier Costs page
**2026-10-20 · Portal**

Commit: `60ef6b79`.

## CH-155 - Show High / Low risk under Campaign (badge, TFN table column, list column)
**2026-10-20 · Portal**

Commit: `97a11bfc`.

## CH-157 - Reports: one loading panel until the report data is ready, no half report on refresh
**2026-10-20 · Portal**

Commit: `93785579`.

## CH-158 - Type column (High Risk / Low Risk), fix raw labels, order High Risk first then Low Risk by assigned date
**2026-10-20 · Portal**

Commit: `151215db`.

## CH-159 - Remove risk badge from Campaigns list and campaign header, keep it on TFNs
**2026-10-20 · Portal**

Commit: `efb01233`.

## CH-160 - Add X to clear the Reports call log search
**2026-10-20 · Portal**

Commit: `cd9adc33`.

## CH-162 - Reports call log: align the Fail Reason column to the left
**2026-10-20 · Portal**

Commit: `3e4a4697`.

## CH-161 - Blocked Numbers card on the publisher Edit page
**2026-10-20 · Portal**

Commit: `0008a11d`.

## CH-163 - Publisher Blocked Numbers: caller lookup from recent calls, Fail Reason centred and aligned
**2026-10-20 · Portal**

Commit: `f2067c84`.

## CH-164 - Fail Reason: block centred under its header, dash centred, words aligned
**2026-10-20 · Portal**

Commit: `9cbc25ae`.

## CH-165 - Tracking numbers table: Publisher and Payout centred and aligned like Fail Reason
**2026-10-20 · Portal**

Commit: `612d08c1`.

## CH-167 - Tracking numbers table: Publisher and Payout values centred
**2026-10-20 · Portal**

Commit: `fcad4f09`.

## CH-168 - Tracking numbers: Name, Publisher and Payout start at the same place, centred under the heading
**2026-10-20 · Portal**

Commit: `996fc4d9`.

## CH-169 - Fail Reason: words aligned in two columns
**2026-10-20 · Portal**

Commit: `e65f40fb`.

## CH-170 - Fail Reason: block centred exactly under the header
**2026-10-20 · Portal**

Commit: `f63232e2`.

## CH-173 - Reports: no half report after a refresh, call log keeps its rows while reloading
**2026-10-20 · Portal**

Commit: `5316eee3`.

## CH-174 - Publisher logins get a Blocked Numbers page when Block Numbers is on
**2026-10-20 · Portal**

Commit: `9a781aec`.

## CH-178 - Call log: live calls show a running duration
**2026-10-21 · Portal**

Commit: `3746d891`.

## CH-179 / CH-180 - TFNs deleted notice in the bell; bulk select on campaign tracking numbers
**2026-10-21 · Portal**

Commit: `83c5577d`.

## CH-181 - No export button for roles without Reporting Download
**2026-10-21 · Portal**

Commit: `e047de3c`.

## CH-182 / CH-183 - TFNs deleted notice stays in the bell until 12 PM Eastern; Name centred in tracking numbers
**2026-10-21 · Portal**

Seen numbers are kept in the browser and shown dimmed until the next
12 PM Eastern; Seen still clears the bell count and the banner.

Commit: `343f9abf`.

## CH-184 - Deleted TFNs bell follows the CH-182 backend; tracking number names centred as one block
**2026-10-21 · Portal**

Commit: `cb2dcd1e`.

## CH-185 - Blocked callers red everywhere; Blocked by column
**2026-10-21 · Portal**

Commit: `1f3532f7`.

## CH-186 - Carrier Costs centred; Routing cost section
**2026-10-21 · Portal**

Commit: `0255672c`.

## CH-190 - Switch on the translation files that were never registered (Carrier Costs, Owner, routing cost, risk labels)
**2026-10-21 · Portal**

**Also:** Add the two translation files the registration needs

**Also:** Translation sweep part 2a: numbers table, acronyms, KYC, security, autopilot, support, billing and more in all languages

**Also:** Translation sweep part 2b: routing, marketplace, white label, access requests, sign-in pages and remaining screens in all languages

Commit: `bfee85f7`, `d95afae3`, `4c41e27d`, `c988a1e4`.

## CH-191 - Add numbers: High/Low Risk column and filter instead of Region; numbers already on a campaign never listed
**2026-10-21 · Portal**

Commit: `4da667ed`.

## CH-192 - Numbers Edit dialog: Publisher field with No publisher option
**2026-10-21 · Portal**

Commit: `e1d3b28d`.

## CH-193 - No Answer fail reason translated
**2026-10-21 · Portal**

Commit: `bb0d2ac4`.

## CH-195 - Rename a campaign from its page
**2026-10-21 · Portal**

Commit: `9f19d4b0`.

## CH-198 - Cloning a campaign copies its routed destinations
**2026-10-22 · Portal**

Commit: `db79cbe9`.

## CH-199 - TFNs Expired notice: short message, numbers only
**2026-10-22 · Portal**

Commit: `d6fd6f33`.

## CH-200 - Show who switched a line on or off
**2026-10-22 · Portal**

**Also:** Line switch record shown in Workspace Activity only

Commit: `70a899ba`, `5090278b`.

## CH-203 - No automatic switching from browser tabs
**2026-10-22 · Portal**

Commit: `df4f2a70`.

## CH-204 - Routed destinations: revenue centred
**2026-10-22 · Portal**

Commit: `9d7873f9`.

## CH-208 - Call volume spike shown as Good News, not Critical
**2026-10-22 · Portal**

Commit: `fc76c622`.

## CH-212 - LIVE column on Routed Destinations and Tracking Numbers
**2026-10-22 · Portal**

Commit: `109489f4`.

## CH-202 - Remove the Minimum calls before judging a buyer row
**2026-10-23 · Portal**

Commit: `1616e08d`.

## CH-210 - Alerts show readable metric names
**2026-10-23 · Portal**

Commit: `a049aedc`.

## CH-214 - TFN Check page, public check links and share-link management
**2026-10-23 · Portal**

Sir asked for our own version of XOLO's number lookup (backend CH-213).

- Traffic > TFN Check: paste up to 200 numbers, press Check, and each one
  reads Working, Active, Not Working, Not In Service, Paused, Expired or
  Not Found, with a short reason and its last call. Summary chips filter
  the list; results can be copied. Optionally places a real test call to
  each live number (up to 20) and refreshes by itself while they run.
- Share Links: make a private link (all numbers, or one publisher's),
  copy it, open it, see how often it is used, cancel it. Each link shows
  its API command (curl) for automatic checks.
- /check/<token>: the public page a link opens. No login, no calls placed,
  a legend of what each status means, and a clear message for a cancelled
  link. Kept out of search engines.
- All texts in English, Russian, Japanese and Chinese.

Commit: `10ebecd9`.

## CH-217 - Repeated column, portal-coloured month picker, topbar on tablets, partner columns after refresh
**2026-10-23 · Portal**

- Reports: a Repeated column in the Call Log (Yes/No, sortable, exported),
  and the Call Summary's Dupe is now Repeated (Sir: "Instead of Dup use
  Repeated"). A partner's Reporting visibility for it hides both.
- Owner > Carrier Costs: the month field opens a picker drawn in the
  portal's colours instead of the browser's white popup. Native date and
  time popups everywhere follow the portal's theme, not the computer's.
- Topbar: on iPhone and iPad the frosted bar smeared Live and Total into
  streaks when the sidebar was open. Touch screens get the solid bar, the
  stats no longer sit in a scroll box, and what fits is decided by the bar's
  own width (container query), so an open sidebar counts.
- Publisher and buyer logins: a page refresh showed only the Live column in
  the Call Summary until three requests had answered. The allowed columns
  are now kept on the device and shown straight away, then re-checked.

Commit: `fc46fb79`.

## CH-218 - Carrier Costs: Today, Yesterday, Week, Month, then dates; EST instead of Eastern
**2026-10-23 · Portal**

Sir, 23 Oct: "Today Then Yesterday Then Week Then Month and then Dates",
and "EST not Eastern".

- Routing cost presets are Today, Yesterday, This week (Monday to today,
  EST), This month, then the From/To dates.
- "Eastern" reads "EST" wherever the portal shows it: the TFN Expired
  notice ("Shown here until 12 PM EST"), the routing cost Day column, the
  autopilot business-hours text and the campaign time zone choices, in all
  four languages.

Commit: `2e409227`.

## CH-220 - Reports update by themselves with auto refresh Off; "Updated" time
**2026-10-23 · Portal**

Today's report asks the backend every 10 seconds whether anything changed
(CH-219 report stamp) and reloads quietly only when a call arrived, was
answered or ended - whatever the auto refresh setting. Beside the Refresh
button, "Updated 4:27:05 PM" shows the server time the figures on screen
were last confirmed current, in the report's time zone.

Commit: see `git log --grep CH-220`.

## CH-228 - Tracking Numbers: even column spacing, every heading centred
**2026-10-23 · Portal**

The headings under Tracking Numbers sat at uneven gaps: the column widths
followed their content and some headings were left-aligned while others were
centred. The table now uses a fixed layout with one width for every data
column, and every heading and value is centred under it. It scrolls sideways
on a phone instead of squeezing.

Commit: see `git log --grep CH-228`.

## CH-229 - "No Hangup Report" reads "Not Connected"
**2026-10-23 · Portal**

A call whose end the switch never reported is closed by the clean-up with an
internal code (stale_timeout / asterisk_gone), shown since CH-178 as
"No Hangup Report". It rang and nobody answered it, so it now reads
"Not Connected" like any other unanswered call, on screen and in the
export, in every language (Sir, 23 Oct).

Commit: see `git log --grep CH-229`.

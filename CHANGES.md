# Change Log — Avortyx Portal (frontend)

Running record of portal changes, newest at the bottom. Each change has an ID;
the backend half of a change, when there is one, has the same ID in the backend
repository's CHANGES.md.

The rules Sir has set (rates, report colours, routing, access) are kept in
the backend repository's BUSINESS-RULES.md.

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

## CH-231 - Phone: the menu button opens the menu on the first tap
**2026-10-23 · Portal**

On a phone it took 5-6 taps to open the side menu (Sir, 23 Oct). The button
toggled the menu, so a tap delivered twice - or a second tap while it was
still sliding in - opened and closed it at once; and only the 32px icon inside
a 36px box was tappable.

- On a phone the button only opens the menu; it closes from its backdrop, Esc,
  or choosing a page (the menu now closes itself after a page is chosen).
- The whole square is the button, 40px on touch screens, no double-tap-zoom
  wait (touch-manipulation), and it presses in when tapped.
Desktop is unchanged.

Commit: see `git log --grep CH-231`.

## CH-232 - Month reports load fast: past days and today fetched apart
**2026-10-23 · Portal**

Opening this month took over 10 seconds (Sir, 23 Oct). For a range that
includes today the backend reads every row up to the page asked for, page
after page, because live calls have to be merged in: page 22 of a month
re-read about 11,000 calls. The call list of a range that reaches today is now
loaded as the past days (the backend's fast path and finished-days cache,
kept in the browser for the session) plus today (small, live), and joined.
A refresh or the automatic update downloads only today. Pages are fetched 6
at a time instead of 4.

Commit: see `git log --grep CH-232`.

## CH-233 - Top bar: Total is never cut off ("Total: 1" on a zoomed-out phone)
**2026-10-23 · Portal**

On a phone zoomed out the bar was wide enough for the search box, which took
its full width first; the stats block clipped what did not fit and Total read
"Total: 1" (Sir, 23 Oct). The stats now never shrink or clip, the search box
gives way instead (min-w-0), and it only appears from @6xl, where it fits
beside the full figures.

Commit: see `git log --grep CH-233`.

## CH-235 - New destination: 0 on concurrency cap means no limit, and it saves
**2026-10-23 · Portal**

Creating a destination with 0 / 0 / 0 (concurrency, daily, monthly) left the
Create button greyed out: the form required a concurrency cap above 0. 0 on
every cap means no limit - routing already skips a cap of 0, and the table
already shows it as ∞ - so a line with no limits could not be created at all
(MTG, 23 Oct). The form no longer requires it, the field accepts 0, the hint
names all three caps, and the buyer card, dashboard and stats row show ∞
instead of "/ 0".

Commit: see `git log --grep CH-235`.

## CH-236 - Reports: clicking the Repeated total lists the repeated calls
**2026-10-24 · Portal**

Connected, Qualified, Converted and Not Connected totals each list their calls
when clicked; Repeated was plain text, so clicking 251 did nothing (Sir,
23 Oct). It is now a filter like the others: the Call Log, chart and donut
show exactly the calls the total counted - the same is_duplicate flag the
server sums Repeated from - and the strip above the log names it, with a
reset. Export of that list is built in the browser, like Not Connected.

Commit: see `git log --grep CH-236`.

## CH-237 - Reports: the Repeated total turns yellow when clicked
**2026-10-24 · Portal**

Clicked, the Repeated total turned blue like Connected (Sir, 24 Oct: yellow
instead). It now turns yellow when clicked and on hover - a darker yellow on
the light theme so it stays readable on white. The other totals keep their
colours.

Commit: see `git log --grep CH-237`.

## CH-239 - TFN Check: a Test call button per number, with each step shown live
**2026-10-24 · Portal**

Sir, 24 Oct: a user should see a test call with their own eyes. The "also
place a test call" checkbox is gone - it went to the carrier, which refuses
those calls, so nothing ever changed on the page. Each number now has a Test
call button; the row opens underneath and ticks off each step as it happens
(placed, reached our phone system, number live, on an active campaign, routing
ready), then Test call passed or failed with the time. A failing step is red.
Read every second, given up after 45 seconds with a note. Placed inside our
own phone system: nothing goes to the carrier, no buyer is rung, nothing is
billed - the page says so. Every portal login can test (a publisher only its
own numbers); the public link page never places calls. Needs backend CH-239.

Commit: see `git log --grep CH-239`.

## CH-240 - TFN Check for publishers; a new Check clears old test results
**2026-10-24 · Portal**

Sir, 24 Oct: publishers should test the TFNs allotted to them. TFN Check now
shows in a publisher's menu when TFN Test Calls is on in their Publisher Access
(the switch is listed there, publishers only). They see and test only their
own numbers - the backend enforces it - and not the Share Links card.

Sir also tested a number before it was on a campaign: the test failed, the
number was added, and the old Failed result still showed. Pressing Check now
starts clean; Test again gives the current result.

Needs backend CH-240.

Commit: see `git log --grep CH-240`.

## CH-243 - Settings: API keys shown to the workspace's main account only
**2026-10-24 · Portal**

Sir, 24 Oct: API keys are visible and editable only by the main login of the
account - not publishers, buyers, other admins or managers. Publisher and buyer
logins saw the whole list under Settings -> API keys. The section now shows
only when the backend says this login is the main account (is_main_user) or
the platform owner; the backend refuses everyone else as well. Needs backend
CH-243.

Commit: see `git log --grep CH-243`.

## CH-246 - TFN Expired notice in Sir's wording, without the 12 PM line
**2026-10-24 · Portal**

Sir, 24 Oct: the notice in the bell and the pop-up now read

  1 TFN Expired
  The following number has expired and is no longer receiving calls:
  18888910358
  Add a replacement TFN to keep calls routing without interruption.

(plural for several numbers). "Shown here until 12 PM EST." is no longer
shown, as Sir asked; the notice still goes by itself at 12 PM Eastern, since
the server stops listing the numbers then. Numbers are written 18888910358.
The Seen and Add TFNs buttons stay.

Commit: see `git log --grep CH-246`.

## CH-247 - Campaign destinations: Rate and Convert ON saved and used, as on Revo
**2026-10-24 · Portal**

The Edit (pencil) box on a routed destination now saves for real: Rate and
Convert ON - Campaign default, Incoming Call, Call Connected, or Call Length
with its seconds - plus priority and weight. TYPE shows the event each
destination bills on, REVENUE its rate (or the campaign's; it showed the
buyer's bid, which bills nothing). The Webhook option, the duplicate-revenue
options and the name field never saved anything and are removed. Cloning a
campaign copies each destination's billing. In the Call Log an unanswered call
that still converted reads "Not Connected - With Conversion", as on Revo.

Needs backend CH-247.

Commit: see `git log --grep CH-247`.

## CH-248 - Adding destinations to a campaign requires Rate and Convert ON
**2026-10-24 · Portal**

Sir, 24 Oct: "give mandate while adding destination in campaign". Like Revo,
"+ Add" under Routed Destinations is now two steps: pick the destinations,
then Conversion Settings - Rate and Convert ON (Incoming Call, Call
Connected, or Call Length with its seconds), all required. Nothing is added
until both are filled in. The settings apply to every destination picked and
are saved with it (backend CH-247); each can be changed later with its pencil.

Commit: see `git log --grep CH-248`.

## CH-250 - Reports: Converted / Not Converted / No Answer, Missed With Conversion
**2026-10-24 · Portal**

- Chart and Total Calls ring: blue Converted, yellow Not Converted (answered,
  not converted), red No Answer (missed and not converted). A missed call
  that converted (destination paid on Incoming) is blue.
- Call Log: such a call reads "Missed With Conversion" in Status (screen and
  export); Fail Reason only for calls that did not convert.

Commit: see `git log --grep CH-250`.

## CH-251 - Reports chart and Total Calls: two colours, blue and red
**2026-10-24 · Portal**

Sir, 24 Oct: candles in just two colours. Blue: converted or answered (a
call answered but not converted is blue too; a missed call that converted,
destination paid on Incoming, is blue). Red: missed and not converted -
missed, overflow missed, campaign out of concurrency, a buyer who missed
under a Connected rule. The yellow slice and candle are removed.

Commit: see `git log --grep CH-251`.

## CH-252 - Reports: Not Converted back on the chart and ring, in blue
**2026-10-24 · Portal**

Sir, 24 Oct: "Not converted - keep it same blue". CH-251 folded those calls
into Converted; they are listed on their own again (candle, tooltip, legend,
ring slice) but drawn in the same blue. Red stays missed and not converted.

Commit: see `git log --grep CH-252`.

## CH-253 - Carrier Costs: Routing cost opens on Today
**2026-10-24 · Portal**

It opened on Yesterday, also after every refresh. Today is the Eastern day,
as the backend counts it.

Commit: see `git log --grep CH-253`.

## CH-254 - Carrier Costs: one bill - summary, routing in the total, rounding, warnings
**2026-10-24 · Portal**

- "This month's bill": TFN fees, TFN carrier monthly charges, TFN minutes,
  routing minutes, routing monthly charge, total.
- Warnings when rates are missing or TFNs have no carrier.
- Edit rates: "Minutes billed" - exact seconds, or up to 6 / 30 / 60 s.
- "Portal" is now "Monthly charge"; Freedom quick-fill TFN fee $5.
- Month defaults to the Eastern month.

Commit: see `git log --grep CH-254`.

## CH-255 - Billing shows cents; "Insufficient Funds" comment
**2026-10-24 · Portal**

- Billing cards show cents: the $49.99 portal fee read "$50", expenses
  totals were whole dollars.
- Fail reason "Insufficient Funds" (new backend wording and the old one).

Commit: see `git log --grep CH-255`.

## CH-302 - Every screen in the chosen language: Automated Report, TFN Check and the rest
**2026-10-27 · Portal**

Automated Report, the buyer Telegram report, my Telegram report, the export
column picker and Owner > Carrier Costs now have Russian, Japanese and Chinese.
TFN Check details and test-call steps, report results, report column and
comment names (sent by the server in English) are shown in the chosen
language; the public TFN Check link has a language picker. The last English
copies in the language dictionaries were translated.

Commit: see git log --grep CH-302.

## CH-306 - Getting Started: the portal demo video, below Workspace
**2026-10-27 · Portal**

Sir, 27 Oct: the demo video "below Workspace". New menu item **Getting
Started** (admins), right under Workspace, opens a page with the walkthrough
video "Go live step by step" (4K, 2:38, plays while it loads) and its nine
chapters beside it - Create a publisher, Create a buyer, Add destinations,
Create a campaign, Add tracking numbers, Route calls and set revenue, Set the
CC, Go live, Your day-to-day tools. Press a chapter to jump there; the
chapter playing is highlighted. Labels in all four languages.

Commit: see git log --grep CH-306.

## CH-307 - "TFN" in the user's language everywhere
**2026-10-27 · Portal**

Sir, 27 Oct: "TFN isn't changing their language" - the menu read "Проверка
TFN", "TFNチェック", "TFN 检查". The full-word translations (acronyms.ts:
бесплатный номер / フリーダイヤル番号 / 免费号码) existed but never showed,
because the main dictionaries are read first. They now win over the main
dictionaries (Russian, Japanese, Chinese only; English keeps "TFN"), and the
14 texts left with "TFN" in each language are translated: TFN Check (menu,
page, share link), TFN Test Calls, replacement TFNs, Carrier Costs and
Owner profit. No text in Russian, Japanese or Chinese contains "TFN" now.

Commit: see git log --grep CH-307.

## CH-308 - TFN Check menu label fits in Japanese and Russian
**2026-10-27 · Portal**

After CH-307 the Japanese menu read "フリーダイヤル番号チ…" (cut off). The menu
now reads "フリーダイヤル確認" (Japanese) and "Проверка 8-800" (Russian); the
page title keeps the full words. Chinese "免费号码检查" already fitted.

Commit: see git log --grep CH-308.

## CH-309 - Getting Started: sharper demo video
**2026-10-27 · Portal**

The Getting Started video is replaced with the new HD master (same 4K and
2:38, higher bitrate: 26.5 MB instead of 15.6 MB, sharper text). Poster frame
taken from the new file; chapter 7 (Set the CC) starts at 1:48 to match it.

Commit: see git log --grep CH-309.

## CH-311 - Connect Telegram with a link; test report to your own Telegram
**2026-10-27 · Portal**

Issue 3 (automated reports, trial on our own bot). Backend: CH-310.

- Buyer > Settings > Telegram Report: "Connect Telegram with a link" makes a
  link to our bot; copy it to the buyer (private chat or group link) or open
  it. When the buyer opens it, the chat ID fills in by itself (the page
  checks every 5 seconds). The chat ID box stays for typing one by hand.
- "Send test to my Telegram": the buyer's report, marked TEST, to your own
  Telegram - nothing goes to the buyer.
- Buyer login, Settings > Scheduled Reports: "Connect my Telegram" opens our
  bot straight away (or "Add to a group"); no chat ID to find.
- All new texts in English, Russian, Japanese and Chinese.

Commit: see git log --grep CH-311.

## CH-313 - Reports show TFN test calls (caller ID "Test")
**2026-10-27 · Portal**

Issue 4. Backend: CH-312.

- Caller ID column shows "Test" for a TFN test call (a caller ID that is a
  word was shown empty).
- Fail Reason: "TFN Test" / "TFN Test failed: <why>" shown as written in
  English and translated in Russian, Japanese and Chinese; never turned into
  "Overflow Missed" or "Duplicate Call" because its reason mentions a cap.
- "Not Connected" in the Fail Reason column is now translated too (it showed
  in English in every language).
- TFN Check: under a test call's steps, "It also shows in Reports, with caller
  ID Test".

Commit: see git log --grep CH-313.

## CH-324 - Getting Started: rebuilt demo video
**2026-10-27 · Portal**

The demo video on Getting Started is replaced with Avortyx_Demo_4K_Rebuilt.mp4
(3840x2160, 30 fps, 2:38, index at the front so it plays while loading,
24.4 MB). Same file name, so the page and links do not change. Poster frame
regenerated from the new file (the title card listing all nine steps).
Chapter times checked against the new file: all nine still land on their step
card, so they are unchanged. Commit: see git log --grep CH-324.

## CH-328 - Campaign Groups: one destination change, every campaign in the group
**2026-10-28 · Portal**

Campaigns → Campaign Groups (team only; publishers and buyers never see it).
Groups of campaigns, each group's destinations with their priority and weight
in every campaign and where they are missing, and one change - add, remove,
priority / weight / rate / Convert ON - applied to every campaign of the
groups ticked, all or nothing. Backend half: CH-328 in call_platform.

Commit: see git log --grep CH-328.

## CH-334 - Carrier Costs: dates in the portal's colours; company profit for Today / any days; routing cost per call
**2026-10-28 · Owner › Carrier Costs**

Sir, 28 Oct, on Carrier Costs: "fix colors" (the date popup), the company
profit "the way it's created for month - make same in today's sheet too",
and on the routing cost "metrics are wrong i think. 2770 calls just $93
cost?"

- The From / To dates open the portal's own calendar (components/shared/
  date-picker.tsx), drawn in the theme like the month picker (CH-216), not
  the browser's grey one. Sunday first, Today button, days after today
  greyed out.
- Company profit (before tax) is its own card with Today / Yesterday / This
  week / This month / dates, opening on Today like the routing cost
  (components/owner/company-profit-card.tsx, /api/owner/company-profit). For
  days shorter than a month the monthly fees count by the day, and the note
  under the card says so. The empty grey cell after "Portal fees" is gone:
  the tiles fill their row.
- Routing cost: two more figures, Average call and Cost per call, per day
  and in total, and the line under the tiles shows the sum
  ("23,385.80 minutes x $0.0040 a minute = $93.54"). Edit rate has "Minutes
  billed" (exact / 6 / 30 / 60 seconds a call) like the TFN carriers; the
  rate line says which is set. Calls are counted as in the reports (backend).
- The presets and dates are one shared piece (components/owner/
  period-picker.tsx) used by both cards.

Backend half: CH-334 in call_platform (needs migrate). Commit: see git log --grep CH-334.

## CH-335 - Pop-up alerts: buyer and publisher logins get only their own
**2026-10-28 · Notifications**

Sir, 28 Oct: "Buyer and Publisher should only get according to their access
in pop up alert, not as main account".

- The Pop-up alerts list shows what the backend allows the login (buyer:
  its calls, missed calls, buyer and destination caps, daily summary;
  publisher: its calls, missed calls, publisher cap, daily summary, TFN
  deleted / not working).
- A buyer or publisher login never gets a banner of the main account's
  alerts (campaign caps, balance, AHT, insights): lib/store/alert-
  preferences-store.ts popupAllowed() allows a partner only the types in
  its own list, and none before that list has loaded. The cached list is
  kept per login, so another login's list on the same browser is not used.

Backend half: CH-335 in call_platform. Commit: see git log --grep CH-335.

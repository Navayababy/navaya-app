# Plan: Sleep-tracking clarity — meaningful averages and parent-friendly overnight handling

**Status:** approved for implementation
**Scope:** presentation/stats layer only — no data-model, storage, or sync changes
**Implementer notes:** this plan is written to be executed step by step. Every touched file, function
signature, and copy string is specified. Where a judgement call was possible, the decision has already
been made and the rationale recorded — do not re-open decided questions, but do flag anything that
turns out to be factually wrong in the codebase.

---

## 1. The two problems

### 1.1 "Avg sleep per day" includes today, which is a partial day

`computeWeeklyInsights` (`src/lib/stats.js`) averages sleep over the last 7 calendar days
**including today**. At 9 a.m., today's row holds only the tail of last night's sleep, and because the
average only skips days with *zero* sleep, that partial day is counted as a full day and drags the
figure down. A parent glancing at "Avg sleep per day: 9h 40m" one morning and "11h 20m" the next —
with no change in the baby's sleep — learns nothing and trusts the number less.

### 1.2 Midnight-splitting of overnight sleep answers a question no parent asks

Every daily sleep figure clamps sleep intervals to *calendar-day* (midnight) boundaries
(`secsOverlappingDay` / `sleepSecsOnDay`). A 22:00–06:00 night therefore shows up as "2h yesterday,
6h today". That is arithmetically correct and useless at a glance:

- **Sleep tab, 07:30:** "sleep today: 6h" — baby has had one continuous 8-hour night, but the tile
  shows a number that corresponds to nothing the parent experienced.
- **Logbook day chips:** yesterday's chip under-reports ("2h sleep" for a day with a full night),
  today's chip over-reports before a single nap has happened.
- Parents think in two buckets — **"how did last night go?"** and **"how much has she napped
  today?"** — and the app currently answers neither.

## 2. How other apps handle it (research)

- **Huckleberry** (category leader): night sleep is displayed and counted **for one day, not split
  over two**. A "day" runs from a configurable **day-start time** to the next day-start; anything
  logged before day-start counts toward the previous day. Sleep is presented as **naps + night
  sleep** per day. ([Huckleberry help: day/week totals](https://huckleberry.zendesk.com/hc/en-us/articles/22939103913363-Why-are-the-day-and-week-view-totals-different-from-the-Summary-totals),
  [Huckleberry sleep tracking](https://huckleberry.zendesk.com/hc/en-us/sections/360004953513-Sleep-Tracking))
- **Napper** splits sleep across the two calendar days — and its reviews specifically call out that
  this makes it *"hard to know what sleep belongs to which night"*. This is the approach Navaya
  currently has, and it is a documented pain point. ([Napper App Store reviews](https://apps.apple.com/us/app/napper-baby-sleep-tracker/id1491340863))
- **Midmoon Baby Sleep Tracker** counts a day from "morning wake-up" (~06:00), not midnight.
  ([Midmoon](https://apps.apple.com/us/app/baby-sleep-tracker-midmoon/id1661957620))
- Across the category (Juniper, Baby Connect, Pampers Smart Sleep Coach), the metrics parents are
  shown are **naps, the overnight block, wake windows, and per-day totals** — not
  midnight-clamped calendar slices. ([Juniper](https://www.juniperbaby.app/baby-sleep-tracker-app))

**Conclusion:** the parent-friendly convention is a *sleep day* anchored to a morning day-start, with
the night attributed wholly to the day it began, presented as **"last night" + "naps today"**.

## 3. Decided approach

### 3.1 The sleep-day model

Introduce two wall-clock constants (defaults chosen to bracket a typical baby schedule; a Settings
control is a **follow-up, not part of this change** — see §8):

- `SLEEP_DAY_START_HOUR = 7` — a *sleep day* runs from 07:00 to 07:00 the next morning.
- `NIGHT_START_HOUR = 19` — within a sleep day, 07:00–19:00 is **nap time** and
  19:00–07:00 is **night time**.

Attribution rule (matches Huckleberry): *sleep day D* is the window `[D 07:00, D+1 07:00)`. The
night that starts on Monday evening belongs to **Monday**. Overlap-clamping (the existing
`secsOverlappingDay` technique, generalised) still handles every edge: a nap crossing 19:00 splits
into nap + night portions; a 26-hour forgotten timer spans several sleep days; nothing is ever
double-counted or lost.

### 3.2 What each surface shows (user journey first)

| Surface | Today (before) | After |
|---|---|---|
| Sleep tab tiles | "sleep today" (midnight-clamped) / "last sleep" / "awake for" | **"last night"** / **"naps today"** / "awake for" (unchanged) |
| Logbook today-stats sleep tile | "sleep today" (midnight-clamped) | value = **naps today**, label `naps today`, sub-line = `last night 9h 20m` |
| Logbook day-chip per day group | midnight-clamped total | **sleep-day total** (naps + that day's night) |
| Weekly summary "Avg sleep per day" | mean over last 7 calendar days incl. partial today | mean over the **7 most recent *complete* sleep days** (today excluded), still skipping days with no sleep logged |
| Day-rhythm chart | midnight-to-midnight wall-clock chart | **unchanged** (see §6) |

Rationale for the Sleep-tab tile swap: "last night" and "naps today" are the two questions parents
actually ask, and "awake for" is the wake-window signal they act on. The dropped "last sleep"
duration remains one tap away in the Logbook, and the "woke Xh ago" line above the start buttons is
kept. Do not try to fit four tiles — three is the designed layout.

"Last night" definition: the **most recently started** night window. Before 19:00 it is the night
that ended this morning; from 19:00 onwards it is tonight-so-far. When "now" is inside the night
window, label the tile **"tonight"** instead of "last night" (cheap, removes ambiguity). Show `—`
when no sleep overlaps the window.

### 3.3 Alternatives considered and rejected

- **Keep midnight totals but relabel** ("since midnight"): still answers no real question; Napper
  shows this exact model generates complaints.
- **Noon-to-noon fixed split**: attributes late-morning naps to the previous day; day-start at
  07:00 with a 19:00 night threshold matches how the category and parents segment the day.
- **Classify whole sleeps as "nap" or "night" by start time** (no clamping): a 18:30–06:30 sleep
  would count 12h as one bucket; clamping portions into windows is strictly more accurate and
  reuses the proven overlap approach already in the codebase.
- **Making the boundaries configurable now**: adds a Settings surface, storage key, and sync
  consideration to a change that is otherwise purely presentational. Defaults first; see §8.

## 4. Implementation steps

### Step 1 — constants: `src/lib/constants.js`

Add (alongside the existing exported constants):

```js
// Sleep-day model: a "sleep day" runs 07:00 → 07:00 so an overnight sleep
// belongs wholly to the evening it started. 19:00 splits naps from night.
export const SLEEP_DAY_START_HOUR = 7
export const NIGHT_START_HOUR = 19
```

### Step 2 — stats core: `src/lib/stats.js`

All helpers stay pure (no React), constructed with local-time `setHours(...)` so DST days behave
like the rest of the file (fractions of the *actual* day length; a 23/25-hour day is fine).

1. **Generalise the overlap primitive.** Replace `secsOverlappingDay` internals with:

   ```js
   // Seconds of [startedAt, endedAt] that fall inside [winStart, winEnd).
   export function secsOverlapping(startedAt, endedAt, winStart, winEnd)
   ```

   Keep `secsOverlappingDay(startedAt, endedAt, day)` as a thin wrapper over it **only if it is
   still imported anywhere after Step 4/5**; if the screens no longer use it, delete both it and
   `sleepSecsOnDay` (update `stats.test.js` accordingly — test the new primitives instead).

2. **Sleep-day helpers** (new exports):

   ```js
   // 07:00 boundary of the sleep-day containing `at` (an instant before 07:00
   // belongs to the previous calendar day's sleep-day).
   export function sleepDayStart(at = new Date())

   // Total secs in sleep-day D: [D 07:00, D+1 07:00)
   export function sleepSecsOnSleepDay(sleeps, day = new Date())

   // Nap portion of sleep-day D: [D 07:00, D 19:00)
   export function napSecsOnSleepDay(sleeps, day = new Date())

   // Night portion of sleep-day D: [D 19:00, D+1 07:00)
   export function nightSecsOfSleepDay(sleeps, day = new Date())

   // The most recently *started* night window relative to `now`, and its total:
   // { start, end, secs, inProgress } — inProgress true when now < end.
   export function latestNightSleep(sleeps, now = new Date())
   ```

   `day` parameters accept any instant; normalise through `sleepDayStart` first. Skip entries with
   missing/unparseable `startedAt`/`endedAt` exactly as `computeDayRhythm` does.

3. **`computeWeeklyInsights` sleep changes** (everything non-sleep is untouched):
   - Build the day list one day longer for sleep purposes: sleep-day totals for offsets **7…1**
     (the 7 most recent *complete* sleep days) feed the average; offsets **6…0** still populate
     `rows[i].sleepSecs` for display, now as **sleep-day totals** via `sleepSecsOnSleepDay`.
   - `avgSleepSecsPerDay`: mean over the complete sleep-days (offsets 7…1) that have
     `sleepSecs > 0`; `null` when none do. Today's in-progress sleep-day is **never** included.
   - Update the comment block to state both rules: *complete sleep days only* and *days with sleep
     logged only*.
   - Feed metrics (`avgFeedMins`, `avgGapMins`, `avgMood`) are **per-event averages, not per-day
     averages** — a completed feed this morning is a full data point, so today does not skew them.
     Leave them alone. (This is why the user's "anywhere else" audit ends with sleep.)

### Step 3 — Sleep tab: `src/screens/SleepScreen.jsx`

- Replace the `todaySecs` memo (`sleepSecsOnDay`) with two memos using the new helpers:
  `lastNight = latestNightSleep(sleeps)` and `napSecs = napSecsOnSleepDay(sleeps)`.
  Both must recompute on the existing 30 s `clockTick` re-render (they already will, being plain
  memos over `sleeps` — add the tick counter to the dependency array so the night window rolls over
  at 07:00/19:00 without a reload; the memo deps today are `[sleeps]` only).
- Tiles become:
  1. `[lastNight.secs > 0 ? fmtMins(lastNight.secs) : '—', lastNight.inProgress ? 'tonight' : 'last night']`
  2. `[napSecs > 0 ? fmtMins(napSecs) : '—', 'naps today']`
  3. unchanged "awake for / sleeping" tile.
- Remove the now-unused `sleepSecsOnDay` import and the "Clamped to today's boundary…" comment;
  replace with one line stating the sleep-day rule.

### Step 4 — Logbook: `src/screens/HistoryScreen.jsx`

- **Today-stats grid:** replace `sleepTodaySecs` with `napSecsOnSleepDay(sleepList)` and
  `latestNightSleep(sleepList)`. Sleep tile becomes:
  `{ val: naps > 0 ? fmtMins(naps) : '—', lbl: 'naps today', sub: night.secs > 0 ? `${night.inProgress ? 'tonight' : 'last night'} ${fmtMins(night.secs)}` : null }`.
  (The grid already supports a `sub` line — the feeds tile uses it.)
- **`daySummary(entries, day)`:** swap `sleepSecsOnDay(sleepList, day)` for
  `sleepSecsOnSleepDay(sleepList, day)` and update the comment: the chip now reads as "that day's
  naps plus that day's night", so yesterday's chip includes the night that ended this morning.
  Chip copy stays `"${fmtMins(sleepDur)} sleep"`.
- **Keep the timeline exactly as is**: day groups by start time, the after-midnight
  **sleepContinuation** row, edit/delete affordances — all unchanged. The continuation row is
  about *finding the entry*, not about totals, and it already explains itself
  ("started yesterday 22:00").
- **Weekly summary tile:** no JSX change needed (`insights.avgSleepSecsPerDay` keeps its name/shape);
  keep the label "Avg sleep per day".

### Step 5 — FAQ copy: `src/lib/faqData.js`

- Add to the **Sleep & Timers** section:
  - **Q:** "How is overnight sleep counted?"
    **A:** "A sleep day runs from 7am to 7am, so a night's sleep belongs to the evening it started
    rather than being split at midnight. You'll see it as \"last night\" alongside \"naps today\",
    and each Logbook day includes that day's naps and that night's sleep."
- Update the weekly-summary answer (currently around line 209) so "average sleep per day" reads:
  "…average sleep per day (complete days only — today isn't counted until its night is over)…"
  keeping the existing sentence about lighter-tracking days.

### Step 6 — tests: `src/lib/stats.test.js`

The fixed clock (`Tue 9 June 2026, 14:30`) already suits the new model. Update/add:

- Rewrite the `secsOverlappingDay / sleepSecsOnDay` block to cover `secsOverlapping` plus the new
  helpers (or keep wrapper tests if the wrappers survive Step 2.1).
- `sleepDayStart`: 14:30 → today 07:00; 03:00 → *yesterday* 07:00.
- Sleep-day attribution: a 22:00→06:00 sleep counts **wholly** toward the sleep-day it started;
  `sleepSecsOnSleepDay` for the next day is 0 for it.
- Nap/night split: a 18:30→19:30 nap contributes 30 min to `napSecsOnSleepDay` and 30 min to
  `nightSecsOfSleepDay` of the same sleep-day.
- `latestNightSleep`: at 14:30 returns last night's window (ended 07:00 today, `inProgress:false`);
  with a fake clock at 22:00 returns tonight-so-far (`inProgress:true`); zero-secs case.
- Multi-day spans: a 48 h interval distributes across three sleep-days with no loss.
- `computeWeeklyInsights`: update the existing "clamps sleep to day rows" test to the sleep-day
  attribution, and add the headline test: **sleep logged only today (in-progress sleep day) yields
  `avgSleepSecsPerDay === null`**, and a mix of complete days + today averages only the complete
  days. Open-ended (`endedAt: null`) and garbage timestamps are skipped.

### Step 7 — verify

`npm test` and `npm run lint` must pass. Then drive the app (`npm run dev`) with seeded
localStorage covering: an overnight sleep (yesterday 22:00 → today 06:00), a nap today, a nap
crossing 19:00 — check the Sleep tab tiles, Logbook today tile, yesterday's day chip, and the
weekly "Avg sleep per day" figure against hand-computed values.

## 5. Cross-section impact audit (checked, with findings)

| Area | Impact |
|---|---|
| `HomeScreen` | None — it only routes to the Sleep tab; shows no sleep figures. |
| Day-rhythm chart (`computeDayRhythm`) | **Deliberately unchanged** — it is a wall-clock, midnight-to-midnight visual; its own clamping and `nowFrac` handling are correct for that purpose and independent of the totals model. |
| Timers (`useSleepTimer`), pending-sleep confirm, household live sync | None — this change reads completed sleeps only; open sleeps (`endedAt == null`) stay excluded everywhere. |
| Storage / Supabase / outbox | None — no schema or write-path change; purely derived presentation. No migration needed. |
| `AddSleepModal` / edit flows | None — cross-midnight entry ("end before start = crossed midnight") already produces correct intervals that the new clamping consumes. |
| Feed/nappy/medicine stats | None — attribution by `startedAt`/`loggedAt` calendar day is fine for point-in-time events; per-event averages are not skewed by a partial today (§4 Step 2.3). |
| Logbook timeline & continuation rows | Unchanged (§4 Step 4). |
| Sage (`/api/chat`) | None — Sage never sees logged data. |
| DST | Boundaries built with local `setHours` — a 23/25-hour sleep-day just is that long, matching the existing convention documented in `computeDayRhythm`. |
| Language/copy | New copy is UK English, matches existing tone; "Logbook" naming respected. |

## 6. Explicit non-goals

- No configurable day-start/night-start (defaults only; see §8).
- No changes to the rhythm chart, timers, sync, storage schema, or the Logbook timeline structure.
- No new dependencies.

## 7. Acceptance criteria

1. At 09:00 after a 22:00–06:00 night and no naps yet: Sleep tab shows **last night 8h 0m**,
   **naps today —**; Logbook today tile shows **naps today —** with sub "last night 8h 0m";
   yesterday's day chip includes the full 8h; weekly average is unaffected by today.
2. "Avg sleep per day" never moves during the day as hours pass without sleep; it changes only when
   a sleep-day completes (07:00 rollover) or history is edited.
3. A nap crossing 19:00 splits correctly between naps and night with no lost/double seconds.
4. With sleep logged **only today**, "Avg sleep per day" shows `—`.
5. All unit tests and lint pass; no console errors driving the three flows in Step 7.

## 8. Follow-ups (out of scope, recorded for the backlog)

- **Settings: "Baby's day starts at / night starts at"** — persist via `storage.js`, thread into the
  stats helpers as parameters (they already take a `day`/`now` argument; add an options argument
  rather than reading storage inside pure functions).
- Weekly summary could later split "Avg night sleep" / "Avg naps" tiles if the 2×4 grid is revisited.
- Consider showing the night/nap split in the Logbook day chips ("8h night · 2h naps") after
  observing how the single total lands with users.

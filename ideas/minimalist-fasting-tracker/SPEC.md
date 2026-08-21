# Minimalist Fasting Tracker

A clean, no-ads timer for people doing intermittent fasting. Pick a protocol (16:8, 18:6, 20:4, or
a custom fast length), tap "Start fast", and watch a live elapsed timer with a circular progress
ring count toward the end of the fast. Past fasts are kept in a history list. No ads, no account —
everything runs client-side and persists in `localStorage`.

## How it works

- `app.js` keeps timer math and state transitions as pure functions that always take the current
  time as an explicit argument (never call `Date.now()` internally), so they're deterministic and
  testable with plain Node: `getProtocolHours`, `computeElapsedMs`, `computeRemainingMs`,
  `computeProgressPercent`, `formatHMS`/`formatShort`, `startFast`, `endFast`.
- **Protocols**: 16:8 / 18:6 / 20:4 map to fixed fast lengths (16h/18h/20h); "Custom" lets the user
  enter any whole-hour length, clamped to 1–72h.
- **Live timer**: once a fast is started, a `setInterval` tick (every second) recomputes elapsed
  time, remaining time, and progress percent from the stored `startedAt` timestamp — so the timer
  stays correct even if the tab was backgrounded or the page was reloaded (state isn't just an
  in-memory counter).
- **Visual design**: a bespoke "departure board" identity — a split-flap style numeral plate
  (`.flap-plate`) is the single focal element, with a hairline "runway" progress line beneath it
  (width driven directly by `computeProgressPercent`, 0–100%) instead of a circular ring. Once
  elapsed time passes the fast goal, the plate and runway switch to the amber "overtime" state and
  the status text switches from "time until eating window opens" to "eating window open — fasted
  so far", so the user can keep tracking elapsed time past their goal before ending the fast. See
  `theme.css` for the full design rationale and 21st.dev research notes.
- **History**: `endFast` records `{ protocol, fastHours, startedAt, endedAt, durationMs, goalMet }`
  to a `history` array (newest first, capped at 50 entries) in `localStorage`, where `goalMet` is
  true if the actual duration reached the protocol's target length (so ending early is visibly
  distinguished from completing the fast).
- Active-fast state is also persisted, so a page reload mid-fast resumes the correct running timer
  instead of losing progress.

## Out of scope for this pass

- No notifications/alarms when the eating window opens (tab must be open to see the live timer).
- No editable/deletable history entries — history is append-only and capped at the 50 most recent.
- No accounts or cross-device sync — state is local to the browser via `localStorage`.
- No nutrition/calorie tracking during the eating window — purely a fasting timer, per the idea's
  own "clean, no-ads timer" framing.

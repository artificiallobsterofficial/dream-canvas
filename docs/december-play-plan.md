# December 2026 Seasonal Play — Scoping Plan

Status: proposal (scoping only, no code yet)
Author: scheduled planning session, 2026-11-01
Ship-by target: **Dec 20, 2026** (ahead of New Year's resolution traffic)
Sizing: 2–4 build sessions total across all shipped items

## Why this exists

Vision boards are a seasonal product. Interest peaks late December through
early January — New Year's resolutions, "vision board party" gatherings,
"new year new me" content cycles. DreamCanvas should have something that
specifically earns that traffic, not just "still works fine in December."
This plan was scoped Nov 1 so there's a real runway to build, test, and ship
before the window opens.

## What the app already has today

Reviewed `README.md`, `src/App.jsx`, `src/constants/templates.js`, and
`src/services/{ai,cloud,reminders,review,storage}.js` to ground this plan in
what's actually built, not what the July notes assumed:

- **Templates** (`src/constants/templates.js`): 5 static templates (Wellness,
  Founder, Student, Travel, Fitness). Each is just an `items` array + a
  background color — cheap to add one more.
- **Goals widget already has WOOP-shaped fields.** It stores
  `short` / `medium` / `long` term goals *plus* `obstacle` and `plan` fields.
  There's already an "If-Then Planner" achievement for filling in
  obstacle+plan. So "WOOP" isn't a new mechanic — it's a new template that
  uses the mechanic that exists, with better prompts.
- **Habit trackers**: per-day status dict, streaks, freeze-on-miss, XP on
  completion. Day data persists indefinitely per tracker (it's just a dict
  keyed by date), so a tracker created in January still has its full year of
  history in June — nothing is pruned.
- **XP / Levels** (`src/constants/levels.js`): 5 levels, Dreamer → Visionary,
  XP thresholds 0/100/300/600/1000.
- **Achievements** (`src/constants/achievements.js`): derived live from board
  state (streaks, freeze recovery, if-then plan written, journal entry,
  perfect day). Not purchased, not stored separately — recomputed from
  `items` each time.
- **Blooms** (`BloomGarden.jsx`): a positive-only visual garden rendered on a
  life-area frame; grows, never decays. Count comes from board state.
- **Weekly review** (`services/review.js`): `computeWeekStats` is fully
  deterministic (habit %, streak, best/worst, if-then plan presence, journal
  presence) over a **trailing 7-day window only**. `generateWeeklyReview`
  layers an optional AI narration on top, with the deterministic text as
  fallback. **Important finding: there is no persisted history of past
  weekly reviews** — only the current blob of board state
  (`vision_board_v3_5_db`) is saved. A "year in review" can't replay past
  reviews; it has to be freshly computed from the raw habit-tracker day data
  and current XP/level/bloom counts, which *is* available going back as far
  as the user's trackers exist.
- **Export**: full-board PNG, plus two phone-wallpaper presets (1179×2556,
  1080×2400).
- **Cloud backup** (`services/cloud.js` + `worker/`): opt-in sync-code-based
  backup/restore through a Cloudflare Worker proxy; also the proxy path for
  AI calls when the user hasn't set a key.
- **AI coach** (`services/ai.js`): BYOK (Claude or Gemini) or the shared
  proxy; falls back to local/no AI gracefully. System prompt already leans
  "process over outcome, if-then plans, never-miss-twice" — this is the
  app's actual voice and positioning.

This matters for scoping: the app's identity is **evidence-based and
process-over-outcome**, not vibes-and-vision-only. Anything we ship for
December should read as "here's proof your habits moved the needle, now
set the next ones with a plan" — not a generic "manifest 2027" pitch.

## Candidate ideas (evaluated)

### A. "New Year 2027" board template (WOOP / if-then structure)

**What**: A 6th entry in `TEMPLATES`, styled for New Year's — goals widget
pre-filled with WOOP-labeled prompts (Wish / Outcome / Obstacle / Plan) tied
to resolutions, a habit tracker or two seeded with common resolution habits
(e.g. "Move daily", "No-spend day"), and a text widget with a
process-oriented headline instead of "2027 VISION" (fits the app's own
positioning better — something like "SYSTEMS OVER RESOLUTIONS").

**Why it fits**: Lowest-effort, highest-leverage item. The data model
already supports everything it needs (goals widget's obstacle/plan fields,
tracker widget). No new components, no new app logic — just new static
content plus maybe relabeling the existing goal-list field placeholders so
"Obstacle" / "Plan" read as WOOP when this template is active (or just
reuse the existing labels; they already function as WOOP).

**Rough effort**: 0.5–1 session. This is mostly content authoring
(`templates.js` entry + a seasonal header graphic/emoji + maybe a "🎊
New Year 2027" entry in the template picker) with a quick pass to check the
existing obstacle/plan copy reads naturally as WOOP, or add a one-line hint
in the template's text widget if it doesn't.

**Cut first if short on time**: Nothing to cut — this is the floor. If only
one thing ships this December, it's this one.

### B. "Host a vision board party" guide / group-session mode

**What** (July's framing was ambiguous between two very different builds —
evaluated both):

- *Lightweight version*: a static in-app guide/modal — "How to host a vision
  board party" with a short script (icebreaker prompts, suggested templates
  per guest archetype, a shareable checklist) plus maybe a "share my board as
  an image" nudge pointing at the existing PNG export. No new state, no new
  sync logic.
- *Heavy version* ("group-session mode"): multiple people building/viewing
  boards together in real time. This would require new shared state,
  presence, conflict resolution — a real multiplayer feature. The app has no
  real-time sync today; `cloud.js` is pull/push backup by sync code, not
  live collaboration. Building this properly is a multi-week project, not a
  December sprint item.

**Why it fits**: "Vision board parties" are a real, named phenomenon this
time of year, and it's a distinct acquisition angle (someone hosting a
party for friends) separate from the solo New Year's-resolution user. The
lightweight version fits; the heavy version doesn't fit this calendar and
risks never shipping.

**Rough effort**: Lightweight guide: 0.5 session (a modal + a few bullet
points of content, reusing existing PNG export). Group-session mode: not
scoped for December — out of scope, flag for a future non-seasonal cycle if
there's real demand signal.

**Cut first if short on time**: Cut this whole item before touching (A) or
(C). It's additive marketing content, not something existing users are
missing data for. If it slips, nothing about the app's core December story
breaks.

### C. "2026 year in review" flow

**What**: A new modal/flow (sibling to the existing Weekly Review modal,
reusing `generateWeeklyReview`'s pattern) that computes a full-year version
of `computeWeekStats`: longest streak per tracker across 2026 (not just
trailing 7 days), total days-done, bloom count, final XP/level reached,
and — if present — a read of any if-then plans ever filled in. Surfaced
*before* the user is pushed into the New Year 2027 template, so the flow is
"here's your real 2026 evidence → now set 2027 with a plan," which is a
distinctly DreamCanvas-shaped feature (most vision-board apps don't do
this) and ties directly into shipping (A).

**Why it fits best**: This is the one idea that's actually differentiated.
"New Year template" and "party guide" are things any vision-board app could
have. A data-backed year-in-review that cites the user's own streaks and
plans is exactly the "process over outcome, evidence-based" pitch the AI
coach's own system prompt already makes — it's the app being honest about
what it is, at the one moment of the year people want that honesty
(resolution season, when most intentions are about to be abandoned again).

**Rough effort**: 1–1.5 sessions. Needs: (1) extending `computeWeekStats`'s
approach to a full-year window (the day-keyed tracker data already supports
an arbitrary range — this is a new `computeYearStats` function in
`review.js`, not new storage), (2) a new modal UI (can closely mirror the
existing review modal's layout), (3) wiring a "See my 2026 → Start 2027"
CTA that opens the New Year 2027 template from item (A). No new persistence
needed; it's a read-only computed view over existing data.

**Cut first if short on time**: Cut the AI-narrated version first — ship
the deterministic stats-only version (same pattern as `buildLocalReview`
being the safe fallback today). If *that's* still too much, cut this item
entirely before cutting (A) — but try hard not to, since it's the
differentiated one.

## Recommendation

**Priority order:**

1. **(A) New Year 2027 template** — ship regardless. Cheapest, and the
   New Year 2027 template needs to exist before (C)'s CTA has anywhere to
   link.
2. **(C) 2026 year in review flow** — the differentiated piece; build
   deterministic-only if time is tight, add AI narration only if there's
   slack.
3. **(B) Party guide (lightweight only)** — nice-to-have marketing surface,
   first thing cut under time pressure. Do not build group-session mode
   this cycle.

**Ship-by date: December 15, 2026.** That leaves a ~5-day buffer before the
Dec 20 target for a quiet-period deploy, a once-over for obvious bugs in
the new modal/template, and reacting to any early user feedback before the
Dec 25–Jan 2 traffic spike. Target build window: late November through the
first week of December, so there's slack if (C) runs over its estimate.

**If only one build session happens**: ship (A) alone. It's self-contained,
low-risk, and gives the app *something* seasonal. **If two sessions
happen**: (A) + deterministic-only (C) — that combination is the actual
differentiated pitch ("see your real 2026, then set 2027 with a plan") and
is worth protecting over adding AI narration or the party guide.

# Cloud Progress Sync — Design

**Status:** Approved by user, ready for implementation plan.

## Context

STEM+ has twice chosen static-first / localStorage-only progress storage over a
DB-backed sync. ChatGPT's 40-section revision report flagged cloud sync as a
"hard to achieve" gap worth closing anyway — a student's progress today is
tied to one browser, with no way to pick up where they left off on a second
device. This spec reopens that decision deliberately, scoped to the smallest
slice that delivers real cross-device value, not a wholesale rewrite.

Three other items from the same report (diagnostic result explainability,
Applications-from-lessons cross-linking, the Timed Mastery → Fluency Training
rename) shipped earlier in the same work session using existing architecture.
This one is different in kind: it adds a new DB table, two new API routes,
and a client-side sync layer — the first time student progress leaves the
browser.

## Scope

**In scope for v1** — the data that actually defines "progress" (feeds the
Dashboard, Learning Record, and mastery computation) plus Fluency Training:

| localStorage key | Shape | Written by |
|---|---|---|
| `stemplus:results:v1` | array of attempt records | `tests.js` (unit tests, course exams) |
| `stemplus:projects:v1` | map: project id → `{complete, ...}` | `tests.js` (capstone completion) |
| `stemplus:diagnostics:v1` | map: pathway slug → latest attempt | `diagnostic.js` |
| `stemplus:applications:v1` | map: application slug → ISO timestamp | `mastery.js` (Application completion) |
| `stemplus:problem-sets:v1:<course-slug>` (×20) | `{attempted: {}, correct: {}}` | `problem-sets.js` |
| `stemplus:timed-mastery:v1` | map: course slug → `{best, last}` | `timed-mastery.js` |
| `stemplus:lessons:v1` | map: lesson page → ISO timestamp | `components/Layout.tsx`'s `useLessonViews` (lesson views) |

**Explicitly out of scope for v1** (stays localStorage-only, can be a later
pass if it proves worth it):
- Pathway/plan preferences: `stemplus:skipped-courses:v1`, `stemplus:track-pace:v1`,
  `stemplus:custom-plan:v1`, `stemplus:active-track:v1`.
- Sandbox/code-editor state (`function-sandbox-ui.js`, `java-sandbox.js`,
  `python-sandbox.js`, `python-project.js`, `guided-language-project.js`).
- The shared-device owner marker `stemplus:sync-owner:v1` — browser-local
  bookkeeping written by `progress-sync.js` itself, never pushed.

(An earlier draft of this spec listed `stemplus:lessons:v1` here as having no
writer. That was wrong — `components/Layout.tsx`'s `useLessonViews` writes it on
every lesson page a signed-in student opens, and `mastery.js`'s
`studentEvidence()` reads it as the sole driver of a unit's "Learning" state and
of the next-lesson recommendation, so it is in scope above.)

**No new UI.** Sync is fully invisible — the same silent gating pattern
`canSave()`/`account.ready` already uses everywhere else on the site. No
"synced" indicator, no manual sync button.

## Architecture

One generic table, not one per key:

```sql
create table if not exists progress_sync (
  user_id integer not null references users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
```

Generic by design — adding a 7th synced key later (e.g. promoting one of the
out-of-scope keys) needs no schema change, only adding its name to the
server-side allowlist and client-side merge-shape mapping.

**New client file**: `public/assets/progress-sync.js`, loaded once from
`pages/_document.tsx` next to the existing `account.js` tag. This is the only
new script tag on the site — **zero edits** to `tests.js`, `mastery.js`,
`diagnostic.js`, `problem-sets.js`, or `timed-mastery.js`. It works by:

- **Pull** — chains off the existing `window.STEMPlusAccount.ready` promise
  (the same gate `tests.js`'s Dashboard/Learning Record mount already awaits).
  If signed in, `GET /api/progress`, then for each returned key, merge into
  localStorage using the shape-specific rule below, write the merged result
  with the native (unpatched) `localStorage.setItem` directly, and compare
  the merged value against what the server sent: if they differ — meaning
  this device had something the server didn't, e.g. guest progress made
  before sign-in — queue that key for the next push batch immediately,
  rather than waiting for an unrelated future write to carry it up.
- **Push** — monkey-patches `window.localStorage.setItem` once, at script
  load. Any call whose key matches the synced-key allowlist (the 7 exact/
  prefixed keys above) schedules a debounced (2s) batch. After the debounce
  window, every changed key's *current* localStorage value is sent in one
  `PUT /api/progress` call. Calls to `setItem` for keys outside the
  allowlist pass through untouched.

### Known limitation (accepted for v1)

Code that reads progress from localStorage without first awaiting
`account.ready` won't see a same-session pull's results until the pull
resolves. `tests.js`'s mastery-dependent rendering already gates on
`account.ready`, so the Dashboard and Learning Record are unaffected.
`diagnostic.js` does not currently gate on it, so a page landed on
immediately after a cross-device sign-in could show pre-sync data for that
one load; the next navigation is correct, since the pull has resolved and
merged by then. Accepted as a documented v1 gap, not fixed here.

## Merge rules

Every rule is additive — the goal is "never silently lose progress," not
"pick a winner." Three shapes cover all seven keys:

**1. Append-only array** (`results`): union of both sides' records, deduped
by the tuple `(course, unit, kind, version, takenAt)`. Two records that
differ in any of those fields are both kept.

**2. ID→value map, union-of-keys** (`projects`, `applications`, and each
problem-set key's `attempted`/`correct` sub-maps): the merged map has every
key present on either side. For `correct` maps specifically, where both
sides have the same question ID, the merged value is `true` if either side
says `true` (once answered correctly anywhere, it stays correct).

**3. ID→best/last record map** (`diagnostics` keyed by pathway slug,
`timed-mastery` keyed by course slug): per ID, if both sides have an entry,
`best` becomes whichever side's `best.pct`/`best.score` is higher, and
`last` becomes whichever side's `last`/attempt has the later timestamp
(`takenAt` for diagnostics, `at` for timed-mastery). An ID present on only
one side passes through unchanged.

## API

Both routes follow the existing session-gated pattern (`lib/session.js`'s
signed cookie, same shape as `pages/api/generate-plan.js`'s auth check) —
no `is_developer` requirement, any signed-in user.

- **`GET /api/progress`** → `{ [key]: value }` for every `progress_sync` row
  belonging to the signed-in user. 401 if not signed in.
- **`PUT /api/progress`** → body `{ entries: { [key]: value } }`. Every key
  in `entries` is checked against a server-side allowlist built from the
  same 7 exact/prefixed key patterns (prefix match for
  `stemplus:problem-sets:v1:<course-slug>`, validated against the real
  course slugs from `skill-catalog.json`, mirroring how
  `pages/api/content-review.js` validates `course` against
  `KNOWN_COURSES`). Any key outside the allowlist → whole request 400s,
  nothing written. Valid entries are upserted with `updated_at = now()`.
  401 if not signed in.

## Testing

- **`scripts/check-progress-sync.js`** (joins the existing `npm test` chain
  of `check-*.js` scripts via `package.json`'s `test` script): unit-tests
  the three merge functions directly against hand-built fixtures — duplicate
  result records, diagnostics with conflicting timestamps on the same
  pathway, partially-overlapping problem-set `attempted`/`correct` maps,
  one-sided data on each side. No DB needed for this part.
- **Manual verification**, following this project's established
  `scripts/verify-page.mjs`-style headless-Chrome pattern: sign in as the
  same test account in two separate Chrome profiles (simulating two
  devices), make distinct progress in each, confirm both profiles converge
  to the union after a reload. Also verify the 400 rejection for a
  non-allowlisted key via a direct `PUT /api/progress` call.

## Migration

Adds one `create table if not exists` block to `scripts/migrate.js`,
following the existing pattern (`users`, `reports`, `content_reviews`). Run
via `node --env-file=.env.local scripts/migrate.js` against the live Neon
database, same as every prior migration this project has made.

# Developer Panel Design

## Goal

Replace STEM+'s build-time-only content-review status (a hardcoded `CONTENT_REVIEWS` object in `components/Layout.tsx`, requiring a code edit + redeploy to change) with a database-backed system a signed-in developer account can edit live, through a new gated page: the Developer Panel.

## Scope decisions (confirmed with the user)

- **"Developer access" in the panel** means linking to the existing browser-local dev-mode code unlock (`content/developer.html`) — no new account-management capability (granting/revoking the `is_developer` DB flag stays a manual DB operation, unchanged).
- **Status taxonomy is replaced**, not extended. The site's current 5-tier system (Draft, AI generated, Human reviewed, Verified, Needs review) becomes exactly 4 values: `AI Generated`, `Review in Progress`, `Human Reviewed`, `Human Verified`. `about.html`'s "How STEM+ content is reviewed" section is rewritten to match — Draft and Needs review are dropped entirely, not hidden-but-present.
- **Status only, no metadata editing.** The panel sets a course's status. The `reviewedBy`/`verifiedAgainst`/`sources` fields added earlier today stay in the display code (`SiteFooter` still renders them if ever populated) but nothing populates them from this panel — that's future work if it turns out to matter.
- **One new hub page, not a merge.** `content/developer-panel.html` is the new gated entry point with the course-status editor built in, plus links to the existing `developer.html` (dev-mode code) and `reports.html` (full report list) — neither of those pages changes.

## Data model

New table, created via `scripts/migrate.js` (idempotent `create table if not exists`, following the existing `reports`/`users` pattern exactly):

```sql
create table if not exists content_reviews (
  course text primary key,
  status text not null default 'AI Generated',
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
)
```

A course with no row is "AI Generated" by default — no need to pre-seed all 40 courses. `status` is restricted to the 4 allowed values at the API layer (not a DB `check` constraint — keeps the migration simple, matches how `reports.category`/`reports.status`-equivalent fields aren't DB-constrained either).

## API

Two routes under `pages/api/content-review.js` (one file, method-branched — same shape as `pages/api/reports.js`):

- **`GET /api/content-review`** — public, no auth check (status is visitor-facing information already shown in every page footer). Returns `{ [course]: { status, reviewed } }` for every row in the table (courses with no row are simply absent from the response — the client already treats "absent" as "AI Generated"). Response carries `Cache-Control: public, max-age=300` — read-heavy (every one of ~1,863 pages fetches this), write-rare (a developer changing a course's status), so a 5-minute cache meaningfully cuts DB load without making a status change feel slow to apply.
- **`POST /api/content-review`** — developer-gated (`verify(req.cookies?.session, ...)` + `session.isDeveloper`, identical check to `pages/api/reports.js`). Body `{ course: string, status: string }`. Rejects (400) if `status` isn't exactly one of the 4 allowed values, or `course` is empty. Upserts via `insert ... on conflict (course) do update`, always setting `reviewed_at = now()` and `updated_at = now()` on every successful write (the "Last reviewed" date reflects when the status was last touched, not a separate manually-entered date — simpler than a free-text date field, and accurate: a developer only POSTs when they've actually just reviewed something).

## `components/Layout.tsx` changes

- Delete the `CONTENT_REVIEWS` constant and its type entirely.
- `SiteFooter` changes from reading a static object to fetching live data, matching `AuthStatus`'s exact pattern (`useState<Record<string, {status, reviewed}> | undefined>(undefined)`, `useEffect` fetching `/api/content-review` once on mount, `undefined` while loading). While loading, the status line is simply omitted (same as `AuthStatus` returning `null` while `me === undefined`) rather than flashing a wrong default — the rest of the footer (course name, "How we review" link, Report a Problem) renders immediately since none of that depends on the fetch.
- The `reviewedBy`/`verifiedAgainst`/`sources` conditional rendering added earlier today stays as-is structurally (still reads from the same shape of object), just now sourced from the fetched map instead of the static constant. Since the panel doesn't write these fields yet, they'll always be absent in practice for now — the rendering code doesn't need to change, just its data source.

## New page: `content/developer-panel.html` + `public/assets/developer-panel.js`

Gated the same way `reports.html` is: the page itself is publicly reachable (static HTML), but its data comes from a 403-on-non-developer API, and the client JS shows "Developer accounts only" in place of the editor when that happens (matching `reports.js`'s existing `res.status === 403` handling exactly).

Client JS flow:
1. Fetch `/assets/skill-catalog.json` (already the single source of truth for course names elsewhere on the site — `mastery.js` fetches the same file) and derive the sorted list of unique `skill.course` values.
2. Fetch `/api/content-review` for current statuses.
3. Render one row per course: course name, current status (defaulting to "AI Generated" when absent), a `<select>` with the 4 allowed values, and a "Save" button.
4. On Save: `POST /api/content-review` with `{course, status}`; on success, update that row's displayed status and "Last reviewed" text in place (no full reload, matching the responsiveness of `reports.js`'s resolve-toggle); on failure, show an inline error and leave the dropdown as selected so the developer can retry.

Page also has plain links to `developer.html` ("Developer mode →") and `reports.html` ("Reports →") near the top, each with a one-line description, so the panel is the natural jumping-off point without absorbing either page's own UI.

**Discoverability:** `developer.html` currently has a `nav-links` row with `← STEM+ Home` and `Reports →`. Add `Developer Panel →` to that same row, pointing at `developer-panel.html` — this makes the panel reachable the same way `reports.html` already is (via `about.html`'s existing "Site maintainers can turn on developer mode" link → `developer.html` → onward), without adding any new public-facing mention of it. `developer-panel.html`'s own `nav-links` row links back (`← Developer`) plus forward to `Reports →`, matching the reciprocal pattern `reports.html` already uses with `developer.html`.

## Testing

- `scripts/check-content-review.js` (new, Node-testable, follows the `check-*.js` convention): imports the status-validation logic as a pure function (extracted so it's testable without a live DB — e.g. `lib/content-review.js` exporting `VALID_STATUSES` and `isValidStatus(status)`), asserts the 4 values are accepted and a handful of rejected inputs (old taxonomy values like `'Verified'`, empty string, random text) are not.
- Manual verification (DB-backed, can't be scripted without a live Neon connection): use the project's established `scripts/verify-page.mjs` CDP approach against `npm run build && npm run start`, with the existing developer test account's session cookie (per the `stemplus-backend-and-verification` memory) — confirm `GET /api/content-review` returns `{}` initially, `POST` as the developer account succeeds and changes a course's footer status on its real content pages, and `POST` as a non-developer (or signed-out) session gets 403.
- `about.html`'s rewritten content-review section gets a quick read-through for accuracy against the new 4-tier system — no automated check for prose content.

## Out of scope (explicitly, per the scope decisions above)

- Granting/revoking `is_developer` from the UI.
- Editing `reviewedBy`/`verifiedAgainst`/`sources` from the panel.
- Any change to `reports.html`, `pages/api/reports.js`, or `developer.html`'s existing dev-mode-code widget.
- Re-populating any course's actual status (this spec builds the mechanism; using it to promote a real course, e.g. AP Calculus BC, is separate future work per the `stemplus-content-trust-system` memory).

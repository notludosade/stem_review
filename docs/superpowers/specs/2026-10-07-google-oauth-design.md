# Google Sign-In ("Continue with Google") — Design

**Status:** Audit complete, approach presented to and not contested by the user. Awaiting explicit spec review before an implementation plan is written (this project's established gate) — this document captures what was already presented in conversation, formalized for that review.

## Context

STEM+'s account system today is entirely hand-rolled: email + password, a custom HMAC-signed session cookie (`lib/session.js`), scrypt password hashing (`lib/password.js`), no third-party auth library. This request adds "Continue with Google" as a second way into the same account — not a second kind of account. The explicit, non-negotiable requirement: one STEM+ user identity (`users.id`) with multiple possible sign-in methods, never a separate "Google account" that forks a student's progress away from their existing email account.

This sits directly on top of the cloud progress sync feature shipped earlier the same day (`progress_sync` table, keyed by `users.id`) — Google sign-in must produce the exact same session shape that feature already expects, so nothing about cloud sync needs to change.

## Audit of the current system (findings, not proposals)

- **Auth:** no provider, no library. `lib/session.js` signs/verifies `{userId, isDeveloper, exp}` via HMAC-SHA256; `lib/password.js` is scrypt-based. Every gated API route (`/api/me`, `/api/progress`, `/api/generate-plan`, `/api/report`, `/api/reports`, `/api/content-review`) independently calls `verify(req.cookies?.session, process.env.SESSION_SECRET)`. No central middleware — the `proxy.ts` referenced in an old `scripts/migrate.js` comment no longer exists; the site is fully public now.
- **Identity:** `users.id` (plain Postgres `serial`) is already the sole stable identity — it's the FK target for `progress_sync.user_id` and `reports.user_id`. Never email-keyed in the schema. This requirement is already satisfied; nothing to change here.
- **Sign-in UI:** `content/login.html` — one page, two panels (sign in / create account), plain `fetch()` calls to `/api/auth/login` and `/api/auth/signup`, a client-side `nextUrl()` that validates `next` is a same-site relative path before redirecting back after success. The nav's `AuthStatus` (`components/Layout.tsx:372`) shows "Sign in" when signed out, "name/email · Sign out" when signed in.
- **No account/settings page exists.** Nowhere currently shows "connected sign-in methods."
- **Env vars in use today:** `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `DESMOS_API_KEY` — `.env.local` (gitignored) locally, mirrored in Vercel for production.
- **STEM Lite** (`scripts/build-stem-lite.js`) is a fully separate static generator that never touches `login.html`, `_document.tsx`, or `Layout.tsx` — it's already structurally incapable of picking up anything added here.
- **Dependencies:** no Auth.js/NextAuth, Clerk, or Neon Auth installed. `package.json` has only Next/React/Tailwind/the Neon serverless driver.

## Decision: hand-roll the OAuth flow, reuse the existing session system unchanged

None of "already has a provider," "already on Neon Auth," or "already has Auth.js/Clerk installed" are true. Adopting any of them now would mean migrating every existing gated route off `lib/session.js` — out of scope per the explicit instruction not to migrate auth systems just because an alternative exists.

The chosen approach: implement Google's OAuth 2.0 Authorization Code flow with plain `fetch()` calls (no new npm dependency — consistent with this codebase's existing style of hand-rolling `crypto`-based password hashing and session signing), and **reuse `lib/session.js`'s `sign`/`verify` unchanged** for the resulting session cookie. Once a Google sign-in completes, the user is indistinguishable from an email-authenticated one — same cookie shape, same `userId` — so cloud sync, `/api/me`, and every other gated route need zero changes.

**Why not verify the Google ID token's JWT signature locally:** the `id_token` is obtained via a direct server-to-server POST to `oauth2.googleapis.com/token` using our own client secret — not supplied by the browser. Decoding its payload and checking `aud` (matches our client ID), `iss` (`accounts.google.com` / `https://accounts.google.com`), `exp`, and `email_verified` is sufficient for this trust boundary and avoids needing JWKS-fetching/signature-verification code. (If this project later accepts ID tokens directly from client-side JS — it won't, per the UI design below — that would change this calculus and require real signature verification.)

## Data model

One new table, directly matching the `user_id / provider / provider_account_id` shape already suggested in the request:

```sql
create table if not exists oauth_accounts (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_account_id)
);
alter table users alter column password_hash drop not null;
```

The `unique (provider, provider_account_id)` constraint is what makes "find or create" atomic and race-safe: a second concurrent callback for the same Google account can't create two rows. Relaxing `password_hash` to nullable is required because a Google-only user has no password — `lib/password.js`'s `verifyPassword` already returns `false` for a null/malformed stored hash, so the existing email-login path degrades safely with no code change there.

This is the only schema change. No separate progress table, no separate sync logic, no duplicate user data — `oauth_accounts` is purely an identity-linking table; every other table keeps referencing `users.id` exactly as it does today.

## Account-linking logic (the critical-requirement section)

On a successful Google callback, with validated claims `{sub, email, email_verified, name, picture}`:

1. Look up `oauth_accounts` where `provider = 'google' and provider_account_id = sub`. If found, that row's `user_id` is the signed-in user. Done — this is a returning Google user.
2. If not found, and `email_verified === true`, look up `users` by that email (case-insensitive).
   - **Found:** this is an existing email-authenticated account signing in with Google for the first time. Insert the `oauth_accounts` link row, sign them in as that same `user_id`. Their existing progress is untouched because nothing about `user_id` changed — this is the whole point.
   - **Not found:** create a new `users` row (`email` from Google, `password_hash = null`, `name` from Google's claim), insert the link row, sign them in as the new user.
3. If `email_verified !== true`, never use the email for linking — treat it as if no `users` match was found (create a new account). Google's own documentation is explicit that an unverified email on an OAuth response must not be trusted for account linking; this is the one case the request called out by name ("do not merge accounts based only on an unverified matching email string").

No explicit "link my Google account" action exists in this phase — linking only ever happens automatically, deterministically, from Google's own verified identity. There is therefore no "this Google account is already linked to a different STEM+ account" error case in Phase 1 (that error belongs to an explicit account-settings linking flow, which is deferred — see below).

## Request flow

- `GET /api/auth/google/start?next=<path>` — validates `next` with the exact same same-site-relative-path rule `login.html`'s `nextUrl()` already uses (reject anything not starting with `/` or starting with `//`), generates a random `state` value, stows `{state, next}` in a short-lived (10 min) httpOnly cookie signed via the existing `sign()` helper (no new crypto primitive), redirects (302) to Google's `https://accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile`, `state`.
- `GET /api/auth/google/callback` — reads `code`/`state`/`error` from the query string. If `error` is present (user cancelled), redirect to `/login.html` with a friendly query flag the page turns into "Google sign-in was cancelled." If `state` doesn't match the signed cookie's `state` (missing, expired, or tampered), redirect with a "your session expired, sign in again" flag. Otherwise: exchange `code` for tokens via one POST to `https://oauth2.googleapis.com/token`, validate the `id_token` claims as above, run the linking logic, `sign()` the normal session cookie, redirect to the `next` path recovered from the state cookie (defaulting to `/`).

## UI

`content/login.html` gets one new element above the existing two panels: a "Continue with Google" button (plain `<a href="/api/auth/google/start?next=...">`, styled as a button — no client-side Google SDK, no script tag, just a normal link) and an "or" divider, matching the ASCII mock in the request. The subtitle is expanded to mention cross-device sync by name now that it's real (today's wording undersells what the account actually does since cloud sync shipped). A short value-prop bullet list (sync across devices, Learning Record, goals/diagnostics, project evidence) goes near the Google button.

Error states surface as a visible, specific message on `login.html` (reusing the existing `.auth-error` element), never a raw stack trace or OAuth object. A "Signing you in…" state and disabling the Google link on click cover the loading case the request asked for.

## Environment variables

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Vercel (Production, and Preview only if the user sets up a stable preview alias domain, since Google OAuth redirect URIs can't use wildcards) and `.env.local` locally.

## Google Cloud configuration (manual, user-performed)

1. Create/select a Google Cloud project.
2. OAuth consent screen: External, scopes `openid`, `email`, `profile` only.
3. Create Web application OAuth credentials.
4. Authorized redirect URIs: `https://stem-review.vercel.app/api/auth/google/callback` and `http://localhost:3000/api/auth/google/callback` (Next's default `next dev` port — this project's own manual verification scripts use `-p 3200` for isolation during automated checks, but the user's actual local dev loop is the plain `npm run dev` default of 3000).
5. Copy the generated Client ID/Secret into Vercel's environment variables and local `.env.local`.

Preview-environment redirect URIs are deliberately not set up in this phase — Vercel preview URLs are per-deployment and unpredictable, so previews won't support Google sign-in unless the user configures a stable alias domain for them later. Email sign-in is unaffected on previews either way.

## Explicitly deferred (not this phase)

- **Account Settings "Connected Accounts" page.** No settings page exists today; building one is a real, separate addition, not required for "Google + existing email must work reliably." The schema (`oauth_accounts`) already supports showing this later with no further migration.
- **Microsoft, GitHub, Apple.** The `provider` column already generalizes to them; adding one later means a new case in the same linking logic, not a schema change or a rewrite.
- **Explicit "link this provider to my already-signed-in account" flow** (as opposed to the automatic linking-by-verified-email that already happens). This is what would need the "already linked to another account" error case — not needed until a settings page exists.
- **GitHub repository access scopes** — called out in the original request as something that must stay separate from GitHub *login* if/when GitHub is added; not relevant to this Google-only phase.

## Testing

Per this project's established pattern: `scripts/check-*.js` additions for anything pure/testable without a browser (e.g. the `next`-path validator, the id-token claims check, the find-or-create/link decision logic as a pure function given a fake claims object and a fake DB lookup result), then live raw-CDP headless-Chrome verification against `npm run build && npm run start` for the full flows: new Google user, returning Google user, existing-email-account linking via Google, cancelled OAuth, tampered/expired state, and — because cloud sync already exists — a same-account two-device check (sign in with Google on a second simulated profile, confirm the first device's progress is there). All of this requires real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` values to run against Google for real; it cannot be verified until those are configured.

## Risks

- **Cannot be end-to-end tested until the user completes the Google Cloud Console + Vercel/`.env.local` setup.** This is why implementation work can proceed (writing the routes, the migration, the UI) but *verification* — and therefore calling the feature done — cannot, until those credentials exist.
- **Preview deployments won't support Google sign-in** without a stable alias domain, by design (see above) — not a bug, a documented limitation of Vercel preview URLs + Google's no-wildcard redirect URI policy.
- **This touches authentication and account identity directly** — higher stakes than most STEM+ features shipped this session. The final whole-branch review step (already this project's established practice for exactly this reason) matters more here than usual, not less.

# Google OAuth Accounts — Design

## Context

STEM+ is a static HTML/CSS/vanilla-JS site (no build tooling, no `package.json` today), deployed on Vercel. All existing state (unit tests, exam gating, progress reports) lives in browser `localStorage` — a prior attempt at a real backend for that data was deliberately reversed back to `localStorage` because it was simpler and that's what stuck.

This time the user wants real user accounts, backed by a Neon Postgres database (already provisioned: project "Future of Education", `.neon` context file and `.env.local` with `DATABASE_URL` are in place, both gitignored). The intended use of accounts beyond identity is deliberately not specified yet ("something planned for it") — this spec covers only the account/auth foundation, not what gets attached to it later.

## Goals

- Let a user sign in with their Google account.
- Persist a minimal user record in Postgres (Neon).
- Give the static frontend a simple way to know "who is signed in" (or that no one is).
- Keep the footprint minimal: static site stays static, only `/api` gains a small serverless layer.

## Non-goals (out of scope for this spec)

- Password-based login or any other identity provider.
- Linking multiple providers to one account.
- Refresh-token / long-lived session renewal — a session simply expires and the user re-authenticates.
- Roles, permissions, or admin accounts.
- Migrating existing `localStorage` progress data into accounts. That is the "planned" follow-up and gets its own spec once scope is known.

## Architecture

The site remains a static deploy. A new `/api` directory adds Vercel Serverless Functions (Node.js runtime) for the pieces that must run server-side: talking to Google, talking to Postgres, and signing the session cookie. A root `package.json` is added, scoped only to what `/api` needs.

Dependencies:
- `@neondatabase/serverless` — Neon's fetch-based driver, built for serverless/edge environments (already the driver Neon's own setup flow recommends).
- No OAuth/JWT library. Google token exchange and profile lookup happen via plain `fetch` calls to Google's endpoints (Node 18 runtime on Vercel has `fetch` built in). The session token is signed with Node's built-in `crypto.createHmac` — no `jsonwebtoken`/`jose` needed for a single-purpose HMAC-signed cookie.

## Data model

Single table in the Neon `production` branch:

```sql
create table users (
  id serial primary key,
  google_sub text unique not null,
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
```

No password column — Google has already verified the email, so there is nothing else to store for identity.

## Components

| File | Responsibility |
|---|---|
| `api/auth/google.js` | Sets a short-lived `state` cookie (CSRF protection), redirects the browser to Google's OAuth consent screen. |
| `api/auth/callback.js` | Validates `state`, exchanges the authorization code for tokens (`fetch` to Google's token endpoint), fetches the profile from Google's userinfo endpoint, upserts the `users` row in Neon (by `google_sub`), signs a session cookie, redirects back into the site. |
| `api/auth/logout.js` | Clears the session cookie. |
| `api/me.js` | Returns the current user (from the verified cookie) or `401` if not signed in. |
| `lib/db.js` | Neon client helper, reads `DATABASE_URL` from the environment. |
| `lib/session.js` | Signs and verifies the session cookie payload (user id + expiry) via HMAC-SHA256. |
| `assets/auth.js` | Client-side script included on pages that need auth state: calls `/api/me` on load, toggles a "Sign in with Google" link vs. "Signed in as {name} — Sign out" in the header. |

## Data flow

1. User clicks "Sign in with Google" → browser hits `api/auth/google.js`.
2. That function sets a `state` cookie and 302s to Google's consent screen.
3. Google redirects back to `api/auth/callback.js` with `code` and `state`.
4. Callback verifies `state` matches the cookie, exchanges `code` for an access token, fetches the Google profile, upserts into `users`, signs a session cookie (httpOnly, `Secure`, `SameSite=Lax`), redirects to the originating page.
5. On every page load, `assets/auth.js` calls `/api/me` (cookie sent automatically); the response drives the header UI.

## Error handling

- Missing/mismatched `state` on callback → reject, redirect to sign-in with an error flag. Prevents CSRF.
- Google token exchange or profile fetch fails → `401`, user sees a generic "sign-in failed, try again" message.
- Neon query fails → `500`, no internal detail returned to the client.
- Expired or missing session cookie → `/api/me` returns `401`; frontend just renders the signed-out state. No silent auto-refresh in v1 — the user re-clicks sign-in.

## Environment / external setup

The user creates an OAuth client in Google Cloud Console (outside this codebase) and provides:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — stored as Vercel env vars (and locally in `.env.local`, already gitignored).
- Authorized redirect URI registered as `https://<production-domain>/api/auth/callback`.
- `SESSION_SECRET` — a random value used to HMAC-sign session cookies, generated once and stored as a Vercel env var.

## Testing

No test framework exists in this repo and none is being introduced. Per project convention, one runnable self-check is added: `scripts/check-auth-session.js`, a pure round-trip test of `lib/session.js` (sign a payload, verify it, assert it matches; assert a tampered token fails verification). It requires no network or database access, so it can run in CI-less local dev with `node scripts/check-auth-session.js`.

The OAuth exchange itself (steps 2–4 of the data flow) can only be verified manually against real Google credentials in a deployed environment — there is no meaningful way to unit-test a live third-party redirect flow without mocking away the part that matters.

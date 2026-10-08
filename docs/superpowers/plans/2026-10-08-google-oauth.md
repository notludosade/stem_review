# Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Continue with Google" to STEM+'s existing login page, so a student can sign into the same stable `users.id` identity either with email/password or with Google, with account-linking on a verified email match and zero changes to cloud progress sync.

**Architecture:** A hand-rolled OAuth 2.0 Authorization Code flow (no npm dependency) across two new API routes (`/api/auth/google/start`, `/api/auth/google/callback`) and one new pure-logic file (`lib/oauth-google.js`). The callback issues the exact same session cookie format `lib/session.js` already produces for email login, so every existing gated route (including `/api/progress`) treats a Google-authenticated user identically to an email-authenticated one. One new DB table (`oauth_accounts`) links a Google identity to a `users.id`; no other table changes.

**Tech Stack:** Next.js Pages Router API routes, Neon Postgres via the existing `lib/db.js`, Node's built-in `crypto` and global `fetch` (already used server-side in `lib/anthropic.js`), the existing `lib/session.js` HMAC cookie signer — no new dependencies.

## Global Constraints

- **Redirect URIs are already registered with Google and cannot change**: `https://stem-review.vercel.app/api/auth/google/callback` and `http://localhost:3000/api/auth/google/callback`. The route paths MUST be exactly `/api/auth/google/start` and `/api/auth/google/callback`.
- **Scopes requested: exactly `openid email profile`.** Never anything broader.
- **One STEM+ identity, multiple sign-in methods.** Never create a second `users` row for an email that already has one. Account linking is keyed ONLY on Google's `email_verified: true` claim — an unverified email must never be used to link or match an existing account.
- **`GOOGLE_CLIENT_SECRET` is server-only.** It must never appear in any client-side JS, HTML, or STEM Lite. `GOOGLE_CLIENT_ID` is not secret (it's embedded in the public authorization-redirect URL by design) and needs no special handling.
- **Zero changes to cloud progress sync** (`public/assets/progress-sync.js`, `pages/api/progress.js`, the `progress_sync` table) or to any of the five feature files it already doesn't touch. A Google-authenticated session must be indistinguishable from an email-authenticated one to all of that code — same `{userId, isDeveloper, exp}` session payload shape, same `sign()`/`verify()` from `lib/session.js`.
- **`scripts/migrate.js` runs against the live production Neon database** — no dev/staging DB, same as every prior migration.
- **Never redirect to an absolute or protocol-relative URL from a `next` parameter** — only a same-site relative path starting with `/` and not `//`, matching the validation `content/login.html`'s existing `nextUrl()` already does client-side.
- **Error responses must never leak a raw stack trace or OAuth response object to the browser.** Every failure path redirects to `/login.html?google_error=<code>` with one of exactly three codes: `cancelled`, `expired`, `failed`.
- **STEM Lite** (`scripts/build-stem-lite.js`) must not be touched by this plan — it has no login page and nothing here is reachable from its static build.

---

### Task 1: OAuth pure-logic module

**Files:**
- Create: `lib/oauth-google.js`
- Create: `scripts/check-oauth-google.js`
- Modify: `package.json` (add the new check to the `"test"` script chain, immediately after `node scripts/check-password.js`)

**Interfaces:**
- Produces (used by Tasks 2 and 3):
  - `safeNextPath(next: unknown): string` — returns `next` if it's a same-site relative path (starts with `/`, not `//`), else `'/'`.
  - `redirectUriForRequest({ host, forwardedProto }): string` — builds `http(s)://<host>/api/auth/google/callback`, using `https` unless `host` starts with `localhost`, or `forwardedProto` says otherwise.
  - `buildAuthUrl({ clientId, redirectUri, state }): string` — the full `accounts.google.com` authorization URL.
  - `decodeIdToken(idToken: string): object | null` — decodes a JWT's middle (payload) segment as JSON; returns `null` on any malformed input.
  - `validateGoogleClaims(claims: object | null, clientId: string): { ok: true, claims } | { ok: false, error: string }` — checks issuer, audience, expiry, and that `sub`/`email` are present.
  - `decideLinkAction({ existingLinkUserId, existingUserIdByEmail, emailVerified }): { action: 'use_existing_link' | 'link_to_existing_user', userId } | { action: 'create_new_user' }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-oauth-google.js`:

```js
'use strict';

const assert = require('node:assert');
const {
  safeNextPath, redirectUriForRequest, buildAuthUrl,
  decodeIdToken, validateGoogleClaims, decideLinkAction,
} = require('../lib/oauth-google');

// safeNextPath
assert.strictEqual(safeNextPath('/diagnostic.html'), '/diagnostic.html');
assert.strictEqual(safeNextPath('//evil.example/'), '/', 'protocol-relative path must be rejected');
assert.strictEqual(safeNextPath('https://evil.example/'), '/', 'absolute URL must be rejected');
assert.strictEqual(safeNextPath(undefined), '/');
assert.strictEqual(safeNextPath(null), '/');
assert.strictEqual(safeNextPath(42), '/');

// redirectUriForRequest
assert.strictEqual(
  redirectUriForRequest({ host: 'stem-review.vercel.app', forwardedProto: 'https' }),
  'https://stem-review.vercel.app/api/auth/google/callback'
);
assert.strictEqual(
  redirectUriForRequest({ host: 'localhost:3000', forwardedProto: undefined }),
  'http://localhost:3000/api/auth/google/callback'
);

// buildAuthUrl
const authUrl = buildAuthUrl({ clientId: 'abc123', redirectUri: 'https://stem-review.vercel.app/api/auth/google/callback', state: 'xyz' });
assert.ok(authUrl.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'));
const authUrlParams = new URL(authUrl).searchParams;
assert.strictEqual(authUrlParams.get('client_id'), 'abc123');
assert.strictEqual(authUrlParams.get('redirect_uri'), 'https://stem-review.vercel.app/api/auth/google/callback');
assert.strictEqual(authUrlParams.get('response_type'), 'code');
assert.strictEqual(authUrlParams.get('scope'), 'openid email profile');
assert.strictEqual(authUrlParams.get('state'), 'xyz');

// decodeIdToken — build a fake (unsigned, that's fine — we only decode, never verify a signature) JWT
function fakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesignature`;
}
const futureExp = Math.floor(Date.now() / 1000) + 3600;
const goodClaims = { iss: 'https://accounts.google.com', aud: 'abc123', exp: futureExp, sub: 'google-user-1', email: 'student@example.com', email_verified: true, name: 'Ada Lovelace' };
assert.deepStrictEqual(decodeIdToken(fakeJwt(goodClaims)), goodClaims);
assert.strictEqual(decodeIdToken('not-a-jwt'), null);
assert.strictEqual(decodeIdToken('only.two'), null);
assert.strictEqual(decodeIdToken('a.' + Buffer.from('not json').toString('base64url') + '.c'), null);

// validateGoogleClaims
assert.deepStrictEqual(validateGoogleClaims(goodClaims, 'abc123'), { ok: true, claims: goodClaims });
assert.strictEqual(validateGoogleClaims(null, 'abc123').ok, false);
assert.strictEqual(validateGoogleClaims({ ...goodClaims, iss: 'https://evil.example' }, 'abc123').ok, false, 'wrong issuer must be rejected');
assert.strictEqual(validateGoogleClaims({ ...goodClaims, aud: 'someone-elses-client-id' }, 'abc123').ok, false, 'wrong audience must be rejected');
assert.strictEqual(validateGoogleClaims({ ...goodClaims, exp: Math.floor(Date.now() / 1000) - 3600 }, 'abc123').ok, false, 'expired token must be rejected');
assert.strictEqual(validateGoogleClaims({ ...goodClaims, sub: undefined }, 'abc123').ok, false, 'missing subject must be rejected');
assert.strictEqual(validateGoogleClaims({ ...goodClaims, email: undefined }, 'abc123').ok, false, 'missing email must be rejected');
assert.strictEqual(validateGoogleClaims({ ...goodClaims, iss: 'accounts.google.com' }, 'abc123').ok, true, 'bare-domain issuer form must also be accepted');

// decideLinkAction
assert.deepStrictEqual(
  decideLinkAction({ existingLinkUserId: 42, existingUserIdByEmail: null, emailVerified: true }),
  { action: 'use_existing_link', userId: 42 },
  'a returning Google user must always win over any email lookup'
);
assert.deepStrictEqual(
  decideLinkAction({ existingLinkUserId: null, existingUserIdByEmail: 7, emailVerified: true }),
  { action: 'link_to_existing_user', userId: 7 }
);
assert.deepStrictEqual(
  decideLinkAction({ existingLinkUserId: null, existingUserIdByEmail: 7, emailVerified: false }),
  { action: 'create_new_user' },
  'an unverified email match must never be used to link accounts'
);
assert.deepStrictEqual(
  decideLinkAction({ existingLinkUserId: null, existingUserIdByEmail: null, emailVerified: true }),
  { action: 'create_new_user' }
);

console.log('check-oauth-google: OK (next-path validation, redirect URI construction, auth URL, ID-token decoding, claims validation, and account-linking decisions all verified)');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check-oauth-google.js`
Expected: `Error: Cannot find module '../lib/oauth-google'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/oauth-google.js`:

```js
'use strict';

const VALID_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

function safeNextPath(next) {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

function redirectUriForRequest({ host, forwardedProto }) {
  const protocol = forwardedProto || (host && host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}/api/auth/google/callback`;
}

function buildAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// The id_token arrives via a direct server-to-server POST to Google's own
// token endpoint (authenticated with our client secret), not from the
// browser — so decoding the payload without re-verifying its signature is
// an accepted trust boundary here (see the design spec). We do still check
// issuer/audience/expiry below, which guards against misconfiguration.
function decodeIdToken(idToken) {
  if (typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function validateGoogleClaims(claims, clientId) {
  if (!claims) return { ok: false, error: 'missing claims' };
  if (!VALID_ISSUERS.has(claims.iss)) return { ok: false, error: 'invalid issuer' };
  if (claims.aud !== clientId) return { ok: false, error: 'invalid audience' };
  if (!claims.exp || Date.now() >= claims.exp * 1000) return { ok: false, error: 'expired' };
  if (!claims.sub || typeof claims.sub !== 'string') return { ok: false, error: 'missing subject' };
  if (typeof claims.email !== 'string') return { ok: false, error: 'missing email' };
  return { ok: true, claims };
}

function decideLinkAction({ existingLinkUserId, existingUserIdByEmail, emailVerified }) {
  if (existingLinkUserId) return { action: 'use_existing_link', userId: existingLinkUserId };
  if (emailVerified && existingUserIdByEmail) return { action: 'link_to_existing_user', userId: existingUserIdByEmail };
  return { action: 'create_new_user' };
}

module.exports = {
  VALID_ISSUERS, safeNextPath, redirectUriForRequest, buildAuthUrl,
  decodeIdToken, validateGoogleClaims, decideLinkAction,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/check-oauth-google.js`
Expected: `check-oauth-google: OK (next-path validation, redirect URI construction, auth URL, ID-token decoding, claims validation, and account-linking decisions all verified)`

- [ ] **Step 5: Wire into the test chain**

In `package.json`, find this exact substring (the start of the `"test"` script):

```
node scripts/check-auth-session.js && node scripts/check-password.js && node scripts/check-content.js
```

Replace with:

```
node scripts/check-auth-session.js && node scripts/check-password.js && node scripts/check-oauth-google.js && node scripts/check-content.js
```

Run: `npm test`
Expected: the full chain runs to completion; `check-oauth-google: OK (...)` appears right after `check-password`'s output line and before `check-content`'s.

- [ ] **Step 6: Commit**

```bash
git add lib/oauth-google.js scripts/check-oauth-google.js package.json
git commit -m "Add Google OAuth pure logic: claims validation and account-linking decision"
```

---

### Task 2: `/api/auth/google/start` route

**Files:**
- Create: `pages/api/auth/google/start.js`

**Interfaces:**
- Consumes: `safeNextPath`, `redirectUriForRequest`, `buildAuthUrl` from `lib/oauth-google.js` (Task 1); `sign` from `lib/session.js` (existing).
- Produces: a `GET /api/auth/google/start?next=<path>` route that 302-redirects to Google and sets an `oauth_state` cookie. Task 3's callback route depends on the exact cookie name (`oauth_state`), its signed payload shape (`{state, next, exp}`), and its `Path=/api/auth/google` scoping.

- [ ] **Step 1: Write the route**

Create `pages/api/auth/google/start.js`:

```js
const crypto = require('crypto');
const { sign } = require('../../../../lib/session');
const { safeNextPath, redirectUriForRequest, buildAuthUrl } = require('../../../../lib/oauth-google');

module.exports = (req, res) => {
  const next = safeNextPath(req.query.next);
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = redirectUriForRequest({
    host: req.headers.host,
    forwardedProto: req.headers['x-forwarded-proto'],
  });
  const stateToken = sign({ state, next, exp: Date.now() + 10 * 60 * 1000 }, process.env.SESSION_SECRET);

  res.setHeader('Set-Cookie', `oauth_state=${stateToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/auth/google`);
  res.statusCode = 302;
  res.setHeader('Location', buildAuthUrl({ clientId: process.env.GOOGLE_CLIENT_ID, redirectUri, state }));
  res.end();
};
```

- [ ] **Step 2: Manual verification**

Kill anything already on port 3200, build, and start:

```bash
lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9
npm run build
npm run start -- -p 3200 &
sleep 4
```

```bash
curl -s -D - -o /dev/null "http://localhost:3200/api/auth/google/start?next=/diagnostic.html"
```

Expected: `HTTP/1.1 302`, a `location:` header starting with `https://accounts.google.com/o/oauth2/v2/auth?` and containing `redirect_uri=http%3A%2F%2Flocalhost%3A3200%2Fapi%2Fauth%2Fgoogle%2Fcallback` (note: this differs from the two URIs actually registered with Google, since this manual test runs on port 3200, not 3000 — that's expected and fine for checking the route's *logic*; real end-to-end testing against Google itself must run on port 3000, which Task 5 covers) and `scope=openid+email+profile` and `client_id=<whatever GOOGLE_CLIENT_ID is set to>`, plus a `set-cookie:` header starting with `oauth_state=`.

Also check a bad `next` is rejected:

```bash
curl -s -D - -o /dev/null "http://localhost:3200/api/auth/google/start?next=//evil.example/"
```

Expected: the `location:` header's `redirect_uri` param still points at this site's own callback (confirming the open-redirect attempt didn't leak anywhere) — the state cookie itself encodes `next=/` in this case, which isn't visible in this curl command directly, but Task 5's fuller verification confirms the end-to-end rejection.

- [ ] **Step 3: Commit**

```bash
git add pages/api/auth/google/start.js
git commit -m "Add /api/auth/google/start route"
```

---

### Task 3: Database migration and `/api/auth/google/callback` route

**Files:**
- Modify: `scripts/migrate.js`
- Create: `pages/api/auth/google/callback.js`

**Interfaces:**
- Consumes: `redirectUriForRequest`, `decodeIdToken`, `validateGoogleClaims`, `decideLinkAction` from `lib/oauth-google.js` (Task 1); `sign`, `verify` from `lib/session.js`; `getDb` from `lib/db.js`; the `oauth_state` cookie contract from Task 2.
- Produces: `GET /api/auth/google/callback` — on success, sets the same `session` cookie format every other auth route produces and 302-redirects to the validated `next` path.

- [ ] **Step 1: Add the table and schema relaxation to the migration script**

In `scripts/migrate.js`, after the existing `alter table users add column if not exists last_plan_generated_at timestamptz` line and before the `reports` table block, add:

```js
  // Google (and future OAuth providers') identity links — see
  // lib/oauth-google.js and pages/api/auth/google/callback.js. A row here
  // means "this provider account signs in as this STEM+ user"; the unique
  // constraint makes find-or-create race-safe for two concurrent callbacks
  // for the same Google account.
  await sql`
    create table if not exists oauth_accounts (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      provider text not null,
      provider_account_id text not null,
      created_at timestamptz not null default now(),
      unique (provider, provider_account_id)
    )
  `;
  // A Google-only user has no password to hash.
  await sql`alter table users alter column password_hash drop not null`;
```

Update the final `console.log` line from:

```js
  console.log('migrate: users, reports, content_reviews, and progress_sync tables ready');
```

to:

```js
  console.log('migrate: users, oauth_accounts, reports, content_reviews, and progress_sync tables ready');
```

- [ ] **Step 2: Run the migration against the live database**

Run: `node --env-file=.env.local scripts/migrate.js`
Expected: `migrate: users, oauth_accounts, reports, content_reviews, and progress_sync tables ready`

- [ ] **Step 3: Write the callback route**

Create `pages/api/auth/google/callback.js`:

```js
const { getDb } = require('../../../../lib/db');
const { sign, verify } = require('../../../../lib/session');
const {
  redirectUriForRequest, decodeIdToken, validateGoogleClaims, decideLinkAction,
} = require('../../../../lib/oauth-google');

function redirectToLogin(res, errorCode) {
  res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth/google');
  res.statusCode = 302;
  res.setHeader('Location', `/login.html?google_error=${errorCode}`);
  res.end();
}

module.exports = async (req, res) => {
  const { code, state: queryState, error } = req.query;

  if (error) return redirectToLogin(res, 'cancelled');

  const stateCookie = verify(req.cookies?.oauth_state, process.env.SESSION_SECRET);
  if (!stateCookie || stateCookie.state !== queryState) return redirectToLogin(res, 'expired');

  const next = stateCookie.next || '/';
  if (!code) return redirectToLogin(res, 'failed');

  try {
    const redirectUri = redirectUriForRequest({
      host: req.headers.host,
      forwardedProto: req.headers['x-forwarded-proto'],
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) return redirectToLogin(res, 'failed');
    const tokenBody = await tokenRes.json();
    const claims = decodeIdToken(tokenBody.id_token);
    const validated = validateGoogleClaims(claims, process.env.GOOGLE_CLIENT_ID);
    if (!validated.ok) return redirectToLogin(res, 'failed');

    const sql = getDb();
    const linkRows = await sql`select user_id from oauth_accounts where provider = 'google' and provider_account_id = ${validated.claims.sub}`;
    const existingLinkUserId = linkRows.length ? linkRows[0].user_id : null;

    let existingUserIdByEmail = null;
    if (!existingLinkUserId && validated.claims.email_verified) {
      const emailRows = await sql`select id from users where email = ${validated.claims.email}`;
      existingUserIdByEmail = emailRows.length ? emailRows[0].id : null;
    }

    const decision = decideLinkAction({
      existingLinkUserId,
      existingUserIdByEmail,
      emailVerified: validated.claims.email_verified === true,
    });

    let userId;
    if (decision.action === 'use_existing_link') {
      userId = decision.userId;
    } else if (decision.action === 'link_to_existing_user') {
      userId = decision.userId;
      await sql`insert into oauth_accounts (user_id, provider, provider_account_id) values (${userId}, 'google', ${validated.claims.sub})`;
    } else {
      const newUserRows = await sql`
        insert into users (email, password_hash, name)
        values (${validated.claims.email}, null, ${validated.claims.name || null})
        returning id
      `;
      userId = newUserRows[0].id;
      await sql`insert into oauth_accounts (user_id, provider, provider_account_id) values (${userId}, 'google', ${validated.claims.sub})`;
    }

    const userRows = await sql`select is_developer from users where id = ${userId}`;
    const isDeveloper = userRows.length ? userRows[0].is_developer === true : false;
    const token = sign({ userId, isDeveloper, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }, process.env.SESSION_SECRET);

    res.setHeader('Set-Cookie', [
      'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth/google',
      `session=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`,
    ]);
    res.statusCode = 302;
    res.setHeader('Location', next);
    res.end();
  } catch (err) {
    console.error('google oauth callback failed', err);
    redirectToLogin(res, 'failed');
  }
};
```

- [ ] **Step 4: Manual verification of the failure paths (no real Google account needed)**

Server should still be running from Task 2's step (if not: `npm run build && npm run start -- -p 3200 &`, `sleep 4`).

```bash
# No state cookie at all → "expired"
curl -s -D - -o /dev/null "http://localhost:3200/api/auth/google/callback?code=fake&state=abc"
# Expected: 302, location: /login.html?google_error=expired

# error= present (user cancelled on Google's side) → "cancelled"
curl -s -D - -o /dev/null "http://localhost:3200/api/auth/google/callback?error=access_denied"
# Expected: 302, location: /login.html?google_error=cancelled

# A state cookie whose value doesn't verify (tampered) → "expired"
curl -s -D - -o /dev/null -b "oauth_state=not-a-valid-signed-token" "http://localhost:3200/api/auth/google/callback?code=fake&state=abc"
# Expected: 302, location: /login.html?google_error=expired
```

For a state cookie that *does* verify but whose `code` exchange fails against the real Google endpoint (since `fake` isn't a real authorization code), you need a real signed state cookie first. Get one honestly by calling `/api/auth/google/start` and capturing its `Set-Cookie` response, then replay it:

```bash
STATE_COOKIE=$(curl -s -D - -o /dev/null "http://localhost:3200/api/auth/google/start?next=/" | grep -i '^set-cookie:' | sed -E 's/^set-cookie: ([^;]+);.*/\1/' | tr -d '\r')
STATE_VALUE=$(echo "$STATE_COOKIE" | sed -E 's/oauth_state=//' | node -e "const t=require('fs').readFileSync(0,'utf8').trim(); const body=t.split('.')[0]; console.log(JSON.parse(Buffer.from(body,'base64url').toString('utf8')).state)")
curl -s -D - -o /dev/null -b "$STATE_COOKIE" "http://localhost:3200/api/auth/google/callback?code=not-a-real-code&state=$STATE_VALUE"
# Expected: 302, location: /login.html?google_error=failed
# (the state check passes, but Google's real token endpoint rejects the fake code)
```

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate.js pages/api/auth/google/callback.js
git commit -m "Add oauth_accounts table and /api/auth/google/callback route"
```

---

### Task 4: Sign-in page UI

**Files:**
- Modify: `content/login.html`

**Interfaces:** none — this is a leaf UI change consuming the routes from Tasks 2-3 by plain link, no JS API calls.

- [ ] **Step 1: Add the Google button, divider, value-prop copy, and error display**

In `content/login.html`, replace:

```html
  <p class="subtitle">Everything on STEM+ is open without an account — signing in saves your progress across visits, shows your Dashboard, and lets you generate an AI learning plan.</p>
  <p class="auth-context" id="auth-context" hidden></p>

  <div class="auth-card">
    <div class="auth-panel">
      <h2 class="auth-heading">Sign in</h2>
      <p class="auth-error" id="login-error" hidden></p>
      <form id="login-form" class="auth-form">
```

with:

```html
  <p class="subtitle">Everything on STEM+ is open without an account. Sign in to sync your progress across every device, keep your Learning Record, save goals and diagnostics, and keep project evidence.</p>
  <p class="auth-context" id="auth-context" hidden></p>
  <p class="auth-error" id="google-error" hidden></p>

  <div class="auth-card">
    <div class="auth-panel">
      <h2 class="auth-heading">Sign in</h2>
      <p class="auth-error" id="login-error" hidden></p>
      <a class="widget-btn" id="google-signin-btn" href="/api/auth/google/start">Continue with Google</a>
      <div class="auth-divider"><span>or</span></div>
      <form id="login-form" class="auth-form">
```

- [ ] **Step 2: Wire the Google button's `next` param and error copy into the existing inline script**

In the same file's `<script>` block, replace:

```js
  function applyContext() {
    const context = document.getElementById('auth-context');
    if (!context || target === '/') return;
    context.textContent = 'You’ll return to ' + decodeURIComponent(target) + ' after signing in.';
    context.hidden = false;
  }
  applyContext();
  let resyncCount = 0;
  const resync = setInterval(() => {
    applyContext();
    resyncCount += 1;
    if (resyncCount >= 20) clearInterval(resync);
  }, 100);
```

with:

```js
  const GOOGLE_ERROR_MESSAGES = {
    cancelled: 'Google sign-in was cancelled.',
    expired: 'Your session expired. Please sign in again.',
    failed: 'We couldn’t complete Google sign-in. Please try again.',
  };

  function applyContext() {
    const context = document.getElementById('auth-context');
    if (context && target !== '/') {
      context.textContent = 'You’ll return to ' + decodeURIComponent(target) + ' after signing in.';
      context.hidden = false;
    }
    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) googleBtn.href = '/api/auth/google/start?next=' + encodeURIComponent(target);
    const googleError = document.getElementById('google-error');
    const errorCode = new URLSearchParams(location.search).get('google_error');
    if (googleError && errorCode && GOOGLE_ERROR_MESSAGES[errorCode]) {
      googleError.textContent = GOOGLE_ERROR_MESSAGES[errorCode];
      googleError.hidden = false;
    }
  }
  applyContext();
  let resyncCount = 0;
  const resync = setInterval(() => {
    applyContext();
    resyncCount += 1;
    if (resyncCount >= 20) clearInterval(resync);
  }, 100);
```

(`applyContext()` already gets re-run for ~2 seconds after mount for exactly this reason — the Next.js shell can replace this page's whole content subtree once, which would otherwise wipe a one-time DOM write. Folding the Google-button and error-banner setup into the same idempotent function reuses that existing survival mechanism instead of inventing a second one.)

- [ ] **Step 3: Add the click-feedback listener**

In the same `<script>` block, find the existing delegated submit listener:

```js
  document.addEventListener('submit', (e) => {
```

Add, directly above it (same delegation pattern, for the same reason — survives the shell's subtree swap):

```js
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'google-signin-btn') {
      e.target.textContent = 'Redirecting to Google…';
    }
  });
  document.addEventListener('submit', (e) => {
```

- [ ] **Step 4: Manual verification**

```bash
curl -s "http://localhost:3200/login.html" | grep -o 'Continue with Google'
# Expected: Continue with Google

curl -s "http://localhost:3200/login.html?google_error=cancelled" -o /dev/null -w '%{http_code}\n'
# Expected: 200 (page still loads fine with the query param present)
```

For the dynamic `next` wiring and error banner (both only take effect after the client-side script runs), use a quick headless-Chrome check — write to a scratch file, not committed:

```js
const PORT = 9333;
async function newTab(url) {
  const res = await fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return res.json();
}
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', reject);
  });
}
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function evaluate(ws, expression) {
  return send(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
}
async function main() {
  const tab = await newTab('http://localhost:3200/login.html?next=%2Fdiagnostic.html&google_error=failed');
  const ws = await connect(tab.webSocketDebuggerUrl);
  await send(ws, 'Page.enable');
  await send(ws, 'Runtime.enable');
  await new Promise((r) => setTimeout(r, 2500));
  const result = await evaluate(ws, `({
    googleHref: document.getElementById('google-signin-btn')?.href,
    errorText: document.getElementById('google-error')?.textContent,
    errorHidden: document.getElementById('google-error')?.hidden,
  })`);
  console.log(JSON.stringify(result.result.value, null, 2));
  await send(ws, 'Target.closeTarget', { targetId: tab.id });
  ws.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

```bash
pkill -f "remote-debugging-port=9333" 2>/dev/null
rm -rf /tmp/oauth-login-verify-profile
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9333 --user-data-dir=/tmp/oauth-login-verify-profile &
sleep 2
node /tmp/oauth-login-verify.mjs
```

Expected: `googleHref` ends with `/api/auth/google/start?next=%2Fdiagnostic.html`, `errorText` is `We couldn't complete Google sign-in. Please try again.`, `errorHidden` is `false`.

Clean up: `pkill -f "remote-debugging-port=9333" 2>/dev/null`

- [ ] **Step 5: Commit**

```bash
git add content/login.html
git commit -m "Add Continue with Google to the sign-in page"
```

---

### Task 5: Integration verification and human hand-off

**Files:** none — verification only, except the one `.env.local` check below.

**Interfaces:** none — this exercises Tasks 1-4 together.

- [ ] **Step 1: Confirm local Google credentials are present**

```bash
grep -oE "^[A-Za-z_]+=" .env.local | sort
```

Expected to include `GOOGLE_CLIENT_ID=` and `GOOGLE_CLIENT_SECRET=` (this check only confirms the key names are present — never print or log the actual values). If either is missing, STOP this task and ask the human to add them before continuing; nothing past this point can be verified without real credentials.

- [ ] **Step 2: Full regression — automated**

```bash
npm test
npm run build
```

Expected: full chain green (including the new `check-oauth-google: OK` line), build clean.

- [ ] **Step 3: Account-linking logic, live against the database (no real Google click-through needed for this part)**

This exercises the actual DB-touching logic in `callback.js` by calling it with a **real, valid signed state cookie** (from a real `/start` call) but intercepting before the Google token exchange is impossible without modifying code — so instead, verify the linking logic indirectly but conclusively: create a user via the normal signup endpoint, then directly insert an `oauth_accounts` row for a fake `provider_account_id` pointing at that user's id, and confirm a *second* identical insert attempt fails on the unique constraint (proving two callbacks for the same Google account can't create two links):

```bash
lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9
npm run build && npm run start -- -p 3200 &
sleep 4

EMAIL="oauth-link-test-$(date +%s)@example.com"
curl -s -c /tmp/oauth-link-test-cookies.txt -X POST http://localhost:3200/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpassword123\",\"name\":\"OAuth Link Test\"}"
# Expected: {"ok":true}

node --env-file=.env.local -e "
const { getDb } = require('./lib/db');
(async () => {
  const sql = getDb();
  const rows = await sql\`select id from users where email = \${'$EMAIL'}\`;
  const userId = rows[0].id;
  try {
    await sql\`insert into oauth_accounts (user_id, provider, provider_account_id) values (\${userId}, 'google', 'fake-sub-for-test')\`;
    console.log('first insert: OK, user_id =', userId);
    try {
      await sql\`insert into oauth_accounts (user_id, provider, provider_account_id) values (\${userId}, 'google', 'fake-sub-for-test')\`;
      console.log('SECOND INSERT SHOULD HAVE FAILED — BUG');
    } catch (err) {
      console.log('second insert correctly rejected:', err.message.slice(0, 80));
    }
  } finally {
    // Always clean up these test rows from the live DB, even if an
    // assertion above threw — this project has leaked test rows before
    // when a verification script's happy-path-only cleanup didn't run.
    await sql\`delete from oauth_accounts where provider_account_id = 'fake-sub-for-test'\`;
    await sql\`delete from users where id = \${userId}\`;
    console.log('test rows cleaned up');
  }
})();
"
```

Expected: `first insert: OK`, `second insert correctly rejected: ...duplicate key value violates unique constraint...`, `test rows cleaned up`.

- [ ] **Step 4: Full regression spot-check — confirm nothing else broke**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3200/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3200/login.html
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3200/problem-sets.html
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3200/api/me
```

Expected: `200`, `200`, `200`, `401` (not signed in — correct).

Clean up: `lsof -i :3200 -P 2>/dev/null | awk 'NR>1{print $2}' | xargs -r kill -9`

- [ ] **Step 5: Hand off the one real end-to-end click-through to the human**

Headless Chrome cannot click through Google's own real consent/account-chooser screen unattended in this environment, and this plan does not attempt to fake that — the controller running this plan must stop here and ask the human to do this manually, with exactly this checklist:

1. Run `npm run dev` (or `npm run build && npm run start`) locally on port 3000 (matching the registered `http://localhost:3000/api/auth/google/callback` redirect URI exactly — port 3200 will NOT work for this specific step, Google will reject it).
2. Visit `http://localhost:3000/login.html`, click "Continue with Google."
3. **New Google user** (an email with no existing STEM+ account): confirm it signs you in and lands you back on `/` (or wherever `next` pointed).
4. **Existing email account, same verified Google email**: sign up for a STEM+ account with email/password first using a real email you also have a Google account for, sign out, then "Continue with Google" with that same Google account — confirm you're signed into the *same* account (same name shown in the nav), not a fresh empty one.
5. **Cancel**: click "Continue with Google," then back out of Google's screen without authorizing — confirm you land back on `/login.html` with a visible "Google sign-in was cancelled" message, not an error page.
6. **Return-URL**: from any lesson or problem-set page, click "Sign in" (which should carry `next`), then "Continue with Google" — confirm you land back on that exact page afterward, not the homepage.
7. **Cloud sync**: after signing in with Google, do something that writes progress (answer a problem-set question), then open a second browser/profile and sign in with the *same* Google account — confirm the progress is there (this is the property the whole feature depends on: a Google session is a normal session as far as `progress-sync.js` is concerned).

Report back whether all seven passed before this is considered done.

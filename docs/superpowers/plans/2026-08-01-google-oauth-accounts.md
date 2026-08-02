# Google OAuth Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user sign in to STEM+ with their Google account, backed by the already-provisioned Neon Postgres database.

**Architecture:** The site stays a static HTML/CSS/vanilla-JS deploy. A new `/api` directory adds Vercel Serverless Functions (Node.js) for the three things that must run server-side: the Google OAuth redirect/callback, reading the session, and talking to Postgres. A `assets/auth.js` script on the frontend calls `/api/me` and toggles a sign-in/sign-out UI element.

**Tech Stack:** Vercel Serverless Functions (Node.js runtime), `@neondatabase/serverless` (only new dependency), Node's built-in `crypto` for session signing, Node's built-in `fetch` for talking to Google — no OAuth/JWT library, no cookie-parsing library (Vercel's Node runtime parses `req.cookies` natively).

## Global Constraints

- Frontend stays static HTML/CSS/vanilla JS — no bundler, no framework introduced.
- Only new dependency: `@neondatabase/serverless`, added to a new root `package.json` used solely by `/api`.
- No JWT/OAuth helper libraries. Google token exchange and profile lookup go through plain `fetch`. Session cookie is signed with `crypto.createHmac('sha256', ...)`.
- No cookie-parsing library — use Vercel's built-in `req.cookies` (Node.js runtime) and `res.setHeader('Set-Cookie', ...)`.
- Secrets (`DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`) live only in Vercel project env vars and local `.env.local` (already gitignored) — never committed, never hardcoded.
- `users` table has no password column — Google is the only identity source.

---

### Task 1: Neon schema + DB helper

**Files:**
- Create: `package.json` (root)
- Create: `lib/db.js`
- Create: `scripts/migrate.js`

**Interfaces:**
- Produces: `lib/db.js` exports `getDb()` — returns a `neon()` tagged-template SQL client (from `@neondatabase/serverless`), reading `DATABASE_URL` from `process.env`. Throws if `DATABASE_URL` is unset.
- Produces: Postgres table `users(id serial primary key, google_sub text unique not null, email text not null, name text, avatar_url text, created_at timestamptz not null default now())` in the Neon `production` branch.

- [ ] **Step 1: Init package.json and install the driver**

```bash
npm init -y
npm install @neondatabase/serverless
```

- [ ] **Step 2: Write the DB helper**

`lib/db.js`:
```js
const { neon } = require('@neondatabase/serverless');

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(process.env.DATABASE_URL);
}

module.exports = { getDb };
```

- [ ] **Step 3: Write the migration script**

`scripts/migrate.js`:
```js
const { neon } = require('@neondatabase/serverless');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = neon(process.env.DATABASE_URL);
  await sql`
    create table if not exists users (
      id serial primary key,
      google_sub text unique not null,
      email text not null,
      name text,
      avatar_url text,
      created_at timestamptz not null default now()
    )
  `;
  console.log('migrate: users table ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the migration against the real Neon database**

```bash
set -a; source .env.local; set +a
node scripts/migrate.js
```

Expected output: `migrate: users table ready`

- [ ] **Step 5: Verify the table exists**

```bash
set -a; source .env.local; set +a
node -e "const {neon}=require('@neondatabase/serverless'); neon(process.env.DATABASE_URL)\`select column_name from information_schema.columns where table_name='users'\`.then(r=>console.log(r.map(x=>x.column_name)))"
```

Expected output includes: `id, google_sub, email, name, avatar_url, created_at` (order may vary).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/db.js scripts/migrate.js
git commit -m "Add Neon DB helper and users table migration"
```

---

### Task 2: Session signing

**Files:**
- Create: `lib/session.js`
- Test: `scripts/check-auth-session.js`

**Interfaces:**
- Consumes: nothing (pure functions, no dependencies beyond Node's `crypto`).
- Produces: `lib/session.js` exports `sign(payload, secret) -> string` and `verify(token, secret) -> payload|null`. `payload` is a plain JSON-serializable object; callers put an `exp` (ms epoch) in it for expiry. `verify` returns `null` for a missing/malformed/tampered/expired token, otherwise the original payload object.

- [ ] **Step 1: Write the check script first (it will fail — module doesn't exist yet)**

`scripts/check-auth-session.js`:
```js
const assert = require('assert');
const { sign, verify } = require('../lib/session');

const secret = 'test-secret';

const token = sign({ userId: 1, exp: Date.now() + 60000 }, secret);
const payload = verify(token, secret);
assert.strictEqual(payload.userId, 1, 'round-trip should preserve userId');

const lastChar = token.slice(-1);
const tampered = token.slice(0, -1) + (lastChar === 'a' ? 'b' : 'a');
assert.strictEqual(verify(tampered, secret), null, 'tampered token should fail verification');

const expired = sign({ userId: 1, exp: Date.now() - 1000 }, secret);
assert.strictEqual(verify(expired, secret), null, 'expired token should fail verification');

assert.strictEqual(verify(undefined, secret), null, 'missing token should fail verification');

console.log('check-auth-session: OK');
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
node scripts/check-auth-session.js
```

Expected: `Error: Cannot find module '../lib/session'`

- [ ] **Step 3: Implement the session module**

`lib/session.js`:
```js
const crypto = require('crypto');

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [body, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

module.exports = { sign, verify };
```

- [ ] **Step 4: Run the check script again and confirm it passes**

```bash
node scripts/check-auth-session.js
```

Expected: `check-auth-session: OK`

- [ ] **Step 5: Commit**

```bash
git add lib/session.js scripts/check-auth-session.js
git commit -m "Add HMAC session signing with round-trip check"
```

---

### Task 3: OAuth API endpoints

**Files:**
- Create: `api/auth/google.js`
- Create: `api/auth/callback.js`
- Create: `api/auth/logout.js`
- Create: `api/me.js`

**Interfaces:**
- Consumes: `getDb()` from `lib/db.js` (Task 1), `sign()`/`verify()` from `lib/session.js` (Task 2).
- Produces HTTP contract:
  - `GET /api/auth/google` → 302 to Google, sets `oauth_state` cookie.
  - `GET /api/auth/callback?code&state` → verifies, upserts user, sets `session` cookie, 302 to `/`. On any failure, 302 to `/?auth_error=1`.
  - `GET /api/auth/logout` → clears `session` cookie, 302 to `/`.
  - `GET /api/me` → `200 {id, email, name, avatar_url}` if `session` cookie is valid, else `401 {error: "not signed in"}`.

- [ ] **Step 1: Write the redirect-to-Google endpoint**

`api/auth/google.js`:
```js
const crypto = require('crypto');

module.exports = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `https://${req.headers.host}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`);
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
};
```

- [ ] **Step 2: Write the callback endpoint**

`api/auth/callback.js`:
```js
const { getDb } = require('../../lib/db');
const { sign } = require('../../lib/session');

module.exports = async (req, res) => {
  const { code, state } = req.query;
  const cookieState = req.cookies?.oauth_state;

  if (!code || !state || !cookieState || state !== cookieState) {
    res.writeHead(302, { Location: '/?auth_error=1' });
    return res.end();
  }

  try {
    const redirectUri = `https://${req.headers.host}/api/auth/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error('token exchange failed');
    const { access_token } = await tokenRes.json();

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) throw new Error('profile fetch failed');
    const profile = await profileRes.json();

    const sql = getDb();
    const rows = await sql`
      insert into users (google_sub, email, name, avatar_url)
      values (${profile.sub}, ${profile.email}, ${profile.name}, ${profile.picture})
      on conflict (google_sub)
      do update set email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url
      returning id
    `;
    const userId = rows[0].id;

    const token = sign(
      { userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
      process.env.SESSION_SECRET
    );

    res.setHeader('Set-Cookie', [
      `session=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`,
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`,
    ]);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    res.writeHead(302, { Location: '/?auth_error=1' });
    res.end();
  }
};
```

- [ ] **Step 3: Write the logout endpoint**

`api/auth/logout.js`:
```js
module.exports = (req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');
  res.writeHead(302, { Location: '/' });
  res.end();
};
```

- [ ] **Step 4: Write the current-user endpoint**

`api/me.js`:
```js
const { getDb } = require('../lib/db');
const { verify } = require('../lib/session');

module.exports = async (req, res) => {
  const payload = verify(req.cookies?.session, process.env.SESSION_SECRET);
  if (!payload) {
    res.statusCode = 401;
    return res.json({ error: 'not signed in' });
  }

  const sql = getDb();
  const rows = await sql`select id, email, name, avatar_url from users where id = ${payload.userId}`;
  if (rows.length === 0) {
    res.statusCode = 401;
    return res.json({ error: 'not signed in' });
  }

  res.statusCode = 200;
  res.json(rows[0]);
};
```

- [ ] **Step 5: Set the required env vars in Vercel and locally**

In the Vercel project dashboard (Settings → Environment Variables), add:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (from the Google Cloud OAuth client created for this project; authorized redirect URI must be `https://<production-domain>/api/auth/callback`)
- `SESSION_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DATABASE_URL` is already set from the earlier `neon env pull`; add the same value to Vercel's env vars too (Neon's Vercel integration can also sync this automatically).

Append the same three new vars to local `.env.local` for local testing.

- [ ] **Step 6: Deploy and manually verify the full OAuth round trip**

```bash
git add api/ lib/db.js
git commit -m "Add Google OAuth endpoints"
git push
```

On the production domain (not the deployed preview URL — `redirect_uri` is derived from `req.headers.host`, and only the production domain is registered as an authorized redirect URI in Step 5, so a preview URL will fail with `redirect_uri_mismatch`): visit `/api/auth/google`, complete the Google consent screen, confirm you land back on `/` with a `session` cookie set, and that `/api/me` returns your Google profile (`id`, `email`, `name`, `avatar_url`) as JSON. Then visit `/api/auth/logout` and confirm `/api/me` now returns `401`.

If preview-testing is specifically wanted, a Vercel branch-alias URL (`<project>-git-<branch>-<team>.vercel.app`, stable across pushes to the branch) can be added as a second authorized redirect URI in the Google OAuth client — but production is the default path for this verification step.

---

### Task 4: Frontend wiring

**Files:**
- Create: `assets/auth.js`
- Modify: `index.html:5-6`

**Interfaces:**
- Consumes: `GET /api/me` contract, `/api/auth/google`, `/api/auth/logout` URLs (Task 3).
- Produces: a `.auth-slot` element convention — any page can render sign-in state by adding `<span class="auth-slot"></span>` plus `<script src="assets/auth.js" defer></script>`.

- [ ] **Step 1: Write the client-side auth script**

`assets/auth.js`:
```js
(async function () {
  const slot = document.querySelector('.auth-slot');
  if (!slot) return;

  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const user = await res.json();
      slot.innerHTML = `<span>${user.name}</span> · <a href="/api/auth/logout">Sign out</a>`;
    } else {
      slot.innerHTML = '<a href="/api/auth/google">Sign in with Google</a>';
    }
  } catch (err) {
    slot.innerHTML = '<a href="/api/auth/google">Sign in with Google</a>';
  }
})();
```

- [ ] **Step 2: Wire it into the homepage**

Modify `index.html:5-6` — add the auth slot next to the existing kicker/title, and load the script at the end of the file:

```html
<div class="page">
  <span class="kicker">STEM+</span>
  <span class="auth-slot"></span>
  <h1>STEM+</h1>
```

Add before the closing of the file (after the `<footer>` block):
```html
<script src="assets/auth.js" defer></script>
```

- [ ] **Step 3: Verify in the browser**

Open the deployed preview's homepage signed out — confirm "Sign in with Google" appears in the `.auth-slot`. Click it, complete sign-in, land back on `/`, confirm the slot now shows your name and "Sign out". Click "Sign out", confirm it reverts to "Sign in with Google".

- [ ] **Step 4: Commit**

```bash
git add assets/auth.js index.html
git commit -m "Wire Google sign-in into the homepage header"
```

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
assert.strictEqual(validateGoogleClaims({ ...goodClaims, exp: 'not-a-number' }, 'abc123').ok, false, 'non-numeric exp must be rejected');
assert.strictEqual(validateGoogleClaims({ ...goodClaims, exp: undefined }, 'abc123').ok, false, 'missing exp must be rejected');

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

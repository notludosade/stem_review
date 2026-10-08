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

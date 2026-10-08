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

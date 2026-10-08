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

// The one place a login session cookie is built. Every auth route (email
// login, signup, Google callback) must emit a byte-identical cookie — the
// cloud progress sync relies on a Google session being indistinguishable
// from an email one — so they all go through here rather than each keeping
// its own copy of the payload shape and cookie attributes.
function sessionCookie(userId, isDeveloper) {
  const token = sign({ userId, isDeveloper, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }, process.env.SESSION_SECRET);
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`;
}

module.exports = { sign, verify, sessionCookie };

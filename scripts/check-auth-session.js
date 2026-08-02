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

const assert = require('assert');
const { hashPassword, verifyPassword } = require('../lib/password');

const stored = hashPassword('correct horse battery staple');
assert.strictEqual(verifyPassword('correct horse battery staple', stored), true, 'correct password should verify');
assert.strictEqual(verifyPassword('wrong password', stored), false, 'wrong password should fail');
assert.strictEqual(verifyPassword('correct horse battery staple', hashPassword('correct horse battery staple')) , true, 'two hashes of the same password should each verify independently (different salts)');

const stored2 = hashPassword('another password');
assert.notStrictEqual(stored, stored2, 'sanity: different passwords produce different stored values');
assert.notStrictEqual(hashPassword('same').split(':')[0], hashPassword('same').split(':')[0], 'salts should be random per call');

console.log('check-password: OK');

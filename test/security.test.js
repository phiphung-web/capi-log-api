const assert = require('assert');
const crypto = require('crypto');
const test = require('node:test');

process.env.APP_SECRET = 'unit-test-secret';

const {
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} = require('../src/utils/security');

function signedToken(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.APP_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

test('password hashing verifies valid passwords only', () => {
  const storedHash = hashPassword('correct-password');

  assert.equal(verifyPassword('correct-password', storedHash), true);
  assert.equal(verifyPassword('wrong-password', storedHash), false);
  assert.equal(verifyPassword('correct-password', 'salt:short-hash'), false);
});

test('session tokens reject malformed, tampered, and expired payloads', () => {
  const token = signToken({ user_id: 123 });

  assert.equal(verifyToken(token).user_id, 123);
  assert.equal(verifyToken('not-a-token'), null);
  assert.equal(verifyToken(`${token}extra`), null);
  assert.equal(verifyToken(signedToken({ user_id: 123, exp: 1 })), null);
});

test('session tokens honor custom expiration windows', () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signToken({ user_id: 123 }, { expiresInSeconds: 60 });
  const payload = verifyToken(token);

  assert.equal(payload.user_id, 123);
  assert.ok(payload.exp >= now + 55);
  assert.ok(payload.exp <= now + 65);
  assert.equal(verifyToken(signToken({ user_id: 123 }, { expiresInSeconds: -10 })), null);
});

test('session tokens reject signed non-json payloads', () => {
  const encodedPayload = Buffer.from('not json').toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.APP_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  assert.equal(verifyToken(`${encodedPayload}.${signature}`), null);
});

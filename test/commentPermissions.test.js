const test = require('node:test');
const assert = require('node:assert/strict');
const { canComment } = require('../frontend/src/commentPermissions.mjs');

test('commenting requires a completed user profile', async () => {
  const { canComment } = await import('../frontend/src/commentPermissions.mjs');
  assert.equal(canComment(null), false);
  assert.equal(canComment({ id: 'u1', needsProfileSetup: true }), false);
  assert.equal(canComment({ id: 'u1', needsProfileSetup: false }), true);
});

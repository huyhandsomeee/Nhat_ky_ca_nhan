const test = require('node:test');
const assert = require('node:assert/strict');

const relationships = (() => {
  try { return require('../backend/services/communityRelationship'); }
  catch { return null; }
})();

test('relationship state prioritizes self, block, friendship, then pending request', () => {
  assert.deepEqual(relationships?.getRelationshipState({ currentUserId: 'a', targetUserId: 'a' }), { state: 'self' });
  assert.deepEqual(relationships?.getRelationshipState({ currentUserId: 'a', targetUserId: 'b', blocked: true }), { state: 'unavailable' });
  assert.deepEqual(relationships?.getRelationshipState({ currentUserId: 'a', targetUserId: 'b', friends: true }), { state: 'friends' });
  assert.deepEqual(relationships?.getRelationshipState({
    currentUserId: 'a', targetUserId: 'b', pendingRequest: { id: 'r1', senderId: 'a', recipientId: 'b' }
  }), { state: 'outgoing', requestId: 'r1' });
  assert.deepEqual(relationships?.getRelationshipState({
    currentUserId: 'a', targetUserId: 'b', pendingRequest: { id: 'r2', senderId: 'b', recipientId: 'a' }
  }), { state: 'incoming', requestId: 'r2' });
  assert.deepEqual(relationships?.getRelationshipState({ currentUserId: 'a', targetUserId: 'b' }), { state: 'none' });
});

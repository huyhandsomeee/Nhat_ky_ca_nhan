const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canMessage,
  canInteractWithEntry,
  normalizeReaction,
  normalizeUsernameSearch
} = require('../src/domain/communityRules');

test('messaging is allowed only between friends who have not blocked each other', () => {
  assert.equal(canMessage({ areFriends: true, blocked: false }), true);
  assert.equal(canMessage({ areFriends: false, blocked: false }), false);
  assert.equal(canMessage({ areFriends: true, blocked: true }), false);
});

test('comment reactions and replies require a public entry', () => {
  assert.equal(canInteractWithEntry({ visibility: 'public' }), true);
  assert.equal(canInteractWithEntry({ visibility: 'private' }), false);
  assert.equal(canInteractWithEntry(null), false);
});

test('reaction values are restricted to the supported emoji set', () => {
  assert.equal(normalizeReaction('❤️'), '❤️');
  assert.equal(normalizeReaction('👎'), null);
});

test('username search is trimmed, lowercased, and bounded', () => {
  assert.equal(normalizeUsernameSearch('  MAY_be  '), 'may_be');
  assert.equal(normalizeUsernameSearch('x'.repeat(80)).length, 30);
  assert.equal(normalizeUsernameSearch('  '), '');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEntryInput, normalizeEntryInput, canReadEntry, canDeleteComment } = require('../backend/domain/entryRules');

const today = '2026-10-22';

test('rejects an entry without a title, content, or valid date', () => {
  const errors = validateEntryInput({ title: ' ', content: '', journalDate: 'not-a-date' }, today);

  assert.deepEqual(errors.map((error) => error.field).sort(), ['content', 'journalDate', 'title']);
});

test('rejects a journal date in the future', () => {
  const errors = validateEntryInput({ title: 'Hôm nay', content: 'Ghi chép', journalDate: '2026-10-23' }, today);

  assert.ok(errors.some((error) => error.field === 'journalDate'));
});

test('normalizes optional mood and free-form tags while defaulting to private', () => {
  const value = normalizeEntryInput({
    title: '  Một ngày bình yên  ',
    content: '  Mình đi dạo.  ',
    journalDate: today,
    mood: 'bình yên',
    tags: ['  gia đình ', 'đi dạo', 'gia đình']
  });

  assert.deepEqual(value, {
    title: 'Một ngày bình yên',
    content: 'Mình đi dạo.',
    journalDate: today,
    mood: 'bình yên',
    tags: ['gia đình', 'đi dạo'],
    visibility: 'private'
  });
});

test('only the owner can read a private entry; public entries are readable by guests', () => {
  const privateEntry = { visibility: 'private', author: 'owner-1' };
  const publicEntry = { visibility: 'public', author: 'owner-1' };

  assert.equal(canReadEntry(privateEntry, null), false);
  assert.equal(canReadEntry(privateEntry, 'owner-1'), true);
  assert.equal(canReadEntry(privateEntry, 'reader-2'), false);
  assert.equal(canReadEntry(publicEntry, null), true);
});

test('only the comment author or entry owner can delete a comment', () => {
  const entry = { author: 'owner-1' };
  const comment = { author: 'commenter-2' };

  assert.equal(canDeleteComment(comment, entry, 'commenter-2'), true);
  assert.equal(canDeleteComment(comment, entry, 'owner-1'), true);
  assert.equal(canDeleteComment(comment, entry, 'stranger-3'), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDateTagFilter, isCalendarDate } = require('../backend/domain/entrySearch');

test('builds exact journal-date and case-insensitive hashtag filters', () => {
  assert.deepEqual(buildDateTagFilter({ date: '2026-11-01', tag: '#Tâm trạng' }), {
    journalDate: '2026-11-01',
    tags: { $regex: '^Tâm trạng$', $options: 'i' }
  });
});

test('escapes hashtag text so it matches a literal tag', () => {
  assert.deepEqual(buildDateTagFilter({ tag: 'du-lich+' }), {
    tags: { $regex: '^du-lich\\+$', $options: 'i' }
  });
});

test('accepts only real YYYY-MM-DD calendar dates', () => {
  assert.equal(isCalendarDate('2024-02-29'), true);
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2026-2-09'), false);
});

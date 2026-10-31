const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateStreaks } = require('../backend/domain/diaryStats');

test('streak deduplicates dates and accepts yesterday as current', () => {
  assert.deepEqual(calculateStreaks(['2026-10-27', '2026-10-28', '2026-10-28', '2026-10-29'], '2026-10-30'), { currentStreak: 3, longestStreak: 3 });
});

test('current streak resets after a gap while longest remains', () => {
  assert.deepEqual(calculateStreaks(['2026-10-20', '2026-10-21', '2026-10-24'], '2026-10-26'), { currentStreak: 0, longestStreak: 2 });
});

test('today starts a new streak and backfilled dates contribute to longest', () => {
  assert.deepEqual(calculateStreaks(['2026-10-01', '2026-10-02', '2026-10-31'], '2026-10-31'), { currentStreak: 1, longestStreak: 2 });
});

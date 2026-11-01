const test = require('node:test');
const assert = require('node:assert/strict');
const { moodsByDateFromLatestEntries, summarizeMoodWeek } = require('../backend/domain/moodStats');

test('uses the newest entry with a mood for each date', () => {
  const entries = [
    { journalDate: '2026-10-31', mood: 'vui' },
    { journalDate: '2026-10-31', mood: 'buồn' },
    { journalDate: '2026-10-30', mood: null }
  ];

  assert.deepEqual(moodsByDateFromLatestEntries(entries), { '2026-10-31': 'vui' });
});

test('counts one mood per day and tracks days with no mood separately', () => {
  const week = [
    { date: '2026-10-26', mood: 'vui' },
    { date: '2026-10-27', mood: 'vui' },
    { date: '2026-10-28', mood: 'bình yên' },
    { date: '2026-10-29', mood: null },
    { date: '2026-10-30', mood: null },
    { date: '2026-10-31', mood: 'vui' },
    { date: '2026-11-01', mood: null }
  ];

  assert.deepEqual(summarizeMoodWeek(week), { weekMoodDays: 4, weekMoodCounts: { vui: 3, 'bình yên': 1 } });
});

test('summarizes an empty week with no mood days', () => {
  assert.deepEqual(summarizeMoodWeek(Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${String(26 + index).padStart(2, '0')}`, mood: null }))), { weekMoodDays: 0, weekMoodCounts: {} });
});

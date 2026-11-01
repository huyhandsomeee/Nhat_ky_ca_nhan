const test = require('node:test');
const assert = require('node:assert/strict');

test('chooses a different daily prompt when the user asks to change it', async () => {
  const { getAlternativeDailyPrompt, getDailyPrompt } = await import('../frontend/src/shared/dailyPrompt.mjs');
  const current = getDailyPrompt(new Date('2026-10-31T08:00:00Z'));

  assert.notEqual(getAlternativeDailyPrompt(current, () => 0), current);
});

test('chooses deterministically from the alternatives', async () => {
  const { getAlternativeDailyPrompt, getDailyPrompt } = await import('../frontend/src/shared/dailyPrompt.mjs');
  const current = getDailyPrompt(new Date('2026-10-31T08:00:00Z'));
  const next = getAlternativeDailyPrompt(current, () => 0.25);

  assert.notEqual(next, current);
  assert.equal(getAlternativeDailyPrompt(current, () => 0.25), next);
});

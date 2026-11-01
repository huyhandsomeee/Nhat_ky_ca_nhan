const test = require('node:test');
const assert = require('node:assert/strict');
const { PAGE_SIZE, getPageWindow } = require('../frontend/src/shared/pagination.mjs');

test('public feed pages contain seven entries', () => {
  assert.equal(PAGE_SIZE, 7);
});

test('page navigation keeps a compact window around the current page', () => {
  assert.deepEqual(getPageWindow(6, 10), [4, 5, 6, 7, 8]);
  assert.deepEqual(getPageWindow(1, 3), [1, 2, 3]);
});

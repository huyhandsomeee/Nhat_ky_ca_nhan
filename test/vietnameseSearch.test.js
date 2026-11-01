const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVietnameseSearchPattern, escapeRegex } = require('../backend/domain/vietnameseSearch');

test('matches Vietnamese display names when the query omits tone marks', () => {
  const pattern = new RegExp(buildVietnameseSearchPattern('Ngo Quang Huy'), 'i');
  assert.equal(pattern.test('Ngô Quang Huy'), true);
});

test('matches Vietnamese display names when the query includes tone marks', () => {
  const pattern = new RegExp(buildVietnameseSearchPattern('Ngô'), 'i');
  assert.equal(pattern.test('Ngo'), true);
});

test('escapes regex punctuation in user input', () => {
  const pattern = new RegExp(buildVietnameseSearchPattern('a+b'), 'i');
  assert.equal(pattern.test('a+b'), true);
  assert.equal(pattern.test('aaab'), false);
  assert.equal(new RegExp(escapeRegex('a+b'), 'i').test('aaab'), false);
});

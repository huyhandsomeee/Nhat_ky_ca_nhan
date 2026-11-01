const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEntrySearch, getSearchHashtagFragment, replaceSearchHashtag, getAuthorSearchTerm, replaceSearchAuthor } = require('../frontend/src/shared/searchFilters.mjs');

test('parses a journal date and hashtag from a text query', () => {
  assert.deepEqual(parseEntrySearch('2026-11-01 #tâm_trạng'), { date: '2026-11-01', tag: 'tâm_trạng' });
  assert.deepEqual(parseEntrySearch('#tâm trạng 2026-11-01'), { date: '2026-11-01', tag: 'tâm trạng' });
});

test('suggests hashtags while typing and replaces only the active hashtag', () => {
  assert.equal(getSearchHashtagFragment('ngày #tâm'), 'tâm');
  assert.equal(replaceSearchHashtag('2026-11-01 #tâm', 'tâm trạng'), '2026-11-01 #tâm trạng');
});

test('keeps author lookup separate from date and hashtag tokens', () => {
  assert.equal(getAuthorSearchTerm('Nguyễn Văn An'), 'Nguyễn Văn An');
  assert.equal(getAuthorSearchTerm('2026-11-01 #tâm trạng @ngu'), 'ngu');
  assert.equal(replaceSearchAuthor('#tâm trạng @ngu', 'nguyenvan'), '#tâm trạng @nguyenvan');
});

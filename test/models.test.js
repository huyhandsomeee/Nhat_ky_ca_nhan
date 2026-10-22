const test = require('node:test');
const assert = require('node:assert/strict');
const Entry = require('../src/models/Entry');
const User = require('../src/models/User');
const Comment = require('../src/models/Comment');

test('entry documents keep diary date, optional mood/tags, and private visibility by default', () => {
  const entry = new Entry({
    title: 'Ngày đầu tiên',
    content: 'Một dòng ghi chép.',
    journalDate: '2026-10-22',
    author: '507f1f77bcf86cd799439011'
  });

  assert.equal(entry.visibility, 'private');
  assert.deepEqual(entry.tags, []);
  assert.equal(entry.mood, null);
  assert.equal(entry.validateSync(), undefined);
});

test('entry documents reject unsupported moods and visibility values', () => {
  const entry = new Entry({
    title: 'Ngày đầu tiên',
    content: 'Một dòng ghi chép.',
    journalDate: '2026-10-22',
    mood: 'siêu vui',
    visibility: 'friends',
    author: '507f1f77bcf86cd799439011'
  });

  const error = entry.validateSync();
  assert.ok(error.errors.mood);
  assert.ok(error.errors.visibility);
});

test('users use Google identity and a private user-selected display name', () => {
  const user = new User({ googleId: 'google-subject-1', email: 'user@example.com', displayName: 'Tên riêng' });

  assert.equal(user.validateSync(), undefined);
  assert.equal(user.passwordHash, undefined);
});

test('comments belong to both an entry and a Google-authenticated user', () => {
  const comment = new Comment({
    content: 'Cảm ơn bạn đã chia sẻ.',
    entry: '507f1f77bcf86cd799439011',
    author: '507f191e810c19729de860ea'
  });

  assert.equal(comment.validateSync(), undefined);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const Entry = require('../backend/models/Entry');
const User = require('../backend/models/User');
const Comment = require('../backend/models/Comment');

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

test('users use username, password and a private user-selected display name', async () => {
  const hash = await bcrypt.hash('secret123', 10);
  const user = new User({ username: 'huy123', password: hash, displayName: 'Huy' });

  assert.equal(user.validateSync(), undefined);
  assert.equal(user.username, 'huy123');
  assert.equal(user.displayName, 'Huy');
  assert.equal(await user.comparePassword('secret123'), true);
  assert.equal(await user.comparePassword('wrong-secret'), false);
});

test('comments belong to both an entry and an authenticated user', () => {
  const comment = new Comment({
    content: 'Cảm ơn bạn đã chia sẻ.',
    entry: '507f1f77bcf86cd799439011',
    author: '507f191e810c19729de860ea'
  });

  assert.equal(comment.validateSync(), undefined);
});

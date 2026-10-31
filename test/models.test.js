const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const Entry = require('../backend/models/Entry');
const User = require('../backend/models/User');
const Comment = require('../backend/models/Comment');
const EntryLike = require('../backend/models/EntryLike');
const SavedEntry = require('../backend/models/SavedEntry');
const Follow = require('../backend/models/Follow');
const Notification = require('../backend/models/Notification');

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

test('users store a bounded profile bio and optional avatar path', () => {
  const user = new User({
    username: 'diary_user',
    password: 'secret123',
    displayName: 'Mây',
    bio: 'Ghi lại những ngày bình thường.',
    avatarPath: '/api/avatars/2b931b4b-2612-4ae0-a71f-c0bdce6c3183.webp'
  });

  assert.equal(user.bio, 'Ghi lại những ngày bình thường.');
  assert.equal(user.avatarPath, '/api/avatars/2b931b4b-2612-4ae0-a71f-c0bdce6c3183.webp');
  assert.equal(user.validateSync(), undefined);

  const invalidBio = new User({ username: 'other_user', password: 'secret123', bio: 'x'.repeat(281) });
  assert.ok(invalidBio.validateSync().errors.bio);
});

test('comments belong to both an entry and an authenticated user', () => {
  const comment = new Comment({
    content: 'Cảm ơn bạn đã chia sẻ.',
    entry: '507f1f77bcf86cd799439011',
    author: '507f191e810c19729de860ea'
  });

  assert.equal(comment.validateSync(), undefined);
});

test('likes, saved entries, and follows have a unique user-pair index', () => {
  for (const model of [EntryLike, SavedEntry]) {
    assert.ok(model.schema.indexes().some(([keys, options]) => keys.entry === 1 && keys.user === 1 && options.unique));
  }
  assert.ok(Follow.schema.indexes().some(([keys, options]) => keys.follower === 1 && keys.author === 1 && options.unique));
});

test('entry like notifications do not require a comment reference', () => {
  const notification = new Notification({
    recipient: '507f1f77bcf86cd799439011',
    actor: '507f191e810c19729de860ea',
    type: 'entry_like',
    entry: '507f1f77bcf86cd799439012'
  });
  assert.equal(notification.comment, null);
  assert.equal(notification.validateSync(), undefined);
});

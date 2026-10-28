const test = require('node:test');
const assert = require('node:assert/strict');
const FriendRequest = require('../src/models/FriendRequest');
const Friendship = require('../src/models/Friendship');
const Block = require('../src/models/Block');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Notification = require('../src/models/Notification');
const Draft = require('../src/models/Draft');

const one = '507f1f77bcf86cd799439011';
const two = '507f191e810c19729de860ea';

test('community records require participants and valid state', () => {
  assert.equal(new FriendRequest({ sender: one, recipient: two }).validateSync(), undefined);
  assert.equal(new Friendship({ users: [one, two], pairKey: [one, two].sort().join(':') }).validateSync(), undefined);
  assert.equal(new Block({ blocker: one, blocked: two }).validateSync(), undefined);
  assert.equal(new Conversation({ users: [one, two], pairKey: [one, two].sort().join(':') }).validateSync(), undefined);
  assert.equal(new Message({ conversation: one, sender: two, content: 'Xin chào' }).validateSync(), undefined);
  assert.equal(new Notification({ recipient: one, type: 'friend_request', actor: two }).validateSync(), undefined);
  assert.equal(new Draft({ author: one, title: 'Đang viết' }).validateSync(), undefined);
});

test('messages and notification types reject unsupported values', () => {
  const message = new Message({ conversation: one, sender: two, content: 'x'.repeat(5001) });
  const notification = new Notification({ recipient: one, type: 'unknown', actor: two });
  assert.ok(message.validateSync().errors.content);
  assert.ok(notification.validateSync().errors.type);
});

test('comments can belong to another comment and store per-user reactions', () => {
  const Comment = require('../src/models/Comment');
  const comment = new Comment({
    content: 'Mình cũng nghĩ vậy.', entry: one, author: two, parentComment: two,
    reactions: [{ user: one, emoji: '❤️' }]
  });
  assert.equal(comment.validateSync(), undefined);
  const invalid = new Comment({ content: 'x', entry: one, author: two, reactions: [{ user: one, emoji: '👎' }] });
  assert.ok(invalid.validateSync().errors['reactions.0.emoji']);
});

const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Friendship = require('../models/Friendship');
const Block = require('../models/Block');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Draft = require('../models/Draft');
const { requireAuth, requireProfile } = require('../middleware/auth');
const { normalizeUsernameSearch } = require('../domain/communityRules');
const eventHub = require('../services/eventHub');
const { getRelationshipState } = require('../services/communityRelationship');

const router = express.Router();
router.use(requireAuth, requireProfile);

router.get('/events', (req, res) => {
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders?.();
  res.write('event: connected\ndata: {}\n\n');
  const unsubscribe = eventHub.subscribe(req.user._id, ({ event, data }) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});

router.get('/users', async (req, res, next) => {
  const query = normalizeUsernameSearch(req.query.q);
  if (query.length < 2) return res.json({ users: [] });
  try {
    const blocked = await Block.find({ $or: [{ blocker: req.user._id }, { blocked: req.user._id }] }).select('blocker blocked');
    const excluded = new Set([String(req.user._id)]);
    blocked.forEach((item) => { excluded.add(String(item.blocker)); excluded.add(String(item.blocked)); });
    const users = await User.find({ username: { $regex: `^${escapeRegex(query)}` }, _id: { $nin: [...excluded] } })
      .select('username displayName').sort({ username: 1 }).limit(20);
    return res.json({ users });
  } catch (error) { return next(error); }
});

router.get('/people/:id/relationship', async (req, res, next) => {
  if (!validId(req.params.id)) return notFound(res);
  const currentUserId = req.user._id;
  const targetUserId = req.params.id;
  if (String(currentUserId) === String(targetUserId)) return res.json({ relationship: { state: 'self' } });
  try {
    const exists = await User.exists({ _id: targetUserId });
    if (!exists) return notFound(res);
    const [blocked, friends, pendingRequest] = await Promise.all([
      Block.exists({ $or: [{ blocker: currentUserId, blocked: targetUserId }, { blocker: targetUserId, blocked: currentUserId }] }),
      Friendship.exists({ pairKey: sortedPair(currentUserId, targetUserId) }),
      FriendRequest.findOne({ status: 'pending', $or: [{ sender: currentUserId, recipient: targetUserId }, { sender: targetUserId, recipient: currentUserId }] }).select('_id sender recipient')
    ]);
    const relationship = getRelationshipState({
      currentUserId,
      targetUserId,
      blocked: Boolean(blocked),
      friends: Boolean(friends),
      pendingRequest: pendingRequest && { id: pendingRequest._id, senderId: pendingRequest.sender }
    });
    return res.json({ relationship });
  } catch (error) { return next(error); }
});

router.get('/requests', async (req, res, next) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ recipient: req.user._id, status: 'pending' }).populate('sender', 'username displayName').sort({ createdAt: -1 }),
      FriendRequest.find({ sender: req.user._id, status: 'pending' }).populate('recipient', 'username displayName').sort({ createdAt: -1 })
    ]);
    return res.json({ incoming, outgoing });
  } catch (error) { return next(error); }
});

router.post('/requests', async (req, res, next) => {
  const userId = String(req.body?.userId || '').trim();
  const username = normalizeUsernameSearch(req.body?.username);
  if (!userId && !username) return fail(res, 400, 'VALIDATION_ERROR', 'Chọn người cần kết bạn.');
  if (userId && !validId(userId)) return fail(res, 404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng phù hợp.');
  try {
    const target = userId ? await User.findById(userId) : await User.findOne({ username });
    if (!target || String(target._id) === String(req.user._id)) return fail(res, 404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng phù hợp.');
    if (await Block.exists({ $or: [{ blocker: req.user._id, blocked: target._id }, { blocker: target._id, blocked: req.user._id }] })) return fail(res, 404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng phù hợp.');
    if (await Friendship.exists({ pairKey: sortedPair(req.user._id, target._id) })) return fail(res, 409, 'ALREADY_FRIENDS', 'Hai bạn đã là bạn bè.');
    const pending = await FriendRequest.findOne({ status: 'pending', $or: [{ sender: req.user._id, recipient: target._id }, { sender: target._id, recipient: req.user._id }] });
    if (pending) return fail(res, 409, 'REQUEST_EXISTS', 'Đã có lời mời đang chờ phản hồi.');
    const request = await FriendRequest.create({ sender: req.user._id, recipient: target._id });
    const notification = await Notification.create({ recipient: target._id, actor: req.user._id, type: 'friend_request', reference: request._id });
    eventHub.publish(target._id, 'notification:new', { type: notification.type, actor: { displayName: req.user.displayName || req.user.username } });
    return res.status(201).json({ request });
  } catch (error) { return next(error); }
});

router.post('/requests/:id/accept', async (req, res, next) => {
  if (!validId(req.params.id)) return notFound(res);
  try {
    const request = await FriendRequest.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id, status: 'pending' }, { status: 'accepted' }, { new: true });
    if (!request) return notFound(res);
    const pairKey = sortedPair(request.sender, request.recipient);
    const users = [request.sender, request.recipient].sort((a, b) => String(a).localeCompare(String(b)));
    await Friendship.updateOne({ pairKey }, { $setOnInsert: { users, pairKey, createdBy: req.user._id } }, { upsert: true });
    await Conversation.updateOne({ pairKey }, { $set: { status: 'accepted', acceptedAt: new Date() } });
    await Notification.create({ recipient: request.sender, actor: req.user._id, type: 'friend_accepted', reference: request._id });
    eventHub.publish(request.sender, 'notification:new', { type: 'friend_accepted', actor: { displayName: req.user.displayName || req.user.username } });
    return res.json({ accepted: true });
  } catch (error) { return next(error); }
});

router.delete('/requests/:id', async (req, res, next) => {
  if (!validId(req.params.id)) return notFound(res);
  try {
    const request = await FriendRequest.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id, status: 'pending' }, { status: 'declined' }, { new: true });
    if (!request) return notFound(res);
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.get('/friends', async (req, res, next) => {
  try {
    const links = await Friendship.find({ users: req.user._id }).populate('users', 'username displayName avatarPath');
    return res.json({ friends: links.map((link) => link.users.find((user) => String(user._id) !== String(req.user._id))).filter(Boolean) });
  } catch (error) { return next(error); }
});

router.delete('/friends/:id', async (req, res, next) => {
  if (!validId(req.params.id)) return notFound(res);
  try {
    await Friendship.deleteOne({ pairKey: sortedPair(req.user._id, req.params.id) });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.post('/blocks/:id', async (req, res, next) => {
  if (!validId(req.params.id) || String(req.params.id) === String(req.user._id)) return notFound(res);
  try {
    const userExists = await User.exists({ _id: req.params.id });
    if (!userExists) return notFound(res);
    await Block.updateOne({ blocker: req.user._id, blocked: req.params.id }, { $setOnInsert: { blocker: req.user._id, blocked: req.params.id } }, { upsert: true });
    await Friendship.deleteOne({ pairKey: sortedPair(req.user._id, req.params.id) });
    await FriendRequest.updateMany({ status: 'pending', $or: [{ sender: req.user._id, recipient: req.params.id }, { sender: req.params.id, recipient: req.user._id }] }, { status: 'declined' });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.get('/blocks', async (req, res, next) => {
  try {
    const blocks = await Block.find({ blocker: req.user._id }).populate('blocked', 'username displayName').sort({ createdAt: -1 });
    return res.json({ blocks });
  } catch (error) { return next(error); }
});

router.delete('/blocks/:id', async (req, res, next) => {
  if (!validId(req.params.id)) return notFound(res);
  try { await Block.deleteOne({ blocker: req.user._id, blocked: req.params.id }); return res.status(204).end(); }
  catch (error) { return next(error); }
});

router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ users: req.user._id }).populate('users', 'username displayName avatarPath').sort({ updatedAt: -1 });
    const items = await Promise.all(conversations.map(async (conversation) => {
      const other = conversation.users.find((user) => String(user._id) !== String(req.user._id));
      if (!other || await isBlocked(req.user._id, other._id)) return null;
      const [lastMessage, unreadCount] = await Promise.all([
        Message.findOne({ conversation: conversation._id }).sort({ createdAt: -1 }),
        Message.countDocuments({ conversation: conversation._id, sender: { $ne: req.user._id }, readAt: null })
      ]);
      if (conversation.status === 'pending' && String(conversation.requestedBy) !== String(req.user._id) && !lastMessage) return null;
      return { _id: conversation._id, user: other, lastMessage, unreadCount, status: conversation.status, requestedBy: conversation.requestedBy, acceptedAt: conversation.acceptedAt };
    }));
    return res.json({ conversations: items.filter(Boolean) });
  } catch (error) { return next(error); }
});

router.post('/conversations/:userId', async (req, res, next) => {
  if (!validId(req.params.userId)) return notFound(res);
  try {
    if (String(req.user._id) === String(req.params.userId) || !await User.exists({ _id: req.params.userId })) return notFound(res);
    if (await isBlocked(req.user._id, req.params.userId)) return fail(res, 403, 'USER_UNAVAILABLE', 'Không thể gửi tin nhắn cho tài khoản này.');
    const areFriends = Boolean(await Friendship.exists({ pairKey: sortedPair(req.user._id, req.params.userId) }));
    const pairKey = sortedPair(req.user._id, req.params.userId);
    const users = [req.user._id, req.params.userId].sort((a, b) => String(a).localeCompare(String(b)));
    const conversation = await Conversation.findOneAndUpdate({ pairKey }, { $setOnInsert: { users, pairKey, status: areFriends ? 'accepted' : 'pending', requestedBy: areFriends ? null : req.user._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    if (areFriends && conversation.status === 'pending') {
      conversation.status = 'accepted';
      conversation.acceptedAt = new Date();
      await conversation.save();
    }
    return res.json({ conversation });
  } catch (error) { return next(error); }
});

router.post('/conversations/:id/accept', async (req, res, next) => {
  if (!validId(req.params.id)) return notFound(res);
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, users: req.user._id, status: 'pending' });
    if (!conversation || String(conversation.requestedBy) === String(req.user._id)) return notFound(res);
    if (await isBlocked(conversation.users[0], conversation.users[1])) return fail(res, 403, 'USER_UNAVAILABLE', 'Không thể chấp nhận lời nhắn này.');
    if (!await Message.exists({ conversation: conversation._id })) return fail(res, 409, 'MESSAGE_REQUIRED', 'Hãy chờ tin nhắn mở đầu trước khi chấp nhận.');
    conversation.status = 'accepted';
    conversation.acceptedAt = new Date();
    await conversation.save();
    eventHub.publish(conversation.requestedBy, 'conversation:accepted', { conversationId: String(conversation._id) });
    return res.json({ accepted: true });
  } catch (error) { return next(error); }
});

router.get('/conversations/:id/messages', async (req, res, next) => {
  if (!validId(req.params.id)) return notFound(res);
  try {
    const conversation = await authorizedConversation(req.params.id, req.user._id);
    if (!conversation) return fail(res, 404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.');
    await Message.updateMany({ conversation: conversation._id, sender: { $ne: req.user._id }, readAt: null }, { readAt: new Date() });
    const messages = await Message.find({ conversation: conversation._id }).populate('sender', 'displayName username').sort({ createdAt: -1 }).limit(100);
    return res.json({ messages: messages.reverse() });
  } catch (error) { return next(error); }
});

router.post('/conversations/:id/messages', async (req, res, next) => {
  if (!validId(req.params.id)) return notFound(res);
  const content = String(req.body?.content || '').trim();
  if (!content || content.length > 5000) return fail(res, 400, 'VALIDATION_ERROR', 'Tin nhắn cần từ 1 đến 5.000 ký tự.');
  try {
    const conversation = await authorizedConversation(req.params.id, req.user._id);
    if (!conversation) return fail(res, 404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.');
    const otherId = conversation.users.find((id) => String(id) !== String(req.user._id));
    if (conversation.status === 'pending') {
      const isFirstRequestMessage = String(conversation.requestedBy) === String(req.user._id) && !await Message.exists({ conversation: conversation._id });
      if (!isFirstRequestMessage) return fail(res, 403, 'MESSAGE_REQUEST_PENDING', 'Người nhận cần chấp nhận lời nhắn trước khi hai bạn có thể nhắn tiếp.');
    }
    const message = await Message.create({ conversation: conversation._id, sender: req.user._id, content });
    await message.populate('sender', 'displayName username');
    conversation.updatedAt = new Date();
    await conversation.save();
    const notification = await Notification.create({ recipient: otherId, actor: req.user._id, type: 'message', reference: message._id });
    eventHub.publish(otherId, 'message:new', { conversationId: String(conversation._id), message });
    eventHub.publish(otherId, 'notification:new', { type: notification.type, actor: { displayName: req.user.displayName || req.user.username } });
    return res.status(201).json({ message });
  } catch (error) { return next(error); }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('actor', 'username displayName')
      .populate('entry', 'title visibility')
      .sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, readAt: null });
    return res.json({ notifications, unreadCount });
  } catch (error) { return next(error); }
});

router.post('/notifications/read', async (req, res, next) => {
  try { await Notification.updateMany({ recipient: req.user._id, readAt: null }, { readAt: new Date() }); return res.status(204).end(); }
  catch (error) { return next(error); }
});

router.get('/draft', async (req, res, next) => {
  try { return res.json({ draft: await Draft.findOne({ author: req.user._id }) }); }
  catch (error) { return next(error); }
});

router.put('/draft', async (req, res, next) => {
  const data = req.body || {};
  const draft = {
    title: String(data.title || '').slice(0, 120), content: String(data.content || '').slice(0, 10000),
      journalDate: String(data.journalDate || ''), mood: data.mood || null,
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 20).map((tag) => String(tag).trim().slice(0, 30)) : [],
      taggedUsers: Array.isArray(data.taggedUsers) ? data.taggedUsers.filter(validId).slice(0, 20) : [],
    visibility: data.visibility === 'public' ? 'public' : 'private'
  };
  try {
    const saved = await Draft.findOneAndUpdate({ author: req.user._id }, { $set: draft, $setOnInsert: { author: req.user._id } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    return res.json({ draft: saved });
  } catch (error) { return next(error); }
});

router.delete('/draft', async (req, res, next) => {
  try { await Draft.deleteOne({ author: req.user._id }); return res.status(204).end(); }
  catch (error) { return next(error); }
});

async function authorizedConversation(id, userId) {
  const conversation = await Conversation.findOne({ _id: id, users: userId });
  if (!conversation) return null;
  const other = conversation.users.find((item) => String(item) !== String(userId));
  if (!other || await isBlocked(userId, other)) return null;
  return conversation;
}

async function isBlocked(first, second) {
  return Boolean(await Block.exists({ $or: [{ blocker: first, blocked: second }, { blocker: second, blocked: first }] }));
}

function sortedPair(first, second) { return [String(first), String(second)].sort().join(':'); }
function validId(value) { return mongoose.isValidObjectId(value); }
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function fail(res, status, code, message) { return res.status(status).json({ error: { code, message } }); }
function notFound(res) { return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy nội dung.'); }

module.exports = router;

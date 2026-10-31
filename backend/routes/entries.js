const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const Friendship = require('../models/Friendship');
const Notification = require('../models/Notification');
const eventHub = require('../services/eventHub');
const { requireAuth, requireProfile } = require('../middleware/auth');
const { validateEntryInput, normalizeEntryInput, canDeleteComment } = require('../domain/entryRules');

const router = express.Router();
router.use(requireAuth, requireProfile);

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const ownerOrTagged = [{ author: req.user._id }, { taggedUsers: req.user._id }];
    const filter = search ? { $and: [{ $or: ownerOrTagged }, { $or: searchConditions(search) }] } : { $or: ownerOrTagged };
    const entries = await Entry.find(filter).populate('author', 'username displayName avatarPath').populate('taggedUsers', 'username displayName').sort({ journalDate: -1, createdAt: -1 }).limit(50);
    res.json({ entries, search });
  } catch (error) {
    next(error);
  }
});

router.get('/tags/suggestions', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().replace(/^#+/, '').slice(0, 30);
    const match = { $or: [{ author: req.user._id }, { taggedUsers: req.user._id }] };
    const pipeline = [{ $match: match }, { $unwind: '$tags' }];
    if (query) pipeline.push({ $match: { tags: { $regex: escapeRegex(query), $options: 'i' } } });
    pipeline.push(
      { $group: { _id: '$tags', uses: { $sum: 1 } } },
      { $sort: { uses: -1, _id: 1 } },
      { $limit: 8 },
      { $project: { _id: 0, tag: '$_id', uses: 1 } }
    );
    return res.json({ suggestions: await Entry.aggregate(pipeline) });
  } catch (error) { return next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const errors = validateEntryInput(req.body, vietnameseToday());
    errors.push(...await validateTaggedUsers(req.body?.taggedUsers, req.user._id));
    if (errors.length) return validationResponse(res, errors);
    const entry = await Entry.create({ ...normalizeEntryInput(req.body), author: req.user._id });
    await notifyTaggedUsers(entry, entry.taggedUsers, req.user);
    await entry.populate('taggedUsers', 'username displayName avatarPath');
    return res.status(201).json({ entry });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, $or: [{ author: req.user._id }, { taggedUsers: req.user._id }] })
      .populate('author', 'username displayName avatarPath').populate('taggedUsers', 'username displayName avatarPath');
    if (!entry) return notFound(res);
    const comments = await Comment.find({ entry: entry._id }).populate('author', 'displayName').populate('reactions.user', 'displayName').sort({ createdAt: 1 });
    return res.json({ entry, comments });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, author: req.user._id });
    if (!entry) return notFound(res);
    const errors = validateEntryInput(req.body, vietnameseToday());
    errors.push(...await validateTaggedUsers(req.body?.taggedUsers, req.user._id, entry.taggedUsers));
    if (errors.length) return validationResponse(res, errors);
    const previouslyTagged = new Set(entry.taggedUsers.map(String));
    entry.set(normalizeEntryInput(req.body));
    await entry.save();
    await notifyTaggedUsers(entry, entry.taggedUsers.filter((userId) => !previouslyTagged.has(String(userId))), req.user);
    await entry.populate('taggedUsers', 'username displayName avatarPath');
    return res.json({ entry });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOneAndDelete({ _id: req.params.id, author: req.user._id });
    if (!entry) return notFound(res);
    await Comment.deleteMany({ entry: entry._id });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

router.delete('/:entryId/comments/:commentId', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.entryId) || !mongoose.isValidObjectId(req.params.commentId)) return notFound(res);
  try {
    const entry = await Entry.findById(req.params.entryId);
    if (!entry) return notFound(res);
    const comment = await Comment.findOne({ _id: req.params.commentId, entry: entry._id });
    if (!comment) return notFound(res);

    if (!canDeleteComment(comment, entry, req.user._id)) {
      if (entry.visibility === 'private') return notFound(res);
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bạn không có quyền xóa bình luận này.' } });
    }
    const hasReplies = await Comment.exists({ parentComment: comment._id });
    if (hasReplies) {
      comment.content = 'Bình luận đã được xóa.';
      comment.deleted = true;
      comment.reactions = [];
      await comment.save();
    } else {
      await comment.deleteOne();
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

function validationResponse(res, errors) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Hãy kiểm tra lại các trường đã nhập.',
      fields: Object.fromEntries(errors.map((error) => [error.field, error.message]))
    }
  });
}

function searchConditions(search) {
  const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagSearch = search.replace(/^#+/, '').trim();
  const conditions = [{ title: { $regex: pattern, $options: 'i' } }, { content: { $regex: pattern, $options: 'i' } }];
  if (tagSearch) conditions.push({ tags: { $regex: tagSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } });
  return conditions;
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function validateTaggedUsers(value, authorId, previouslyTagged = []) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [{ field: 'taggedUsers', message: 'Hãy chọn bạn bè từ danh sách.' }];
  const ids = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  if (ids.length > 20) return [{ field: 'taggedUsers', message: 'Mỗi bài viết có thể gắn thẻ tối đa 20 người bạn.' }];
  if (ids.some((id) => !mongoose.isValidObjectId(id) || id === String(authorId))) return [{ field: 'taggedUsers', message: 'Danh sách bạn bè được gắn thẻ không hợp lệ.' }];
  if (!ids.length) return [];
  const friendships = await Friendship.find({ users: authorId }).select('users');
  const friendIds = new Set(friendships.flatMap((friendship) => friendship.users.map(String)).filter((id) => id !== String(authorId)));
  const existingIds = new Set(previouslyTagged.map(String));
  return ids.every((id) => friendIds.has(id) || existingIds.has(id)) ? [] : [{ field: 'taggedUsers', message: 'Bạn chỉ có thể gắn thẻ bạn bè đã kết nối.' }];
}

async function notifyTaggedUsers(entry, userIds, actor) {
  const recipients = [...new Set(userIds.map(String))].filter((id) => id !== String(actor._id));
  await Promise.all(recipients.map(async (recipient) => {
    const notification = await Notification.create({ recipient, actor: actor._id, type: 'entry_tag', reference: entry._id, entry: entry._id });
    eventHub.publish(recipient, 'notification:new', { type: notification.type, actor: { displayName: actor.displayName || actor.username } });
  }));
}

function notFound(res) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy bài viết.' } });
}

function vietnameseToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

module.exports = router;

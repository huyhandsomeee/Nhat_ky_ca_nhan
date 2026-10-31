const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const eventHub = require('../services/eventHub');
const { requireAuth, requireProfile } = require('../middleware/auth');
const { canInteractWithEntry, normalizeReaction } = require('../domain/communityRules');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const filter = { visibility: 'public' };
    if (search) filter.$or = searchConditions(search);
    const entries = await Entry.find(filter)
      .populate('author', 'displayName avatarPath')
      .sort({ journalDate: -1, createdAt: -1 })
      .limit(50);
    const previewGroups = entries.length ? await Comment.aggregate([
      { $match: { entry: { $in: entries.map((entry) => entry._id) }, parentComment: null, deleted: { $ne: true } } },
      { $sort: { createdAt: -1 } },
      { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'commentAuthor' } },
      { $unwind: '$commentAuthor' },
      {
        $group: {
          _id: '$entry',
          comments: {
            $push: {
              _id: '$_id',
              content: '$content',
              author: {
                id: '$author',
                displayName: { $ifNull: ['$commentAuthor.displayName', 'Người viết'] },
                avatarUrl: { $ifNull: ['$commentAuthor.avatarPath', null] }
              },
              createdAt: '$createdAt'
            }
          }
        }
      },
      { $project: { comments: { $slice: ['$comments', 2] } } }
    ]) : [];
    const previewsByEntry = new Map(previewGroups.map((group) => [String(group._id), group.comments]));
    const entriesWithPreviews = entries.map((entry) => ({
      ...entry.toObject(),
      previewComments: previewsByEntry.get(String(entry._id)) || []
    }));
    return res.json({ entries: entriesWithPreviews, search });
  } catch (error) {
    return next(error);
  }
});

router.get('/tags/suggestions', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().replace(/^#+/, '').slice(0, 30);
    const pipeline = [{ $match: { visibility: 'public' } }, { $unwind: '$tags' }];
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

router.get('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' })
      .populate('author', 'displayName avatarPath')
      .populate('taggedUsers', 'username displayName');
    if (!entry) return notFound(res);
    const comments = await Comment.find({ entry: entry._id })
      .populate('author', 'displayName avatarPath')
      .populate('reactions.user', 'displayName')
      .sort({ createdAt: 1 });
    return res.json({ entry, comments });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/comments', requireAuth, requireProfile, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const content = String(req.body?.content || '').trim();
  const parentCommentId = req.body?.parentComment ? String(req.body.parentComment) : null;
  if (!content || content.length > 1000) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Bình luận cần từ 1 đến 1.000 ký tự.', fields: { content: 'Bình luận cần từ 1 đến 1.000 ký tự.' } } });
  }

  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' });
    if (!entry) return notFound(res);
    if (parentCommentId && !mongoose.isValidObjectId(parentCommentId)) return notFound(res);
    if (parentCommentId && !await Comment.exists({ _id: parentCommentId, entry: entry._id })) return notFound(res);
    const comment = await Comment.create({ content, parentComment: parentCommentId, entry: entry._id, author: req.user._id });
    await comment.populate('author', 'displayName avatarPath');
    const recipientId = parentCommentId
      ? (await Comment.findById(parentCommentId).select('author')).author
      : entry.author;
    if (String(recipientId) !== String(req.user._id)) {
      const type = parentCommentId ? 'comment_reply' : 'entry_comment';
      const notification = await Notification.create({ recipient: recipientId, actor: req.user._id, type, reference: comment._id, entry: entry._id });
      eventHub.publish(recipientId, 'notification:new', { type: notification.type, actor: { displayName: req.user.displayName || req.user.username } });
    }
    return res.status(201).json({ comment });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/comments/:commentId/reactions', requireAuth, requireProfile, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.commentId)) return notFound(res);
  const emoji = req.body?.emoji === null ? null : normalizeReaction(req.body?.emoji);
  if (req.body?.emoji !== null && !emoji) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Biểu tượng cảm xúc không được hỗ trợ.' } });
  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' });
    if (!entry || !canInteractWithEntry(entry)) return notFound(res);
    const comment = await Comment.findOne({ _id: req.params.commentId, entry: entry._id, deleted: false });
    if (!comment) return notFound(res);
    const previousEmoji = comment.reactions.find((reaction) => String(reaction.user) === String(req.user._id))?.emoji;
    comment.reactions = comment.reactions.filter((reaction) => String(reaction.user) !== String(req.user._id));
    if (emoji) comment.reactions.push({ user: req.user._id, emoji });
    await comment.save();
    if (emoji && previousEmoji !== emoji && String(comment.author) !== String(req.user._id)) {
      const notification = await Notification.create({ recipient: comment.author, actor: req.user._id, type: 'comment_reaction', reference: comment._id, entry: entry._id });
      eventHub.publish(comment.author, 'notification:new', { type: notification.type, actor: { displayName: req.user.displayName || req.user.username } });
    }
    await comment.populate('author', 'displayName avatarPath');
    await comment.populate('reactions.user', 'displayName');
    return res.json({ comment });
  } catch (error) { return next(error); }
});

function searchConditions(search) {
  const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagSearch = search.replace(/^#+/, '').trim();
  const conditions = [{ title: { $regex: pattern, $options: 'i' } }, { content: { $regex: pattern, $options: 'i' } }];
  if (tagSearch) conditions.push({ tags: { $regex: tagSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } });
  return conditions;
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function notFound(res) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy bài viết.' } });
}

module.exports = router;

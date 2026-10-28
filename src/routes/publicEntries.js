const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const { requireAuth, requireProfile } = require('../middleware/auth');
const { canInteractWithEntry, normalizeReaction } = require('../domain/communityRules');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const filter = { visibility: 'public' };
    if (search) filter.$or = searchConditions(search);
    const entries = await Entry.find(filter)
      .populate('author', 'displayName')
      .sort({ journalDate: -1, createdAt: -1 })
      .limit(50);
    return res.json({ entries, search });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' })
      .populate('author', 'displayName');
    if (!entry) return notFound(res);
    const comments = await Comment.find({ entry: entry._id })
      .populate('author', 'displayName')
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
    await comment.populate('author', 'displayName');
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
    comment.reactions = comment.reactions.filter((reaction) => String(reaction.user) !== String(req.user._id));
    if (emoji) comment.reactions.push({ user: req.user._id, emoji });
    await comment.save();
    await comment.populate('author', 'displayName');
    await comment.populate('reactions.user', 'displayName');
    return res.json({ comment });
  } catch (error) { return next(error); }
});

function searchConditions(search) {
  const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [{ title: { $regex: pattern, $options: 'i' } }, { content: { $regex: pattern, $options: 'i' } }];
}

function notFound(res) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy bài viết.' } });
}

module.exports = router;

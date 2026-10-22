const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const { requireAuth, requireProfile } = require('../middleware/auth');

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
      .sort({ createdAt: 1 });
    return res.json({ entry, comments });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/comments', requireAuth, requireProfile, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const content = String(req.body?.content || '').trim();
  if (!content || content.length > 1000) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Bình luận cần từ 1 đến 1.000 ký tự.', fields: { content: 'Bình luận cần từ 1 đến 1.000 ký tự.' } } });
  }

  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' });
    if (!entry) return notFound(res);
    const comment = await Comment.create({ content, entry: entry._id, author: req.user._id });
    await comment.populate('author', 'displayName');
    return res.status(201).json({ comment });
  } catch (error) {
    return next(error);
  }
});

function searchConditions(search) {
  const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [{ title: { $regex: pattern, $options: 'i' } }, { content: { $regex: pattern, $options: 'i' } }];
}

function notFound(res) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy bài viết.' } });
}

module.exports = router;

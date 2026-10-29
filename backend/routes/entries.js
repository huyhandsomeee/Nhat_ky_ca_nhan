const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const { requireAuth, requireProfile } = require('../middleware/auth');
const { validateEntryInput, normalizeEntryInput, canDeleteComment } = require('../domain/entryRules');

const router = express.Router();
router.use(requireAuth, requireProfile);

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const filter = { author: req.user._id };
    if (search) filter.$or = searchConditions(search);
    const entries = await Entry.find(filter).sort({ journalDate: -1, createdAt: -1 }).limit(50);
    res.json({ entries, search });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const errors = validateEntryInput(req.body, vietnameseToday());
  if (errors.length) return validationResponse(res, errors);

  try {
    const entry = await Entry.create({ ...normalizeEntryInput(req.body), author: req.user._id });
    return res.status(201).json({ entry });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, author: req.user._id });
    if (!entry) return notFound(res);
    const comments = await Comment.find({ entry: entry._id }).populate('author', 'displayName').populate('reactions.user', 'displayName').sort({ createdAt: 1 });
    return res.json({ entry, comments });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  const errors = validateEntryInput(req.body, vietnameseToday());
  if (errors.length) return validationResponse(res, errors);

  try {
    const entry = await Entry.findOneAndUpdate(
      { _id: req.params.id, author: req.user._id },
      normalizeEntryInput(req.body),
      { new: true, runValidators: true }
    );
    if (!entry) return notFound(res);
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
  return [{ title: { $regex: pattern, $options: 'i' } }, { content: { $regex: pattern, $options: 'i' } }];
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

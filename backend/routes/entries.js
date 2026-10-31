const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const EntryLike = require('../models/EntryLike');
const SavedEntry = require('../models/SavedEntry');
const { calculateStreaks, dateInVietnam } = require('../domain/diaryStats');
const { requireAuth, requireProfile } = require('../middleware/auth');
const { MOODS, validateEntryInput, normalizeEntryInput, canDeleteComment } = require('../domain/entryRules');

const router = express.Router();
router.use(requireAuth, requireProfile);

router.get('/stats', async (req, res, next) => {
  try {
    const today = dateInVietnam();
    const [dates, totalCount, monthCount, moods, weekEntries] = await Promise.all([
      Entry.distinct('journalDate', { author: req.user._id }),
      Entry.countDocuments({ author: req.user._id }),
      Entry.countDocuments({ author: req.user._id, journalDate: { $regex: `^${today.slice(0, 7)}-` } }),
      Entry.aggregate([{ $match: { author: req.user._id, journalDate: { $regex: `^${today.slice(0, 7)}-` }, mood: { $ne: null } } }, { $group: { _id: '$mood', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 1 }]),
      Entry.find({ author: req.user._id, journalDate: { $gte: shiftDate(today, -6), $lte: today } }).select('journalDate mood createdAt').sort({ createdAt: -1 }).lean()
    ]);
    const streaks = calculateStreaks(dates, today);
    const moodByDate = {};
    for (const entry of weekEntries) if (entry.mood && !moodByDate[entry.journalDate]) moodByDate[entry.journalDate] = entry.mood;
    const week = Array.from({ length: 7 }, (_, index) => { const date = shiftDate(today, index - 6); return { date, mood: moodByDate[date] || null }; });
    return res.json({ today, totalCount, monthCount, popularMood: moods[0]?._id || null, week, ...streaks });
  } catch (error) { return next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const mood = String(req.query.mood || '').trim();
    const visibility = String(req.query.visibility || '').trim();
    const tag = String(req.query.tag || '').trim().replace(/^#+/, '').slice(0, 30);
    const date = String(req.query.date || '').trim();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const sortOrder = String(req.query.sort || 'newest').trim();
    if (mood && !MOODS.includes(mood)) return validationResponse(res, [{ field: 'mood', message: 'Tâm trạng không hợp lệ.' }]);
    if (visibility && !['private', 'public'].includes(visibility)) return validationResponse(res, [{ field: 'visibility', message: 'Chế độ hiển thị không hợp lệ.' }]);
    if (date && !isCalendarDate(date)) return validationResponse(res, [{ field: 'date', message: 'Ngày nhật ký không hợp lệ.' }]);
    if (!['newest', 'oldest'].includes(sortOrder)) return validationResponse(res, [{ field: 'sort', message: 'Thứ tự sắp xếp không hợp lệ.' }]);

    const conditions = [{ author: req.user._id }];
    if (search) conditions.push({ $or: searchConditions(search) });
    if (mood) conditions.push({ mood });
    if (visibility) conditions.push({ visibility });
    if (tag) conditions.push({ tags: { $regex: `^${escapeRegex(tag)}$`, $options: 'i' } });
    if (date) conditions.push({ journalDate: date });
    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };
    const sort = sortOrder === 'oldest' ? { journalDate: 1, createdAt: 1 } : { journalDate: -1, createdAt: -1 };
    const entries = await Entry.find(filter).populate('author', 'username displayName avatarPath').sort(sort).skip((page - 1) * limit).limit(limit + 1);
    const hasMore = entries.length > limit;
    if (hasMore) entries.pop();
    res.json({ entries, search, page, hasMore });
  } catch (error) {
    next(error);
  }
});

router.get('/calendar', async (req, res, next) => {
  const month = String(req.query.month || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return validationResponse(res, [{ field: 'month', message: 'Tháng cần có định dạng YYYY-MM.' }]);
  }
  try {
    const days = await Entry.aggregate([
      { $match: { author: req.user._id, journalDate: { $regex: `^${month}-` } } },
      { $group: { _id: '$journalDate', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } }
    ]);
    return res.json({ month, days });
  } catch (error) {
    return next(error);
  }
});

router.get('/tags/suggestions', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().replace(/^#+/, '').slice(0, 30);
    const match = { author: req.user._id };
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
    if (errors.length) return validationResponse(res, errors);
    const entry = await Entry.create({ ...normalizeEntryInput(req.body), author: req.user._id });
    return res.status(201).json({ entry });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, author: req.user._id })
      .populate('author', 'username displayName avatarPath');
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
    if (errors.length) return validationResponse(res, errors);
    entry.set(normalizeEntryInput(req.body));
    await entry.save();
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
    await Promise.all([EntryLike.deleteMany({ entry: entry._id }), SavedEntry.deleteMany({ entry: entry._id })]);
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

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function notFound(res) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy bài viết.' } });
}

function vietnameseToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

function shiftDate(value, offset) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

module.exports = router;

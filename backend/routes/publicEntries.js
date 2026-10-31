const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const EntryLike = require('../models/EntryLike');
const SavedEntry = require('../models/SavedEntry');
const Follow = require('../models/Follow');
const { requireAuth, requireProfile } = require('../middleware/auth');
const { canInteractWithEntry, normalizeReaction } = require('../domain/entryInteractionRules');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const filter = { visibility: 'public' };
    const mood = String(req.query.mood || '').trim();
    const tag = String(req.query.tag || '').trim().replace(/^#+/, '').slice(0, 30);
    const author = String(req.query.author || '').trim();
    const validAuthor = author && mongoose.isValidObjectId(author) ? new mongoose.Types.ObjectId(author) : null;
    const followingFeed = req.query.feed === 'following';
    const following = followingFeed && req.user?._id;
    const sort = req.query.sort === 'oldest' ? { journalDate: 1, createdAt: 1 } : { journalDate: -1, createdAt: -1 };
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    if (search) filter.$or = searchConditions(search);
    if (mood) filter.mood = mood;
    if (tag) filter.tags = { $regex: `^${escapeRegex(tag)}$`, $options: 'i' };
    if (following) {
      const followees = await Follow.find({ follower: req.user._id }).distinct('author');
      filter.author = { $in: followees };
      if (validAuthor) filter.$and = [{ author: validAuthor }];
    } else if (followingFeed) filter.author = { $in: [] };
    else if (validAuthor) filter.author = validAuthor;
    const [entries, totalPublic, authorIds] = await Promise.all([Entry.find(filter)
      .populate('author', 'displayName username avatarPath')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit + 1), Entry.countDocuments({ visibility: 'public' }), Entry.distinct('author', { visibility: 'public' })]);
    const hasMore = entries.length > limit;
    if (hasMore) entries.pop();
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
    const ids = entries.map((entry) => entry._id);
    const previewsByEntry = new Map(previewGroups.map((group) => [String(group._id), group.comments]));
    const [likes, saves, follows, commentCounts] = await Promise.all([
      EntryLike.aggregate([{ $match: { entry: { $in: ids } } }, { $group: { _id: '$entry', count: { $sum: 1 }, liked: { $sum: req.user?._id ? { $cond: [{ $eq: ['$user', req.user._id] }, 1, 0] } : 0 } } }]),
      req.user?._id ? SavedEntry.find({ user: req.user._id, entry: { $in: ids } }).distinct('entry') : [],
      req.user?._id ? Follow.find({ follower: req.user._id, author: { $in: authorIds } }).distinct('author') : [],
      Comment.aggregate([{ $match: { entry: { $in: ids }, deleted: { $ne: true } } }, { $group: { _id: '$entry', count: { $sum: 1 } } }])
    ]);
    const likeMap = new Map(likes.map((item) => [String(item._id), item]));
    const savedSet = new Set(saves.map(String));
    const followedSet = new Set(follows.map(String));
    const commentCountMap = new Map(commentCounts.map((item) => [String(item._id), item.count]));
    const entriesWithPreviews = entries.map((entry) => {
      const value = entry.toObject();
      const like = likeMap.get(String(entry._id));
      return { ...value, previewComments: previewsByEntry.get(String(entry._id)) || [], commentCount: commentCountMap.get(String(entry._id)) || 0, likeCount: like?.count || 0, likedByMe: Boolean(like?.liked), savedByMe: savedSet.has(String(entry._id)), followedByMe: followedSet.has(String(entry.author?._id)) };
    });
    return res.json({ entries: entriesWithPreviews, search, page, hasMore, totalPublic, writerCount: authorIds.length });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/like', requireAuth, requireProfile, async (req, res, next) => toggleLike(req, res, next, true));
router.delete('/:id/like', requireAuth, requireProfile, async (req, res, next) => toggleLike(req, res, next, false));

async function toggleLike(req, res, next, enabled) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' }).select('author');
    if (!entry) return notFound(res);
    if (enabled) {
      const result = await EntryLike.updateOne({ entry: entry._id, user: req.user._id }, { $setOnInsert: { entry: entry._id, user: req.user._id } }, { upsert: true });
      if (result.upsertedCount > 0) {
        try { await Notification.create({ recipient: entry.author, actor: req.user._id, type: 'entry_like', entry: entry._id }); }
        catch (notificationError) { console.error('Không thể lưu thông báo lượt tim:', notificationError.message); }
      }
    } else await EntryLike.deleteOne({ entry: entry._id, user: req.user._id });
    const likeCount = await EntryLike.countDocuments({ entry: entry._id });
    return res.json({ liked: enabled, likeCount });
  } catch (error) { return next(error); }
}

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

router.get('/writers', async (req, res, next) => {
  try {
    const showAll = req.query.all === 'true';
    const [writers, writerIds] = await Promise.all([Entry.aggregate([
      { $match: { visibility: 'public' } },
      { $group: { _id: '$author', publicEntryCount: { $sum: 1 } } },
      { $sort: { publicEntryCount: -1, _id: 1 } },
      ...(!showAll ? [{ $limit: 3 }] : []),
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } }, { $unwind: '$user' },
      { $project: { _id: 1, displayName: { $ifNull: ['$user.displayName', 'Người viết'] }, username: '$user.username', avatarPath: '$user.avatarPath', publicEntryCount: 1 } }
    ]), Entry.distinct('author', { visibility: 'public' })]);
    return res.json({ writers, totalWriters: writerIds.length });
  } catch (error) { return next(error); }
});

router.get('/authors', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().slice(0, 60);
    const match = query ? { $or: [
      { 'user.displayName': { $regex: escapeRegex(query), $options: 'i' } },
      { 'user.username': { $regex: escapeRegex(query), $options: 'i' } }
    ] } : null;
    const pipeline = [
      { $match: { visibility: 'public' } }, { $group: { _id: '$author', publicEntryCount: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } }, { $unwind: '$user' }
    ];
    if (match) pipeline.push({ $match: match });
    pipeline.push({ $sort: { publicEntryCount: -1, _id: 1 } }, { $limit: 12 }, { $project: { _id: 1, displayName: { $ifNull: ['$user.displayName', 'Người viết'] }, username: '$user.username', publicEntryCount: 1 } });
    return res.json({ authors: await Entry.aggregate(pipeline) });
  } catch (error) { return next(error); }
});

router.get('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' })
      .populate('author', 'displayName username bio avatarPath');
    if (!entry) return notFound(res);
    const comments = await Comment.find({ entry: entry._id })
      .populate('author', 'displayName avatarPath')
      .populate('reactions.user', 'displayName')
      .sort({ createdAt: 1 });
    const [likeCount, likedByMe, savedByMe] = await Promise.all([
      EntryLike.countDocuments({ entry: entry._id }),
      req.user?._id ? EntryLike.exists({ entry: entry._id, user: req.user._id }) : false,
      req.user?._id ? SavedEntry.exists({ entry: entry._id, user: req.user._id }) : false
    ]);
    return res.json({ entry: { ...entry.toObject(), likeCount, likedByMe: Boolean(likedByMe), savedByMe: Boolean(savedByMe) }, comments });
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
    const parentComment = parentCommentId
      ? await Comment.findOne({ _id: parentCommentId, entry: entry._id }).select('author')
      : null;
    if (parentCommentId && !parentComment) return notFound(res);
    const comment = await Comment.create({ content, parentComment: parentCommentId, entry: entry._id, author: req.user._id });
    await comment.populate('author', 'displayName avatarPath');
    const recipient = parentComment?.author || entry.author;
    if (String(recipient) !== String(req.user._id)) {
      try {
        await Notification.create({
          recipient,
          actor: req.user._id,
          type: parentComment ? 'comment_reply' : 'entry_comment',
          entry: entry._id,
          comment: comment._id
        });
      } catch (notificationError) {
        console.error('Không thể lưu thông báo bình luận:', notificationError.message);
      }
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
      try {
        await Notification.create({
          recipient: comment.author,
          actor: req.user._id,
          type: 'comment_reaction',
          entry: entry._id,
          comment: comment._id
        });
      } catch (notificationError) {
        console.error('Không thể lưu thông báo cảm xúc:', notificationError.message);
      }
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

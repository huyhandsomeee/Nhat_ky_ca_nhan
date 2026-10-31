const express = require('express');
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const SavedEntry = require('../models/SavedEntry');
const Follow = require('../models/Follow');
const EntryLike = require('../models/EntryLike');
const Notification = require('../models/Notification');
const { requireAuth, requireProfile } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireProfile);

router.get('/saved', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const saved = await SavedEntry.find({ user: req.user._id }).sort({ createdAt: -1 }).populate({ path: 'entry', match: { visibility: 'public' }, populate: { path: 'author', select: 'displayName avatarPath' } }).skip((page - 1) * limit).limit(limit + 1);
    const rows = saved.filter((item) => item.entry);
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit);
    const ids = visible.map((item) => item.entry._id);
    const [likes, followedAuthors] = await Promise.all([
      EntryLike.aggregate([
        { $match: { entry: { $in: ids } } },
        { $group: {
          _id: '$entry',
          count: { $sum: 1 },
          liked: { $sum: { $cond: [{ $eq: ['$user', req.user._id] }, 1, 0] } }
        } }
      ]),
      Follow.find({ follower: req.user._id }).distinct('author')
    ]);
    const likeMap = new Map(likes.map((item) => [String(item._id), item]));
    const followed = new Set(followedAuthors.map(String));
    const entries = visible.map((item) => { const entry = item.entry.toObject(); const like = likeMap.get(String(entry._id)); return { ...entry, savedByMe: true, likeCount: like?.count || 0, likedByMe: Boolean(like?.liked), followedByMe: followed.has(String(entry.author?._id)) }; });
    return res.json({ entries, page, hasMore });
  } catch (error) { return next(error); }
});

router.post('/entries/:id/save', async (req, res, next) => saveEntry(req, res, next, true));
router.delete('/entries/:id/save', async (req, res, next) => saveEntry(req, res, next, false));
async function saveEntry(req, res, next, enabled) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' }).select('_id');
    if (!entry) return notFound(res);
    if (enabled) await SavedEntry.updateOne({ user: req.user._id, entry: entry._id }, { $setOnInsert: { user: req.user._id, entry: entry._id } }, { upsert: true });
    else await SavedEntry.deleteOne({ user: req.user._id, entry: entry._id });
    return res.json({ saved: enabled });
  } catch (error) { return next(error); }
}

router.get('/authors/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const [isFollowing, followerCount] = await Promise.all([
      Follow.exists({ follower: req.user._id, author: req.params.id }),
      Follow.countDocuments({ author: req.params.id })
    ]);
    return res.json({ following: Boolean(isFollowing), followerCount });
  } catch (error) { return next(error); }
});
router.post('/authors/:id/follow', async (req, res, next) => toggleFollow(req, res, next, true));
router.delete('/authors/:id/follow', async (req, res, next) => toggleFollow(req, res, next, false));
async function toggleFollow(req, res, next, enabled) {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    if (String(req.user._id) === req.params.id) return res.status(400).json({ error: { code: 'INVALID_ACTION', message: 'Bạn không thể theo dõi chính mình.' } });
    const authorExists = await Entry.exists({ author: req.params.id, visibility: 'public' });
    if (!authorExists) return notFound(res);
    if (enabled) {
      const result = await Follow.updateOne({ follower: req.user._id, author: req.params.id }, { $setOnInsert: { follower: req.user._id, author: req.params.id } }, { upsert: true });
      if (result.upsertedCount > 0) {
        try {
          await Notification.create({ recipient: req.params.id, actor: req.user._id, type: 'new_follower' });
        } catch (notificationError) {
          console.error('Không thể lưu thông báo người theo dõi mới:', notificationError.message);
        }
      }
    } else await Follow.deleteOne({ follower: req.user._id, author: req.params.id });
    const followerCount = await Follow.countDocuments({ author: req.params.id });
    return res.json({ following: enabled, followerCount });
  } catch (error) { return next(error); }
}

function notFound(res) { return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy nội dung.' } }); }
module.exports = router;

const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { requireAuth, requireProfile } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireProfile);

router.get('/', async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .populate('actor', 'username displayName')
        .populate('entry', 'title visibility author')
        .sort({ createdAt: -1 })
        .limit(30),
      Notification.countDocuments({ recipient: req.user._id, readAt: null })
    ]);
    const safeNotifications = notifications.map((notification) => {
      const item = notification.toObject();
      if (item.entry?.visibility !== 'public' && String(item.entry?.author) !== String(req.user._id)) item.entry = null;
      return item;
    });
    return res.json({ notifications: safeNotifications, unreadCount });
  } catch (error) { return next(error); }
});

router.post('/:id/read', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification && !await Notification.exists({ _id: req.params.id, recipient: req.user._id })) return notFound(res);
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.post('/read', async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

function notFound(res) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy thông báo.' } });
}

module.exports = router;

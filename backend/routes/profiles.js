const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Entry = require('../models/Entry');
const { toPublicProfile } = require('../services/profileData');

const router = express.Router();

router.get('/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

  try {
    const user = await User.findById(req.params.id).select('username displayName bio avatarPath').lean();
    if (!user) return notFound(res);
    const entries = await Entry.find({ visibility: 'public', author: user._id })
      .select('title content journalDate mood tags visibility createdAt author')
      .populate('author', 'displayName avatarPath')
      .sort({ journalDate: -1, createdAt: -1 })
      .limit(50)
      .lean();
    const publicEntryCount = await Entry.countDocuments({ visibility: 'public', author: user._id });
    const response = toPublicProfile(user, entries);
    response.profile.publicEntryCount = publicEntryCount;
    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

function notFound(res) {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ này.' } });
}

module.exports = router;

const express = require('express');
const Draft = require('../models/Draft');
const { requireAuth, requireProfile } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireProfile);

router.get('/', async (req, res, next) => {
  try { return res.json({ draft: await Draft.findOne({ author: req.user._id }) }); }
  catch (error) { return next(error); }
});

router.put('/', async (req, res, next) => {
  const data = req.body || {};
  const draft = {
    title: String(data.title || '').slice(0, 120),
    content: String(data.content || '').slice(0, 10000),
    journalDate: String(data.journalDate || ''),
    mood: data.mood || null,
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 20).map((tag) => String(tag).trim().slice(0, 30)) : [],
    visibility: data.visibility === 'public' ? 'public' : 'private'
  };
  try {
    const saved = await Draft.findOneAndUpdate({ author: req.user._id }, { $set: draft, $setOnInsert: { author: req.user._id } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    return res.json({ draft: saved });
  } catch (error) { return next(error); }
});

router.delete('/', async (req, res, next) => {
  try { await Draft.deleteOne({ author: req.user._id }); return res.status(204).end(); }
  catch (error) { return next(error); }
});

module.exports = router;

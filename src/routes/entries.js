const express = require('express');
const { body, validationResult } = require('express-validator');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const entryRules = [
  body('title').trim().isLength({ min: 1, max: 120 }).withMessage('Tiêu đề cần từ 1 đến 120 ký tự.'),
  body('content').trim().isLength({ min: 1, max: 10000 }).withMessage('Nội dung không được để trống và tối đa 10.000 ký tự.'),
  body('visibility').isIn(['private', 'public']).withMessage('Hãy chọn chế độ hiển thị hợp lệ.')
];

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim().slice(0, 100);
    const filter = { author: req.user._id };
    if (search) filter.$or = [{ title: { $regex: escapeRegex(search), $options: 'i' } }, { content: { $regex: escapeRegex(search), $options: 'i' } }];
    const entries = await Entry.find(filter).sort({ updatedAt: -1 });
    res.render('entries/index', { title: 'Nhật ký của tôi', entries, search });
  } catch (error) { next(error); }
});

router.get('/new', (req, res) => res.render('entries/form', {
  title: 'Viết nhật ký', heading: 'Một ngày của bạn thế nào?', action: '/entries', entry: { title: '', content: '', visibility: 'private' }, errors: []
}));

router.post('/', entryRules, async (req, res, next) => {
  const errors = validationResult(req).array();
  const entry = { title: req.body.title, content: req.body.content, visibility: req.body.visibility };
  if (errors.length) return res.status(400).render('entries/form', { title: 'Viết nhật ký', heading: 'Một ngày của bạn thế nào?', action: '/entries', entry, errors });
  try {
    await Entry.create({ ...entry, author: req.user._id });
    res.redirect('/entries');
  } catch (error) { next(error); }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.id, author: req.user._id });
    if (!entry) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài viết' });
    res.render('entries/form', { title: 'Sửa nhật ký', heading: 'Chỉnh lại trang viết này', action: `/entries/${entry.id}?_method=PUT`, entry, errors: [] });
  } catch (error) { next(error); }
});

router.put('/:id', entryRules, async (req, res, next) => {
  const errors = validationResult(req).array();
  const entry = { _id: req.params.id, title: req.body.title, content: req.body.content, visibility: req.body.visibility };
  if (errors.length) return res.status(400).render('entries/form', { title: 'Sửa nhật ký', heading: 'Chỉnh lại trang viết này', action: `/entries/${req.params.id}?_method=PUT`, entry, errors });
  try {
    const updated = await Entry.findOneAndUpdate(
      { _id: req.params.id, author: req.user._id },
      { title: entry.title, content: entry.content, visibility: entry.visibility },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài viết' });
    res.redirect('/entries');
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.id, author: req.user._id });
    if (!entry) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài viết' });
    const comments = entry.visibility === 'public'
      ? await Comment.find({ entry: entry._id }).populate('author', 'displayName').sort({ createdAt: 1 })
      : [];
    res.render('entries/show', { title: entry.title, entry, comments, isOwner: true, publicPage: false });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const entry = await Entry.findOneAndDelete({ _id: req.params.id, author: req.user._id });
    if (!entry) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài viết' });
    await Comment.deleteMany({ entry: entry._id });
    res.redirect('/entries');
  } catch (error) { next(error); }
});

module.exports = router;

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

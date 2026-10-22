const express = require('express');
const { body, validationResult } = require('express-validator');
const Entry = require('../models/Entry');
const Comment = require('../models/Comment');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:id', async (req, res, next) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' }).populate('author', 'displayName');
    if (!entry) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài viết' });
    const comments = await Comment.find({ entry: entry._id }).populate('author', 'displayName').sort({ createdAt: 1 });
    res.render('entries/show', { title: entry.title, entry, comments, isOwner: req.user && entry.author.id === req.user.id, publicPage: true });
  } catch (error) { next(error); }
});

router.post('/:id/comments', requireAuth, body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Bình luận cần từ 1 đến 1.000 ký tự.'), async (req, res, next) => {
  const errors = validationResult(req).array();
  try {
    const entry = await Entry.findOne({ _id: req.params.id, visibility: 'public' });
    if (!entry) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài viết' });
    if (errors.length) {
      const comments = await Comment.find({ entry: entry._id }).populate('author', 'displayName').sort({ createdAt: 1 });
      const populated = await entry.populate('author', 'displayName');
      return res.status(400).render('entries/show', { title: entry.title, entry: populated, comments, isOwner: entry.author.id === req.user.id, publicPage: true, commentErrors: errors });
    }
    await Comment.create({ content: req.body.content, entry: entry._id, author: req.user._id });
    res.redirect(`/explore/${entry.id}#comments`);
  } catch (error) { next(error); }
});

router.delete('/:entryId/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const entry = await Entry.findOne({ _id: req.params.entryId, visibility: 'public' });
    if (!entry) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài viết' });
    const comment = await Comment.findOne({ _id: req.params.commentId, entry: entry._id });
    if (!comment) return res.status(404).render('errors/404', { title: 'Không tìm thấy bình luận' });
    const canDelete = String(comment.author) === String(req.user._id) || String(entry.author) === String(req.user._id);
    if (!canDelete) return res.status(403).send('Bạn không có quyền xóa bình luận này.');
    await comment.deleteOne();
    res.redirect(`/explore/${entry.id}#comments`);
  } catch (error) { next(error); }
});

module.exports = router;

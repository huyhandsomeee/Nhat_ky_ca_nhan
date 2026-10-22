const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();
const emailRule = body('email').trim().isEmail().withMessage('Hãy nhập email hợp lệ.').normalizeEmail();

router.get('/register', (req, res) => res.render('auth/register', { title: 'Tạo tài khoản', errors: [], values: {} }));
router.post('/register', [
  body('displayName').trim().isLength({ min: 2, max: 40 }).withMessage('Tên hiển thị cần từ 2 đến 40 ký tự.'),
  emailRule,
  body('password').isLength({ min: 8, max: 72 }).withMessage('Mật khẩu cần ít nhất 8 ký tự.')
], async (req, res, next) => {
  const errors = validationResult(req).array();
  const values = { displayName: req.body.displayName, email: req.body.email };
  if (errors.length) return res.status(400).render('auth/register', { title: 'Tạo tài khoản', errors, values });
  try {
    const exists = await User.exists({ email: req.body.email });
    if (exists) return res.status(400).render('auth/register', { title: 'Tạo tài khoản', errors: [{ msg: 'Email này đã được sử dụng.' }], values });
    const user = await User.create({
      displayName: req.body.displayName,
      email: req.body.email,
      passwordHash: await bcrypt.hash(req.body.password, 12)
    });
    req.session.userId = user.id;
    res.redirect('/entries');
  } catch (error) { next(error); }
});

router.get('/login', (req, res) => res.render('auth/login', { title: 'Đăng nhập', errors: [], values: {} }));
router.post('/login', [emailRule, body('password').notEmpty().withMessage('Hãy nhập mật khẩu.')], async (req, res, next) => {
  const errors = validationResult(req).array();
  const values = { email: req.body.email };
  if (errors.length) return res.status(400).render('auth/login', { title: 'Đăng nhập', errors, values });
  try {
    const user = await User.findOne({ email: req.body.email });
    const validPassword = user && await bcrypt.compare(req.body.password, user.passwordHash);
    if (!validPassword) return res.status(400).render('auth/login', { title: 'Đăng nhập', errors: [{ msg: 'Email hoặc mật khẩu chưa đúng.' }], values });
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      res.redirect('/entries');
    });
  } catch (error) { next(error); }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('nhatky.sid');
    res.redirect('/explore');
  });
});

module.exports = router;

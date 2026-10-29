const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', (req, res) => {
  if (!req.isAuthenticated?.()) return res.json({ authenticated: false, user: null });
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName || req.user.username,
      needsProfileSetup: !String(req.user.displayName || '').trim()
    }
  });
});

router.post('/register', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    const displayName = String(req.body?.displayName || '').trim();

    const fields = {};
    if (!username || username.length < 3 || username.length > 30) {
      fields.username = 'Tên đăng nhập cần từ 3 đến 30 ký tự.';
    } else if (/\s/.test(username)) {
      fields.username = 'Tên đăng nhập không được chứa khoảng trắng.';
    }

    if (!password || password.length < 6) {
      fields.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    }
    if (confirmPassword && confirmPassword !== password) {
      fields.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }
    if (displayName && (displayName.length < 2 || displayName.length > 40)) {
      fields.displayName = 'Biệt danh cần từ 2 đến 40 ký tự.';
    }

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Thông tin đăng ký không hợp lệ.', fields }
      });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({
        error: { code: 'USERNAME_EXISTS', message: 'Tên đăng nhập này đã được sử dụng.', fields: { username: 'Tên đăng nhập này đã được sử dụng.' } }
      });
    }

    const user = new User({
      username,
      password,
      displayName: displayName || username
    });
    await user.save();

    req.logIn(user, (loginError) => {
      if (loginError) return next(loginError);
      return res.status(201).json({
        message: 'Đăng ký thành công.',
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
          needsProfileSetup: false
        }
      });
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: { code: 'USERNAME_EXISTS', message: 'Tên đăng nhập này đã được sử dụng.', fields: { username: 'Tên đăng nhập này đã được sử dụng.' } }
      });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.',
          fields: {
            ...(!username ? { username: 'Vui lòng nhập tên đăng nhập.' } : {}),
            ...(!password ? { password: 'Vui lòng nhập mật khẩu.' } : {})
          }
        }
      });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' }
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' }
      });
    }

    req.logIn(user, (loginError) => {
      if (loginError) return next(loginError);
      return res.json({
        message: 'Đăng nhập thành công.',
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
          needsProfileSetup: false
        }
      });
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    const fields = {};
    if (!username) fields.username = 'Vui lòng nhập tên đăng nhập.';
    if (!newPassword || newPassword.length < 6) fields.newPassword = 'Mật khẩu mới cần ít nhất 6 ký tự.';
    if (confirmPassword && confirmPassword !== newPassword) fields.confirmPassword = 'Mật khẩu xác nhận không khớp.';

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Thông tin đặt lại mật khẩu không hợp lệ.', fields }
      });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'Không tìm thấy tài khoản với tên đăng nhập này.', fields: { username: 'Tài khoản không tồn tại.' } }
      });
    }

    user.password = newPassword;
    await user.save();

    req.logIn(user, (loginError) => {
      if (loginError) return next(loginError);
      return res.json({
        message: 'Đặt lại mật khẩu thành công.',
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
          needsProfileSetup: false
        }
      });
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/profile', requireAuth, async (req, res, next) => {
  const displayName = String(req.body?.displayName || '').trim();
  if (displayName.length < 2 || displayName.length > 40) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Biệt danh cần từ 2 đến 40 ký tự.', fields: { displayName: 'Biệt danh cần từ 2 đến 40 ký tự.' } }
    });
  }

  try {
    req.user.displayName = displayName;
    await req.user.save();
    return res.json({ user: { id: req.user.id, username: req.user.username, displayName, needsProfileSetup: false } });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res, next) => {
  const finish = (error) => {
    if (error) return next(error);
    res.clearCookie('nhatky.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.status(204).end();
  };
  if (!req.session) return finish();
  req.logout((error) => {
    if (error) return finish(error);
    req.session.destroy(finish);
  });
});

module.exports = router;

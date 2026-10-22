const express = require('express');
const passport = require('passport');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', (req, res) => {
  if (!req.isAuthenticated?.()) return res.json({ authenticated: false, user: null });
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName || '',
      needsProfileSetup: !String(req.user.displayName || '').trim()
    }
  });
});

router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'Hãy cấu hình Google OAuth trong file .env.' } });
  }
  return passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'Google OAuth chưa được cấu hình.' } });
  }
  passport.authenticate('google', (error, user) => {
    if (error || !user) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?error=google`);
    }
    req.logIn(user, (loginError) => {
      if (loginError) return next(loginError);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const destination = String(user.displayName || '').trim() ? '/' : '/setup-profile';
      return res.redirect(303, `${frontendUrl}${destination}`);
    });
  })(req, res, next);
});

router.put('/profile', requireAuth, async (req, res, next) => {
  const displayName = String(req.body?.displayName || '').trim();
  if (displayName.length < 2 || displayName.length > 40) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Biệt danh cần từ 2 đến 40 ký tự.', fields: { displayName: 'Biệt danh cần từ 2 đến 40 ký tự.' } } });
  }

  try {
    req.user.displayName = displayName;
    await req.user.save();
    return res.json({ user: { id: req.user.id, email: req.user.email, displayName, needsProfileSetup: false } });
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

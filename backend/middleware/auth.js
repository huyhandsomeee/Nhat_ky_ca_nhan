function requireAuth(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Hãy đăng nhập để tiếp tục.' } });
}

function requireProfile(req, res, next) {
  if (String(req.user?.displayName || '').trim()) return next();
  return res.status(403).json({ error: { code: 'PROFILE_SETUP_REQUIRED', message: 'Hãy đặt biệt danh trước khi tiếp tục.' } });
}

module.exports = { requireAuth, requireProfile };

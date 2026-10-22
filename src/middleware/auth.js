const User = require('../models/User');

async function attachUser(req, res, next) {
  try {
    res.locals.currentUser = null;
    res.locals.notice = req.session.notice || null;
    delete req.session.notice;
    if (req.session.userId) {
      req.user = await User.findById(req.session.userId).select('_id displayName email');
      res.locals.currentUser = req.user;
    }
    next();
  } catch (error) { next(error); }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/auth/login');
  next();
}

module.exports = { attachUser, requireAuth };

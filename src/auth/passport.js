const passport = require('passport');
const User = require('../models/User');

function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select('_id username displayName');
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  return true;
}

module.exports = { configurePassport };

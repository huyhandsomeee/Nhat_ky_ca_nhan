const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

function configurePassport(env = process.env) {
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      done(null, await User.findById(id).select('_id email displayName'));
    } catch (error) {
      done(error);
    }
  });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return false;

  const callbackURL = env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';
  passport.use(new GoogleStrategy({
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL,
    state: true,
    scope: ['profile', 'email']
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email) return done(new Error('Google did not provide an email address.'));

      let user = await User.findOne({ googleId });
      if (!user) {
        try {
          user = await User.create({ googleId, email, displayName: '' });
        } catch (error) {
          if (error.code !== 11000) throw error;
          user = await User.findOne({ googleId });
          if (!user) throw error;
        }
      }

      done(null, user);
    } catch (error) {
      done(error);
    }
  }));

  return true;
}

module.exports = { configurePassport };

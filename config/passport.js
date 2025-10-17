// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const Tenant = require('../models/Tenant');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4001';

module.exports = function(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL}/api/v1/auth/google/callback`,
        scope: ['profile', 'email'],
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          
          if (!email) {
            return done(new Error('No email found in Google profile'), null);
          }

          // Check if user exists with this Google ID
          let user = await User.findOne({
            where: { googleId: profile.id },
            include: [{
              model: Tenant,
              attributes: ['id', 'companyName', 'subdomain', 'subscriptionPlan']
            }]
          });

          // If not found by Google ID, check by email
          if (!user) {
            user = await User.findOne({
              where: { email },
              include: [{
                model: Tenant,
                attributes: ['id', 'companyName', 'subdomain', 'subscriptionPlan']
              }]
            });

            // If user exists with email, link Google account
            if (user) {
              await user.update({
                googleId: profile.id,
                authProvider: user.authProvider ? `${user.authProvider},google` : 'google',
                fullName: user.fullName || profile.displayName,
                isActive: true
              });
            }
          }

          // Return existing user
          if (user) {
            return done(null, {
              user,
              isNewUser: false,
              email,
              googleProfile: profile
            });
          }

          // New user - return profile data for registration
          return done(null, {
            user: null,
            isNewUser: true,
            email,
            googleProfile: profile,
            fullName: profile.displayName,
            googleId: profile.id
          });

        } catch (error) {
          console.error('Google OAuth error:', error);
          return done(error, null);
        }
      }
    )
  );

  // Serialize user for session (not used in JWT strategy, but required by passport)
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });
};

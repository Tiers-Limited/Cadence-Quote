// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
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
              as: 'tenant',
              attributes: ['id', 'companyName', 'subscriptionPlan', 'paymentStatus', 'isActive']
            }]
          });

          // If not found by Google ID, check by email
          if (!user) {
            user = await User.findOne({
              where: { email },
              include: [{
                model: Tenant,
                as: 'tenant',
                attributes: ['id', 'companyName', 'subscriptionPlan', 'paymentStatus', 'isActive']
              }]
            });

            // If user exists with email
            if (user) {
              // Check if user has pending payment (incomplete registration)
              if (!user.isActive && user.tenant && user.tenant.paymentStatus === 'pending') {
                // Don't activate - return as pending payment user
                return done(null, {
                  user,
                  isNewUser: false,
                  hasPendingPayment: true,
                  email,
                  googleProfile: profile
                });
              }
              
              // Active user - link Google account
              if (user.isActive) {
                await user.update({
                  googleId: profile.id,
                  authProvider: user.authProvider ? `${user.authProvider},google` : 'google',
                  fullName: user.fullName || profile.displayName
                });
              }
            }
          }

          // Return existing user
          if (user) {
            // Check for pending payment
            if (!user.isActive && user.tenant && user.tenant.paymentStatus === 'pending') {
              return done(null, {
                user,
                isNewUser: false,
                hasPendingPayment: true,
                email,
                googleProfile: profile
              });
            }
            
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

  // Apple OAuth Strategy
  passport.use(
    new AppleStrategy(
      {
        clientID: APPLE_CLIENT_ID,
        teamID: APPLE_TEAM_ID,
        keyID: APPLE_KEY_ID,
        privateKeyString: APPLE_PRIVATE_KEY,
        callbackURL: `${BACKEND_URL}/api/v1/auth/apple/callback`,
        scope: ['name', 'email'],
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, idToken, profile, done) => {
        try {
          // Apple returns email in profile or idToken
          const email = profile.email || (idToken && idToken.email);
          const appleId = profile.sub || profile.id;
          
          if (!email) {
            return done(new Error('No email found in Apple profile'), null);
          }

          // Check if user exists with this Apple ID
          let user = await User.findOne({
            where: { appleId },
            include: [{
              model: Tenant,
              as: 'tenant',
              attributes: ['id', 'companyName', 'subscriptionPlan', 'paymentStatus', 'isActive']
            }]
          });

          // If not found by Apple ID, check by email
          if (!user) {
            user = await User.findOne({
              where: { email },
              include: [{
                model: Tenant,
                as: 'tenant',
                attributes: ['id', 'companyName', 'subscriptionPlan', 'paymentStatus', 'isActive']
              }]
            });

            // If user exists with email
            if (user) {
              // Check if user has pending payment (incomplete registration)
              if (!user.isActive && user.tenant && user.tenant.paymentStatus === 'pending') {
                // Don't activate - return as pending payment user
                return done(null, {
                  user,
                  isNewUser: false,
                  hasPendingPayment: true,
                  email,
                  appleProfile: profile
                });
              }
              
              // Active user - link Apple account
              if (user.isActive) {
                await user.update({
                  appleId,
                  authProvider: user.authProvider ? `${user.authProvider},apple` : 'apple'
                });
              }
            }
          }

          // Return existing user
          if (user) {
            // Check for pending payment
            if (!user.isActive && user.tenant && user.tenant.paymentStatus === 'pending') {
              return done(null, {
                user,
                isNewUser: false,
                hasPendingPayment: true,
                email,
                appleProfile: profile
              });
            }
            
            return done(null, {
              user,
              isNewUser: false,
              email,
              appleProfile: profile
            });
          }

          // New user - return profile data for registration
          const fullName = profile.name 
            ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim()
            : email.split('@')[0];

          return done(null, {
            user: null,
            isNewUser: true,
            email,
            appleProfile: profile,
            fullName: fullName || email.split('@')[0],
            appleId
          });

        } catch (error) {
          console.error('Apple OAuth error:', error);
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

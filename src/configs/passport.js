const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const logger = require("../utils/logger");

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

// Only register the strategy when credentials exist. GoogleStrategy throws at
// construction time if clientID is missing, which would crash the whole app.
const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_REDIRECT_URI,
      },
      // Verify callback only extracts the profile; the find-or-create DB logic
      // lives in authService.loginWithGoogle so it stays testable and thin here.
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error("Google account did not provide an email"), null);
        }

        return done(null, {
          provider: "GOOGLE",
          providerUserId: profile.id,
          email,
          fullName: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value || null,
        });
      },
    ),
  );

  logger.info("Google OAuth strategy registered");
} else {
  logger.warn(
    "Google OAuth disabled: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to enable",
  );
}

module.exports = { passport, googleEnabled };

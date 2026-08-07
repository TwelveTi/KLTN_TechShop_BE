const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  validateRegister,
  validateLogin,
  validateLogout,
  validateUpdateProfile,
} = require("../middlewares/authValidation");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { uploadAvatar } = require("../middlewares/uploadMiddleware");
const { validateIdParam } = require("../middlewares/adminValidation");
const asyncHandler = require("../utils/asyncHandler");
const sessionController = require("../controllers/sessionController");
const { passport, googleEnabled } = require("../configs/passport");

const FRONTEND_URL = (process.env.FRONTEND_URL).replace(/\/+$/, "");

router.get("/auth/check-email", asyncHandler(authController.checkEmail));
router.post("/auth/register", validateRegister, asyncHandler(authController.register));
router.post("/auth/login", validateLogin, asyncHandler(authController.login));
router.post("/auth/logout", validateLogout, asyncHandler(authController.logout));
router.post("/auth/refresh", asyncHandler(authController.refresh));
router.get("/auth/verify-email", asyncHandler(authController.verifyEmail));
router.post("/auth/resend-verification", authMiddleware, asyncHandler(authController.resendVerification));
router.get("/auth/me", authMiddleware, asyncHandler(authController.me));
router.put("/auth/me", authMiddleware, validateUpdateProfile, asyncHandler(authController.updateMe));
router.post("/auth/me/avatar", authMiddleware, uploadAvatar, asyncHandler(authController.uploadAvatar));

// Session / device management (all require a valid access token).
router.get("/auth/sessions", authMiddleware, asyncHandler(sessionController.getSessions));
router.post("/auth/sessions/revoke-others", authMiddleware, asyncHandler(sessionController.revokeOtherSessions));
router.delete("/auth/sessions/:id", authMiddleware, validateIdParam(), asyncHandler(sessionController.revokeSession));

// Google OAuth (only mounted when GOOGLE_* env is configured).
if (googleEnabled) {
  router.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"], session: false }),
  );

  router.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${FRONTEND_URL}/auth?oauth=error`,
    }),
    asyncHandler(authController.googleCallback),
  );
}

module.exports = router;

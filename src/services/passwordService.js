const AppError = require("../utils/AppError");
const OtpGenerator = require("../utils/otpGenerator");
const { hashToken } = require("../utils/tokenHash");
const logger = require("../utils/logger");
const emailProducer = require("../kafkas/producers/emailProducer");
const {
  OTP_LENGTH,
  OTP_EXPIRATION_MINUTES,
  MAX_OTP_ATTEMPTS,
  RESET_TOKEN_EXPIRATION_MINUTES,
} = require("../configs/passwordConfig");
const {
  hashPassword,
  comparePassword,
  hashOtp,
  safeEqualHex,
  generateResetToken,
} = require("../utils/passwordCrypto");
const { minutesFromNow, resendRetryAfterSeconds } = require("../utils/otpHelpers");
const passwordRepository = require("../repositories/passwordRepository");

// Generic response — deliberately identical whether or not the account exists,
// to avoid account enumeration on the public forgot/resend endpoints.
const GENERIC_FORGOT_MESSAGE =
  "If an account with that email exists, a password reset code has been sent.";

// This service only orchestrates: it owns transactions and business rules while
// delegating persistence to the repository and hashing/timing math to utils.
class PasswordService {
  // Invalidate any in-flight OTP for the user, then create a fresh one.
  // Returns the plaintext OTP so the caller can email it AFTER commit.
  async issueOtp(userId, transaction) {
    await passwordRepository.invalidateActiveOtpByUser(userId, { transaction });

    const otp = String(OtpGenerator.generate(OTP_LENGTH));

    await passwordRepository.createOtp(
      { userId, otpHash: hashOtp(otp), attempts: 0, expiresAt: minutesFromNow(OTP_EXPIRATION_MINUTES) },
      { transaction },
    );

    return otp;
  }

  // Fire-and-forget so a Kafka/broker outage never blocks or slows the request.
  // The producer itself also swallows errors; this is a second safety net. The
  // OTP is never written to the logs.
  dispatchResetEmail(user, otp, meta = {}) {
    Promise.resolve(
      emailProducer.publishPasswordReset(
        {
          userId: user.id,
          to: user.email,
          fullName: user.fullName,
          otp,
          expiresMinutes: OTP_EXPIRATION_MINUTES,
        },
        { requestId: meta.requestId },
      ),
    ).catch((error) => {
      logger.error("Failed to dispatch password reset email", {
        requestId: meta.requestId,
        error: logger.serializeError(error),
      });
    });
  }

  // Entry point of the flow: ALWAYS issues a fresh code (any previous one is
  // invalidated) so the user reliably receives a code every time they ask. The
  // repeat-request rate limit lives on resendResetOtp, not here — the earlier
  // behaviour of silently skipping while returning "a code has been sent" left
  // the user waiting for an email that never arrived.
  async forgotPassword(email, meta = {}) {
    const user = await passwordRepository.findActiveLocalUserByEmail(email);

    // Unknown / non-LOCAL account: respond generically, do nothing.
    if (!user) {
      return { message: GENERIC_FORGOT_MESSAGE };
    }

    const transaction = await passwordRepository.beginTransaction();
    let issuedOtp = null;

    try {
      issuedOtp = await this.issueOtp(user.id, transaction);
      await transaction.commit();
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }

    this.dispatchResetEmail(user, issuedOtp, meta);

    return { message: GENERIC_FORGOT_MESSAGE };
  }

  // Explicit "resend" — rate limited by the cooldown so it cannot be abused.
  async resendResetOtp(email, meta = {}) {
    const user = await passwordRepository.findActiveLocalUserByEmail(email);

    if (!user) {
      return { message: GENERIC_FORGOT_MESSAGE };
    }

    const transaction = await passwordRepository.beginTransaction();
    let issuedOtp = null;

    try {
      const latest = await passwordRepository.findLatestOtpByUser(user.id, { transaction, lock: true });

      const retryAfter = resendRetryAfterSeconds(latest);
      if (retryAfter > 0) {
        await transaction.rollback();
        throw new AppError(
          `Please wait ${retryAfter} second(s) before requesting another code.`,
          429,
        );
      }

      issuedOtp = await this.issueOtp(user.id, transaction);
      await transaction.commit();
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }

    this.dispatchResetEmail(user, issuedOtp, meta);

    return { message: GENERIC_FORGOT_MESSAGE };
  }

  async verifyOtp(email, otp) {
    const user = await passwordRepository.findActiveLocalUserByEmail(email);
    const invalidError = new AppError("Invalid or expired OTP", 400);

    // Do not reveal whether the email exists.
    if (!user) {
      throw invalidError;
    }

    const transaction = await passwordRepository.beginTransaction();

    try {
      const record = await passwordRepository.findActivePendingOtpByUser(user.id, { transaction, lock: true });

      if (!record) {
        await transaction.commit();
        throw invalidError;
      }

      if (record.expiresAt <= new Date()) {
        await passwordRepository.markOtpUsed(record, { transaction });
        await transaction.commit();
        throw new AppError("OTP has expired. Please request a new code.", 400);
      }

      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        await passwordRepository.markOtpUsed(record, { transaction });
        await transaction.commit();
        throw new AppError("Too many invalid attempts. Please request a new code.", 429);
      }

      const matches = safeEqualHex(record.otpHash, hashOtp(otp));

      if (!matches) {
        // Exhausting attempts invalidates the OTP entirely (anti brute-force).
        const willLock = record.attempts + 1 >= MAX_OTP_ATTEMPTS;
        await passwordRepository.incrementOtpAttempts(record, { markUsed: willLock, transaction });
        await transaction.commit();

        throw willLock
          ? new AppError("Too many invalid attempts. Please request a new code.", 429)
          : new AppError("Invalid OTP", 400);
      }

      // Success: mark verified and mint a short-lived reset authorization token.
      // The OTP can no longer be replayed (verifiedAt is now set).
      const resetToken = generateResetToken();

      await passwordRepository.markOtpVerified(record, {
        resetTokenHash: hashToken(resetToken),
        resetTokenExpiresAt: minutesFromNow(RESET_TOKEN_EXPIRATION_MINUTES),
        transaction,
      });

      await transaction.commit();

      return { resetToken, expiresInMinutes: RESET_TOKEN_EXPIRATION_MINUTES };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async resetPassword(resetToken, newPassword) {
    if (!resetToken) {
      throw new AppError("Reset token is required", 400);
    }

    const transaction = await passwordRepository.beginTransaction();

    try {
      const record = await passwordRepository.findVerifiedOtpByResetTokenHash(hashToken(resetToken), {
        transaction,
        lock: true,
      });

      if (!record) {
        await transaction.rollback();
        throw new AppError("Invalid or expired reset token", 400);
      }

      if (!record.resetTokenExpiresAt || record.resetTokenExpiresAt <= new Date()) {
        await passwordRepository.markOtpUsed(record, { transaction });
        await transaction.commit();
        throw new AppError("Reset session has expired. Please start again.", 400);
      }

      const provider = await passwordRepository.findLocalProviderByUserId(record.userId, {
        transaction,
        lock: true,
      });

      if (!provider) {
        await transaction.rollback();
        throw new AppError("Invalid or expired reset token", 400);
      }

      // Atomically: set new password, consume the OTP record (single-use), and
      // revoke ALL existing sessions (a password reset logs out every device).
      await passwordRepository.updateProviderPassword(provider, await hashPassword(newPassword), { transaction });
      await passwordRepository.markOtpUsed(record, { transaction });
      await passwordRepository.revokeAllActiveSessions(record.userId, { transaction });

      await transaction.commit();

      return {
        message: "Password has been reset successfully. Please sign in with your new password.",
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  // Authenticated password change. userId comes from the auth context only.
  async changePassword(userId, { currentPassword, newPassword }, currentRefreshToken) {
    const transaction = await passwordRepository.beginTransaction();

    try {
      const provider = await passwordRepository.findLocalProviderByUserId(userId, {
        transaction,
        lock: true,
      });

      if (!provider) {
        await transaction.rollback();
        throw new AppError("This account does not use a password login", 400);
      }

      const isCurrentValid = await comparePassword(currentPassword, provider.passwordHash);
      if (!isCurrentValid) {
        await transaction.rollback();
        throw new AppError("Current password is incorrect", 400);
      }

      const isSame = await comparePassword(newPassword, provider.passwordHash);
      if (isSame) {
        await transaction.rollback();
        throw new AppError("New password must be different from the current password", 400);
      }

      await passwordRepository.updateProviderPassword(provider, await hashPassword(newPassword), { transaction });

      // Session policy: keep the CURRENT session (identified by its refresh
      // cookie) alive and revoke every OTHER session. If we cannot identify the
      // current session, revoke all — the short-lived access token still lets
      // the in-flight request complete.
      const revokedOtherSessions = currentRefreshToken
        ? await passwordRepository.revokeOtherSessions(userId, hashToken(currentRefreshToken), { transaction })
        : await passwordRepository.revokeAllActiveSessions(userId, { transaction });

      await transaction.commit();

      return {
        message: "Password changed successfully",
        revokedOtherSessions,
        currentSessionKept: Boolean(currentRefreshToken),
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }
}

module.exports = new PasswordService();

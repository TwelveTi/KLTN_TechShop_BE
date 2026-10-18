const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const AppError = require("../utils/AppError");
const jwtUtils = require("../utils/jwt");
const emailProducer = require("../kafkas/producers/emailProducer");
const { isDisposableEmail } = require("../utils/disposableEmail");
const { toSafeUser } = require("../utils/userSerializer");
const authRepository = require("../repositories/authRepository");
// Account creation belongs to the user module; auth only drives the session on
// top of it. This is the one place a service reaches for another service, and
// it is deliberately one-way (userService never calls authService).
const userService = require("./userService");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;
const { REFRESH_TOKEN_REUSE_GRACE_MS } = authRepository;
const REFRESH_TOKEN_ROTATE_WITHIN_MS = 24 * 60 * 60 * 1000;

// Khoá theo TÀI KHOẢN, bổ sung cho limiter theo IP: kẻ dò mật khẩu đổi IP liên tục vẫn bị chặn.
const LOGIN_MAX_FAILED = Number(process.env.LOGIN_MAX_FAILED) || 5;
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES) || 15;

const lockedError = (lockedUntil, now) => {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000));
  return new AppError(`Too many failed sign-in attempts. Try again in ${minutes} minute(s) or reset your password.`, 429);
};

class AuthService {
  hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  getRefreshTokenExpiresAt() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
    return expiresAt;
  }

  // `sid` là id phiên (dòng refresh_tokens). authMiddleware kiểm phiên này mỗi request,
  // nên thu hồi phiên hay đăng xuất là access token đi kèm hết hiệu lực ngay.
  createAccessToken(user, sessionId) {
    return jwtUtils.signAccess({
      id: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    });
  }

  async createTokens(user, meta = {}, { transaction } = {}) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshToken = jwtUtils.signRefresh({
      ...payload,
      tokenId: crypto.randomUUID(),
    });

    const session = await authRepository.createRefreshToken(
      {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiresAt(),
        deviceInfo: meta.deviceInfo,
        ipAddress: meta.ipAddress,
      },
      { transaction },
    );
    const accessToken = this.createAccessToken(user, session.id);

    return { accessToken, refreshToken };
  }

  async checkEmailAvailability(rawEmail) {
    const email = String(rawEmail || "").toLowerCase().trim();

    if (!email || !EMAIL_REGEX.test(email)) {
      return {
        email,
        valid: false,
        available: false,
        disposable: false,
        status: "invalid",
        message: "Please enter a valid email address.",
      };
    }

    if (isDisposableEmail(email)) {
      return {
        email,
        valid: true,
        available: false,
        disposable: true,
        status: "disposable",
        message: "Disposable or temporary emails are not allowed.",
      };
    }

    const existing = await authRepository.findUserByEmail(email, {
      paranoid: false,
      attributes: ["id"],
    });

    if (existing) {
      return {
        email,
        valid: true,
        available: false,
        disposable: false,
        status: "taken",
        message: "This email is already registered.",
      };
    }

    return {
      email,
      valid: true,
      available: true,
      disposable: false,
      status: "ok",
      message: "Email is available.",
    };
  }

  async register(userData, meta = {}) {
    const { email, password, fullName, phone } = userData;
    const normalizedEmail = email.toLowerCase().trim();

    // Enforce the same rules as the live check so the API can't be bypassed.
    // This is specific to public sign-up: an admin may create any address.
    if (isDisposableEmail(normalizedEmail)) {
      throw new AppError("Disposable email addresses are not allowed", 400);
    }

    const transaction = await authRepository.beginTransaction();

    try {
      const user = await userService.provisionUser(
        {
          email: normalizedEmail,
          fullName,
          phone,
          password,
          role: "CUSTOMER",
          status: "ACTIVE",
        },
        transaction,
      );

      await transaction.commit();

      // Data is persisted first; only then do we publish the verification email
      // event. This is fire-and-forget, so a Kafka/email outage never fails
      // registration — the user account is already saved.
      await this.sendVerificationEmail(user, { requestId: meta.requestId });

      // Registration does NOT sign the user in. No access/refresh token is
      // issued here: the user is expected to verify their email and then log in.
      return {
        user: toSafeUser(user),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async sendVerificationEmail(user, meta = {}) {
    const verifyToken = jwtUtils.signEmailToken({
      id: user.id,
      email: user.email,
    });

    await emailProducer.publishAccountVerification(
      {
        userId: user.id,
        to: user.email,
        fullName: user.fullName,
        verifyToken,
      },
      { requestId: meta.requestId },
    );
  }

  async verifyEmail(token, meta = {}) {
    if (!token) {
      throw new AppError("Verification token is required", 400);
    }

    let decoded;

    try {
      decoded = jwtUtils.verifyEmailToken(token);
    } catch {
      throw new AppError("Invalid or expired verification link", 400);
    }

    const user = await authRepository.findUserById(decoded.id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("Account is not active", 403);
    }

    const alreadyVerified = Boolean(user.emailVerifiedAt);

    /**
     * Chỉ LẦN ĐẦU mới được đăng nhập bằng link.
     *
     * Trước 2026-09-08 `createTokens` chạy vô điều kiện, nên cái link trong hộp
     * thư là **một credential đăng nhập dùng lại được suốt 24 giờ**: token là JWT
     * không có nonce và không được ghi vào đâu để tiêu, nên bấm lại bao nhiêu lần
     * cũng phát ra một refresh cookie 7 ngày mới. Ai đọc hộp thư sau đó, nhận email
     * chuyển tiếp, hay tìm lại URL trong history của một máy dùng chung đều có phiên
     * đầy đủ — và `logout` không chặn được, vì link phát tiếp cái khác.
     *
     * Ràng buộc `emailVerifiedAt` biến chính hành động xác thực thành thứ tiêu
     * token: lần thứ hai trở đi `alreadyVerified` là true và không có gì được
     * phát. Không cần thêm bảng hay cột nào.
     *
     * Vẫn giữ được ý đồ ban đầu ("bấm link là vào được luôn") vì lần đầu — lần duy
     * nhất người dùng thật sự bấm — không đổi gì cả.
     */
    let refreshToken = null;

    if (!alreadyVerified) {
      await authRepository.updateUser(user, { emailVerifiedAt: new Date() });
      ({ refreshToken } = await this.createTokens(user, meta));
    }

    return { user: toSafeUser(user), alreadyVerified, refreshToken };
  }

  async resendVerification(userId, meta = {}) {
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.emailVerifiedAt) {
      throw new AppError("Email is already verified", 400);
    }

    await this.sendVerificationEmail(user, { requestId: meta.requestId });

    return { message: "Verification email sent" };
  }

  async loginWithGoogle(googleProfile, meta = {}) {
    const { providerUserId, email, fullName, avatarUrl } = googleProfile || {};

    if (!providerUserId || !email) {
      throw new AppError("Invalid Google profile", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1) Already linked to this Google account -> straight login.
    const existingProvider = await authRepository.findGoogleProviderWithUser(providerUserId);

    if (existingProvider?.user) {
      const user = existingProvider.user;

      if (user.status !== "ACTIVE") {
        throw new AppError("Account is not active", 403);
      }

      await Promise.all([
        authRepository.updateUser(user, { lastLoginAt: new Date() }),
        authRepository.updateAuthProvider(existingProvider, { lastUsedAt: new Date() }),
      ]);

      const tokens = await this.createTokens(user, meta);
      return { user: toSafeUser(user), ...tokens };
    }

    // 2) Not linked yet: link to an existing account by email, or create one.
    const transaction = await authRepository.beginTransaction();

    try {
      let user = await authRepository.findUserByEmail(normalizedEmail, { transaction });

      if (user) {
        if (user.status !== "ACTIVE") {
          throw new AppError("Account is not active", 403);
        }

        const updates = { lastLoginAt: new Date() };
        // Google has verified this email, so trust it.
        if (!user.emailVerifiedAt) {
          updates.emailVerifiedAt = new Date();
        }
        if (!user.avatarUrl && avatarUrl) {
          updates.avatarUrl = avatarUrl;
        }
        await authRepository.updateUser(user, updates, { transaction });
      } else {
        // No password: the GOOGLE provider row below is this account's only
        // credential, so provisionUser skips the LOCAL one.
        user = await userService.provisionUser(
          {
            email: normalizedEmail,
            fullName: fullName || normalizedEmail,
            role: "CUSTOMER",
            status: "ACTIVE",
            emailVerifiedAt: new Date(), // Google email is already verified
            avatarUrl,
          },
          transaction,
        );
      }

      await authRepository.createAuthProvider(
        {
          userId: user.id,
          provider: "GOOGLE",
          providerUserId,
          providerEmail: normalizedEmail,
          lastUsedAt: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      const tokens = await this.createTokens(user, meta);
      return { user: toSafeUser(user), ...tokens };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async login(credentials, meta = {}) {
    const { email, password } = credentials;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await authRepository.findUserWithLocalProviderByEmail(normalizedEmail);

    if (!user || user.status !== "ACTIVE") {
      throw new AppError("Invalid email or password", 401);
    }

    // Đang khoá thì chặn trước khi so mật khẩu: nhập đúng cũng không vào được, nên không dò tiếp được.
    const now = new Date();
    const lockout = await authRepository.findLoginLockout(user.id);
    if (lockout?.lockedUntil && lockout.lockedUntil > now) {
      throw lockedError(lockout.lockedUntil, now);
    }

    const localProvider = user.authProviders?.[0];
    const isPasswordValid = await bcrypt.compare(password, localProvider.passwordHash);

    if (!isPasswordValid) {
      const { lockedUntil } = await authRepository.recordFailedLogin(user.id, {
        now,
        maxAttempts: LOGIN_MAX_FAILED,
        lockMs: LOGIN_LOCK_MINUTES * 60000,
      });
      if (lockedUntil && lockedUntil > now) throw lockedError(lockedUntil, now);
      throw new AppError("Invalid email or password", 401);
    }

    await Promise.all([
      authRepository.clearLoginLockout(user.id),
      authRepository.updateUser(user, { lastLoginAt: new Date() }),
      authRepository.updateAuthProvider(localProvider, { lastUsedAt: new Date() }),
    ]);

    const tokens = await this.createTokens(user, meta);

    return {
      user: toSafeUser(user),
      ...tokens,
    };
  }

  async logout(refreshToken) {
    if (!refreshToken) {
      return { message: "Logged out successfully" };
    }

    await authRepository.revokeByTokenHash(this.hashToken(refreshToken));

    return { message: "Logged out successfully" };
  }

  async refresh(refreshToken, meta = {}) {
    if (!refreshToken) {
      throw new AppError("Refresh token is required", 401);
    }

    let decoded;

    try {
      decoded = jwtUtils.verifyRefresh(refreshToken);
    } catch {
      throw new AppError("Invalid refresh token", 401);
    }

    const transaction = await authRepository.beginTransaction();
    const now = new Date();
    const graceStartedAt = new Date(now.getTime() - REFRESH_TOKEN_REUSE_GRACE_MS);

    try {
      const storedRefreshToken = await authRepository.findRefreshTokenForRotation(
        this.hashToken(refreshToken),
        { now, graceStartedAt, transaction, lock: true },
      );

      if (!storedRefreshToken) {
        throw new AppError("Invalid refresh token", 401);
      }

      if (storedRefreshToken.userId !== decoded.id) {
        throw new AppError("Invalid refresh token", 401);
      }

      const user = await authRepository.findUserById(decoded.id, { transaction });

      if (!user || user.status !== "ACTIVE") {
        throw new AppError("Unauthorized", 401);
      }

      const shouldRotateRefreshToken =
        Boolean(storedRefreshToken.revokedAt) ||
        storedRefreshToken.expiresAt.getTime() - now.getTime() <= REFRESH_TOKEN_ROTATE_WITHIN_MS;

      if (!shouldRotateRefreshToken) {
        const accessToken = this.createAccessToken(user, storedRefreshToken.id);

        await transaction.commit();

        return {
          user: toSafeUser(user),
          accessToken,
          refreshToken: null,
        };
      }

      if (!storedRefreshToken.revokedAt) {
        await authRepository.updateRefreshToken(storedRefreshToken, { revokedAt: now }, { transaction });
      }

      const tokens = await this.createTokens(
        user,
        {
          deviceInfo: meta.deviceInfo || storedRefreshToken.deviceInfo,
          ipAddress: meta.ipAddress || storedRefreshToken.ipAddress,
        },
        { transaction },
      );

      await transaction.commit();

      return {
        user: toSafeUser(user),
        ...tokens,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new AuthService();

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { Op } = require("sequelize");
const db = require("../models");
const AppError = require("../utils/AppError");
const jwtUtils = require("../utils/jwt");
const emailProducer = require("../kafkas/producers/emailProducer");
const { isDisposableEmail } = require("../utils/disposableEmail");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;
const REFRESH_TOKEN_REUSE_GRACE_MS = 30 * 1000;
const REFRESH_TOKEN_ROTATE_WITHIN_MS = 24 * 60 * 60 * 1000;

class AuthService {
  hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  getRefreshTokenExpiresAt() {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
    return expiresAt;
  }

  toSafeUser(user) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  createAccessToken(user) {
    return jwtUtils.signAccess({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async createTokens(user, meta = {}, options = {}) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.createAccessToken(user);
    const refreshToken = jwtUtils.signRefresh({
      ...payload,
      tokenId: crypto.randomUUID(),
    });

    await db.RefreshToken.create(
      {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiresAt(),
        deviceInfo: meta.deviceInfo,
        ipAddress: meta.ipAddress,
      },
      options,
    );

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

    const existing = await db.User.findOne({
      where: { email },
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
    if (isDisposableEmail(normalizedEmail)) {
      throw new AppError("Disposable email addresses are not allowed", 400);
    }

    const existingUser = await db.User.findOne({
      where: { email: normalizedEmail },
      paranoid: false,
    });

    if (existingUser) {
      throw new AppError("Email already exists", 409);
    }

    const transaction = await db.sequelize.transaction();

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await db.User.create(
        {
          email: normalizedEmail,
          fullName: fullName.trim(),
          phone: phone || null,
          role: "CUSTOMER",
          status: "ACTIVE",
        },
        { transaction },
      );

      await db.AuthProvider.create(
        {
          userId: user.id,
          provider: "LOCAL",
          providerEmail: normalizedEmail,
          passwordHash,
        },
        { transaction },
      );

      await db.Cart.create({ userId: user.id }, { transaction });
      await db.Wishlist.create({ userId: user.id }, { transaction });

      await transaction.commit();

      // Data is persisted first; only then do we publish the verification email
      // event. This is fire-and-forget, so a Kafka/email outage never fails
      // registration — the user account is already saved.
      await this.sendVerificationEmail(user, { requestId: meta.requestId });

      // Registration does NOT sign the user in. No access/refresh token is
      // issued here: the user is expected to verify their email and then log in.
      return {
        user: this.toSafeUser(user),
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

    const user = await db.User.findByPk(decoded.id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("Account is not active", 403);
    }

    const alreadyVerified = Boolean(user.emailVerifiedAt);

    if (!alreadyVerified) {
      await user.update({ emailVerifiedAt: new Date() });
    }

    // Clicking the verification link also signs the user in: issue a refresh
    // token so the frontend can pick up the session right after the redirect.
    const { refreshToken } = await this.createTokens(user, meta);

    return { user: this.toSafeUser(user), alreadyVerified, refreshToken };
  }

  async resendVerification(userId, meta = {}) {
    const user = await db.User.findByPk(userId);

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
    const existingProvider = await db.AuthProvider.findOne({
      where: { provider: "GOOGLE", providerUserId },
      include: [{ model: db.User, as: "user" }],
    });

    if (existingProvider?.user) {
      const user = existingProvider.user;

      if (user.status !== "ACTIVE") {
        throw new AppError("Account is not active", 403);
      }

      await Promise.all([
        user.update({ lastLoginAt: new Date() }),
        existingProvider.update({ lastUsedAt: new Date() }),
      ]);

      const tokens = await this.createTokens(user, meta);
      return { user: this.toSafeUser(user), ...tokens };
    }

    // 2) Not linked yet: link to an existing account by email, or create one.
    const transaction = await db.sequelize.transaction();

    try {
      let user = await db.User.findOne({ where: { email: normalizedEmail }, transaction });

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
        await user.update(updates, { transaction });
      } else {
        user = await db.User.create(
          {
            email: normalizedEmail,
            fullName: (fullName || normalizedEmail).trim(),
            role: "CUSTOMER",
            status: "ACTIVE",
            emailVerifiedAt: new Date(), // Google email is already verified
            avatarUrl: avatarUrl || null,
          },
          { transaction },
        );

        await db.Cart.create({ userId: user.id }, { transaction });
        await db.Wishlist.create({ userId: user.id }, { transaction });
      }

      await db.AuthProvider.create(
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
      return { user: this.toSafeUser(user), ...tokens };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async login(credentials, meta = {}) {
    const { email, password } = credentials;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.User.findOne({
      where: { email: normalizedEmail },
      include: [
        {
          model: db.AuthProvider,
          as: "authProviders",
          where: { provider: "LOCAL" },
          required: true,
        },
      ],
    });

    if (!user || user.status !== "ACTIVE") {
      throw new AppError("Invalid email or password", 401);
    }

    const localProvider = user.authProviders?.[0];
    const isPasswordValid = await bcrypt.compare(password, localProvider.passwordHash);

    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    await Promise.all([
      user.update({ lastLoginAt: new Date() }),
      localProvider.update({ lastUsedAt: new Date() }),
    ]);

    const tokens = await this.createTokens(user, meta);

    return {
      user: this.toSafeUser(user),
      ...tokens,
    };
  }

  async getProfile(userId) {
    const user = await db.User.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return this.toSafeUser(user);
  }

  async updateProfile(userId, data) {
    const user = await db.User.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updates = {};

    if (data.fullName !== undefined) {
      updates.fullName = data.fullName.trim();
    }

    if (data.phone !== undefined) {
      updates.phone = data.phone ? data.phone.trim() : null;
    }

    if (data.avatarUrl !== undefined) {
      updates.avatarUrl = data.avatarUrl ? data.avatarUrl.trim() : null;
    }

    await user.update(updates);

    return this.toSafeUser(user);
  }

  async updateAvatar(userId, avatarData) {
    const user = await db.User.findByPk(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    await user.update({
      avatarUrl: avatarData.avatarUrl,
      avatarPublicId: avatarData.avatarPublicId,
    });

    return this.toSafeUser(user);
  }

  async logout(refreshToken) {
    if (!refreshToken) {
      return { message: "Logged out successfully" };
    }

    await db.RefreshToken.update(
      { revokedAt: new Date() },
      {
        where: {
          tokenHash: this.hashToken(refreshToken),
          revokedAt: null,
        },
      },
    );

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

    const transaction = await db.sequelize.transaction();
    const now = new Date();
    const graceStartedAt = new Date(now.getTime() - REFRESH_TOKEN_REUSE_GRACE_MS);

    try {
      const storedRefreshToken = await db.RefreshToken.findOne({
        where: {
          tokenHash: this.hashToken(refreshToken),
          expiresAt: { [Op.gt]: now },
          [Op.or]: [
            { revokedAt: null },
            { revokedAt: { [Op.gt]: graceStartedAt } },
          ],
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!storedRefreshToken) {
        throw new AppError("Invalid refresh token", 401);
      }

      if (storedRefreshToken.userId !== decoded.id) {
        throw new AppError("Invalid refresh token", 401);
      }

      const user = await db.User.findByPk(decoded.id, { transaction });

      if (!user || user.status !== "ACTIVE") {
        throw new AppError("Unauthorized", 401);
      }

      const shouldRotateRefreshToken =
        Boolean(storedRefreshToken.revokedAt) ||
        storedRefreshToken.expiresAt.getTime() - now.getTime() <= REFRESH_TOKEN_ROTATE_WITHIN_MS;

      if (!shouldRotateRefreshToken) {
        const accessToken = this.createAccessToken(user);

        await transaction.commit();

        return {
          user: this.toSafeUser(user),
          accessToken,
          refreshToken: null,
        };
      }

      if (!storedRefreshToken.revokedAt) {
        await storedRefreshToken.update({ revokedAt: now }, { transaction });
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
        user: this.toSafeUser(user),
        ...tokens,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new AuthService();

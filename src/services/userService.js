const { Op } = require("sequelize");
const AppError = require("../utils/AppError");
const { likeContains } = require("../utils/sqlLike");
const { hashPassword } = require("../utils/passwordCrypto");
const { toSafeUser } = require("../utils/userSerializer");
const userRepository = require("../repositories/userRepository");

// Everything that operates on a user account, for both audiences:
//   - the signed-in customer acting on themselves  (getMyProfile / updateMy*)
//   - an admin acting on someone else              (getAllUsers / createUser / ...)
//
// authService delegates account creation here (provisionUser) so public
// registration, Google sign-up and admin-created users all follow the exact
// same bootstrap.
class UserService {
  buildPagination(query) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  buildPagedResult(rows, count, page, limit) {
    return {
      items: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  normalizeEmail(email) {
    return String(email || "").toLowerCase().trim();
  }

  /**
   * Create a user row plus everything a new account needs: a LOCAL password
   * provider (only when a password is supplied — OAuth sign-ups have none), a
   * cart and a wishlist.
   *
   * The caller owns the transaction, because every caller has extra work to
   * commit atomically alongside the account (authService links the Google
   * provider, adminService has nothing else but keeps the rollback contract).
   *
   * Callers are responsible for policy that is specific to their entry point —
   * e.g. only public registration rejects disposable email domains.
   */
  async provisionUser(data, transaction) {
    const email = this.normalizeEmail(data.email);

    const existingUser = await userRepository.findUserByEmail(email, {
      paranoid: false,
      transaction,
    });

    if (existingUser) {
      throw new AppError("Email already exists", 409);
    }

    const user = await userRepository.createUser(
      {
        email,
        fullName: String(data.fullName || email).trim(),
        phone: data.phone || null,
        role: data.role || "CUSTOMER",
        status: data.status || "ACTIVE",
        emailVerifiedAt: data.emailVerifiedAt || null,
        avatarUrl: data.avatarUrl || null,
      },
      { transaction },
    );

    if (data.password) {
      await userRepository.createAuthProvider(
        {
          userId: user.id,
          provider: "LOCAL",
          providerEmail: email,
          passwordHash: await hashPassword(data.password),
        },
        { transaction },
      );
    }

    await userRepository.createCart(user.id, { transaction });
    await userRepository.createWishlist(user.id, { transaction });

    return user;
  }

  // ---- Self-service (the signed-in user acting on their own account) ----
  async getMyProfile(userId) {
    const user = await userRepository.findUserById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return toSafeUser(user);
  }

  async updateMyProfile(userId, data) {
    const user = await userRepository.findUserById(userId);

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

    // avatarUrl chỉ đổi qua POST /users/me/avatar, không nhận URL tự do từ client.
    await userRepository.updateUser(user, updates);

    return toSafeUser(user);
  }

  async updateMyAvatar(userId, avatarData) {
    const user = await userRepository.findUserById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    await userRepository.updateUser(user, {
      avatarUrl: avatarData.avatarUrl,
      avatarPublicId: avatarData.avatarPublicId,
    });

    return toSafeUser(user);
  }

  // ---- Admin management (acting on someone else's account) ----
  async getAllUsers(query = {}) {
    const { page, limit, offset } = this.buildPagination(query);

    // Ô tìm kiếm của FE gửi `q`, Swagger ghi `keyword`; nhận cả hai.
    const keyword = String(query.q ?? query.keyword ?? "").trim();
    const where = {};
    if (keyword) {
      where[Op.or] = ["email", "fullName", "phone"].map((field) => ({ [field]: { [Op.like]: likeContains(keyword) } }));
    }
    if (["ADMIN", "CUSTOMER"].includes(query.role)) {
      where.role = query.role;
    }
    if (["ACTIVE", "INACTIVE", "BLOCKED"].includes(query.status)) {
      where.status = query.status;
    }

    const { rows, count } = await userRepository.findAndCountUsers({ limit, offset, where });

    return this.buildPagedResult(rows, count, page, limit);
  }

  async getUserById(id) {
    const user = await userRepository.findUserByIdWithRelations(id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  async createUser(data) {
    const transaction = await userRepository.beginTransaction();

    try {
      const user = await this.provisionUser(data, transaction);

      await transaction.commit();

      return user;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Admin không được tự hạ quyền, tự khoá hay tự xoá mình. Vì người thao tác luôn là một admin
  // đang hoạt động, luật này cũng đủ bảo đảm hệ thống không bao giờ mất admin cuối cùng.
  assertNotSelfLockout(targetId, actorId, data = {}) {
    if (!actorId || targetId !== actorId) {
      return;
    }
    if (data.role !== undefined && data.role !== "ADMIN") {
      throw new AppError("You cannot remove your own admin role", 409);
    }
    if (data.status !== undefined && data.status !== "ACTIVE") {
      throw new AppError("You cannot deactivate or block your own account", 409);
    }
  }

  async updateUser(id, data, actorId = null) {
    this.assertNotSelfLockout(id, actorId, data);
    const user = await this.getUserById(id);

    await userRepository.updateUser(user, {
      email: data.email !== undefined ? this.normalizeEmail(data.email) : user.email,
      fullName: data.fullName ?? user.fullName,
      phone: data.phone ?? user.phone,
      avatarUrl: data.avatarUrl ?? user.avatarUrl,
      avatarPublicId: data.avatarPublicId ?? user.avatarPublicId,
      role: data.role ?? user.role,
      status: data.status ?? user.status,
    });

    return user;
  }

  async deleteUser(id, actorId = null) {
    if (actorId && id === actorId) {
      throw new AppError("You cannot delete your own account", 409);
    }
    const user = await this.getUserById(id);
    await userRepository.destroyUser(user);

    return { message: "User deleted successfully" };
  }
}

module.exports = new UserService();

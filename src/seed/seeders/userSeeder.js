const bcrypt = require("bcryptjs");
const db = require("../../models");
const usersData = require("../data/users.data");

/**
 * Seeds Users, AuthProviders, UserAddresses, and initializes Carts & Wishlists
 */
async function seedUsers(transaction) {
  console.log("  Seeding Users & AuthProviders...");

  const userMap = new Map();
  const passwordHashCache = new Map();

  for (const item of usersData) {
    const user = await db.User.create(
      {
        email: item.email.toLowerCase().trim(),
        fullName: item.fullName,
        phone: item.phone || null,
        role: item.role,
        status: item.status,
        emailVerifiedAt: item.emailVerifiedAt,
        lastLoginAt: item.lastLoginAt,
        avatarUrl: item.avatarUrl || null,
      },
      { transaction },
    );

    userMap.set(item.key, user);

    // Auth Provider
    if (item.auth) {
      let passwordHash = null;
      if (item.auth.provider === "LOCAL" && item.auth.password) {
        if (!passwordHashCache.has(item.auth.password)) {
          const hash = await bcrypt.hash(item.auth.password, 10);
          passwordHashCache.set(item.auth.password, hash);
        }
        passwordHash = passwordHashCache.get(item.auth.password);
      }

      await db.AuthProvider.create(
        {
          userId: user.id,
          provider: item.auth.provider,
          providerUserId: item.auth.providerUserId || null,
          providerEmail: item.auth.providerEmail || (item.auth.provider === "LOCAL" ? user.email : null),
          passwordHash,
          linkedAt: user.createdAt || new Date(),
          lastUsedAt: user.lastLoginAt,
        },
        { transaction },
      );
    }

    // Always create Cart and Wishlist for every user
    await db.Cart.create({ userId: user.id }, { transaction });
    await db.Wishlist.create({ userId: user.id }, { transaction });

    // Addresses
    if (Array.isArray(item.addresses) && item.addresses.length > 0) {
      for (const addr of item.addresses) {
        await db.UserAddress.create(
          {
            userId: user.id,
            receiverName: addr.receiverName,
            receiverPhone: addr.receiverPhone,
            province: addr.province,
            district: addr.district,
            ward: addr.ward,
            addressLine: addr.addressLine,
            postalCode: addr.postalCode || null,
            isDefault: addr.isDefault || false,
          },
          { transaction },
        );
      }
    }
  }

  console.log(`    Created ${usersData.length} Users with AuthProviders and initial Carts/Wishlists.`);
  return userMap;
}

module.exports = { seedUsers };

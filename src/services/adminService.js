const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const db = require("../models");
const AppError = require("../utils/AppError");
const { slugify } = require("../utils/slug");

class AdminService {
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

  async getAllUsers(query = {}) {
    const { page, limit, offset } = this.buildPagination(query);

    const { rows, count } = await db.User.findAndCountAll({
      attributes: { exclude: ["deletedAt"] },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return this.buildPagedResult(rows, count, page, limit);
  }

  async getUserById(id) {
    const user = await db.User.findByPk(id, {
      include: [
        { model: db.AuthProvider, as: "authProviders", attributes: { exclude: ["passwordHash"] } },
        { model: db.Cart, as: "cart" },
        { model: db.Wishlist, as: "wishlist" },
      ],
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  async createUser(data) {
    const existingUser = await db.User.findOne({
      where: { email: data.email },
      paranoid: false,
    });

    if (existingUser) {
      throw new AppError("Email already exists", 409);
    }

    const transaction = await db.sequelize.transaction();

    try {
      const user = await db.User.create(
        {
          email: data.email,
          fullName: data.fullName,
          phone: data.phone || null,
          role: data.role || "CUSTOMER",
          status: data.status || "ACTIVE",
        },
        { transaction },
      );

      await db.AuthProvider.create(
        {
          userId: user.id,
          provider: "LOCAL",
          providerEmail: data.email,
          passwordHash: await bcrypt.hash(data.password, 10),
        },
        { transaction },
      );

      await db.Cart.create({ userId: user.id }, { transaction });
      await db.Wishlist.create({ userId: user.id }, { transaction });

      await transaction.commit();

      return user;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateUser(id, data) {
    const user = await this.getUserById(id);

    await user.update({
      email: data.email ?? user.email,
      fullName: data.fullName ?? user.fullName,
      phone: data.phone ?? user.phone,
      avatarUrl: data.avatarUrl ?? user.avatarUrl,
      avatarPublicId: data.avatarPublicId ?? user.avatarPublicId,
      role: data.role ?? user.role,
      status: data.status ?? user.status,
    });

    return user;
  }

  async deleteUser(id) {
    const user = await this.getUserById(id);
    await user.destroy();

    return { message: "User deleted successfully" };
  }

  async getAllCategories() {
    return db.Category.findAll({
      include: [{ model: db.Category, as: "children" }],
      order: [["sortOrder", "ASC"], ["createdAt", "DESC"]],
    });
  }

  async buildUniqueCategorySlug(name, currentCategoryId = null, requestedSlug = null) {
    const baseSlug = slugify(requestedSlug || name, "category");
    let candidateSlug = baseSlug;
    let suffix = 1;

    while (await db.Category.findOne({
      where: {
        slug: candidateSlug,
        ...(currentCategoryId ? { id: { [Op.ne]: currentCategoryId } } : {}),
      },
      paranoid: false,
    })) {
      suffix += 1;
      candidateSlug = `${baseSlug}-${suffix}`;
    }

    return candidateSlug;
  }

  async buildUniqueBrandSlug(name, currentBrandId = null, requestedSlug = null) {
    const baseSlug = slugify(requestedSlug || name, "brand");
    let candidateSlug = baseSlug;
    let suffix = 1;

    while (await db.Brand.findOne({
      where: {
        slug: candidateSlug,
        ...(currentBrandId ? { id: { [Op.ne]: currentBrandId } } : {}),
      },
      paranoid: false,
    })) {
      suffix += 1;
      candidateSlug = `${baseSlug}-${suffix}`;
    }

    return candidateSlug;
  }

  async createCategory(data) {
    return db.Category.create({
      parentId: data.parentId || null,
      name: data.name,
      slug: await this.buildUniqueCategorySlug(data.name, null, data.slug),
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      imagePublicId: data.imagePublicId || null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder || 0,
    });
  }

  async updateCategory(id, data) {
    const category = await db.Category.findByPk(id);

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    const nextData = {
      ...data,
      slug: await this.buildUniqueCategorySlug(
        data.name ?? category.name,
        category.id,
        data.slug,
      ),
    };

    await category.update(nextData);
    return category;
  }

  async deleteCategory(id) {
    const category = await db.Category.findByPk(id);

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    await category.destroy();
    return { message: "Category deleted successfully" };
  }

  async getAllBrands() {
    return db.Brand.findAll({ order: [["createdAt", "DESC"]] });
  }

  async createBrand(data) {
    return db.Brand.create({
      name: data.name,
      slug: await this.buildUniqueBrandSlug(data.name, null, data.slug),
      logoUrl: data.logoUrl || null,
      logoPublicId: data.logoPublicId || null,
      description: data.description || null,
      isActive: data.isActive ?? true,
    });
  }

  async updateBrand(id, data) {
    const brand = await db.Brand.findByPk(id);

    if (!brand) {
      throw new AppError("Brand not found", 404);
    }

    const nextData = {
      ...data,
      slug: await this.buildUniqueBrandSlug(
        data.name ?? brand.name,
        brand.id,
        data.slug,
      ),
    };

    await brand.update(nextData);
    return brand;
  }

  async deleteBrand(id) {
    const brand = await db.Brand.findByPk(id);

    if (!brand) {
      throw new AppError("Brand not found", 404);
    }

    await brand.destroy();
    return { message: "Brand deleted successfully" };
  }

}

module.exports = new AdminService();


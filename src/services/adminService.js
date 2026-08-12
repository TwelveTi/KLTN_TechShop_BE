const AppError = require("../utils/AppError");
const { slugify } = require("../utils/slug");
const { hashPassword } = require("../utils/passwordCrypto");
const adminRepository = require("../repositories/adminRepository");

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

    const { rows, count } = await adminRepository.findAndCountUsers({ limit, offset });

    return this.buildPagedResult(rows, count, page, limit);
  }

  async getUserById(id) {
    const user = await adminRepository.findUserByIdWithRelations(id);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  async createUser(data) {
    const existingUser = await adminRepository.findUserByEmail(data.email, { paranoid: false });

    if (existingUser) {
      throw new AppError("Email already exists", 409);
    }

    const transaction = await adminRepository.beginTransaction();

    try {
      const user = await adminRepository.createUser(
        {
          email: data.email,
          fullName: data.fullName,
          phone: data.phone || null,
          role: data.role || "CUSTOMER",
          status: data.status || "ACTIVE",
        },
        { transaction },
      );

      await adminRepository.createAuthProvider(
        {
          userId: user.id,
          provider: "LOCAL",
          providerEmail: data.email,
          passwordHash: await hashPassword(data.password),
        },
        { transaction },
      );

      await adminRepository.createCart(user.id, { transaction });
      await adminRepository.createWishlist(user.id, { transaction });

      await transaction.commit();

      return user;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateUser(id, data) {
    const user = await this.getUserById(id);

    await adminRepository.updateUser(user, {
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
    await adminRepository.destroyUser(user);

    return { message: "User deleted successfully" };
  }

  async getAllCategories() {
    return adminRepository.findAllCategories();
  }

  async buildUniqueCategorySlug(name, currentCategoryId = null, requestedSlug = null) {
    const baseSlug = slugify(requestedSlug || name, "category");
    let candidateSlug = baseSlug;
    let suffix = 1;

    while (await adminRepository.findCategoryBySlug(candidateSlug, { excludeId: currentCategoryId })) {
      suffix += 1;
      candidateSlug = `${baseSlug}-${suffix}`;
    }

    return candidateSlug;
  }

  async buildUniqueBrandSlug(name, currentBrandId = null, requestedSlug = null) {
    const baseSlug = slugify(requestedSlug || name, "brand");
    let candidateSlug = baseSlug;
    let suffix = 1;

    while (await adminRepository.findBrandBySlug(candidateSlug, { excludeId: currentBrandId })) {
      suffix += 1;
      candidateSlug = `${baseSlug}-${suffix}`;
    }

    return candidateSlug;
  }

  async createCategory(data) {
    return adminRepository.createCategory({
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
    const category = await adminRepository.findCategoryById(id);

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

    await adminRepository.updateCategory(category, nextData);
    return category;
  }

  async deleteCategory(id) {
    const category = await adminRepository.findCategoryById(id);

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    await adminRepository.destroyCategory(category);
    return { message: "Category deleted successfully" };
  }

  async getAllBrands() {
    return adminRepository.findAllBrands();
  }

  async createBrand(data) {
    return adminRepository.createBrand({
      name: data.name,
      slug: await this.buildUniqueBrandSlug(data.name, null, data.slug),
      logoUrl: data.logoUrl || null,
      logoPublicId: data.logoPublicId || null,
      description: data.description || null,
      isActive: data.isActive ?? true,
    });
  }

  async updateBrand(id, data) {
    const brand = await adminRepository.findBrandById(id);

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

    await adminRepository.updateBrand(brand, nextData);
    return brand;
  }

  async deleteBrand(id) {
    const brand = await adminRepository.findBrandById(id);

    if (!brand) {
      throw new AppError("Brand not found", 404);
    }

    await adminRepository.destroyBrand(brand);
    return { message: "Brand deleted successfully" };
  }
}

module.exports = new AdminService();

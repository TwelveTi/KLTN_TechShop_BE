const AppError = require("../utils/AppError");
const { slugify } = require("../utils/slug");
const adminRepository = require("../repositories/adminRepository");

// Admin management of the catalog taxonomy. User management moved to
// userService, which serves both admins and the users themselves.
// Gắn số sản phẩm (mọi trạng thái) vào từng dòng, để admin thấy danh mục/hãng nào còn hàng trước khi xoá.
const withProductCount = (rows, counts, key) => {
  const totals = new Map(counts.map((row) => [row[key], Number(row.total)]));
  return rows.map((row) => ({ ...row.get({ plain: true }), productCount: totals.get(row.id) || 0 }));
};

class AdminService {
  async getAllCategories() {
    const [categories, counts] = await Promise.all([
      adminRepository.findAllCategories(),
      adminRepository.countProductsByCategory(),
    ]);
    return withProductCount(categories, counts, "categoryId");
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
    const [brands, counts] = await Promise.all([
      adminRepository.findAllBrands(),
      adminRepository.countProductsByBrand(),
    ]);
    return withProductCount(brands, counts, "brandId");
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

const { Op } = require("sequelize");
const db = require("../models");
const AppError = require("../utils/AppError");
const { slugify } = require("../utils/slug");

class ProductService {
  buildPagination(query) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 100);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  buildWhere(query) {
    const where = {};

    if (query.onlyActive) {
      where.status = "ACTIVE";
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.brandId) {
      where.brandId = query.brandId;
    }

    if (query.keyword) {
      where.name = { [Op.like]: `%${query.keyword}%` };
    }

    if (query.minPrice || query.maxPrice) {
      where.basePrice = {};
      if (query.minPrice) {
        where.basePrice[Op.gte] = Number(query.minPrice);
      }
      if (query.maxPrice) {
        where.basePrice[Op.lte] = Number(query.maxPrice);
      }
    }

    return where;
  }

  buildOrder(sort) {
    const sortMap = {
      newest: [["createdAt", "DESC"]],
      priceAsc: [["basePrice", "ASC"]],
      priceDesc: [["basePrice", "DESC"]],
      bestSelling: [["soldCount", "DESC"]],
      rating: [["averageRating", "DESC"]],
    };

    return sortMap[sort] || sortMap.newest;
  }

  async getAllProducts(query = {}) {
    const { page, limit, offset } = this.buildPagination(query);

    const { rows, count } = await db.Product.findAndCountAll({
      where: this.buildWhere(query),
      include: [
        { model: db.Category, as: "category" },
        { model: db.Brand, as: "brand" },
        { model: db.ProductImage, as: "images" },
        { model: db.ProductVariant, as: "variants" },
      ],
      distinct: true,
      order: this.buildOrder(query.sort),
      limit,
      offset,
    });

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

  async getProductById(id, options = {}) {
    const where = { id };

    if (options.onlyActive) {
      where.status = "ACTIVE";
    }

    const product = await db.Product.findOne({
      where,
      include: [
        { model: db.Category, as: "category" },
        { model: db.Brand, as: "brand" },
        { model: db.ProductImage, as: "images" },
        { model: db.ProductVariant, as: "variants" },
        {
          model: db.ProductSpecification,
          as: "specifications",
          include: [{ model: db.SpecificationDefinition, as: "definition" }],
        },
        { model: db.Tag, as: "tags" },
      ],
    });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    return product;
  }

  async assertProductRelations(data) {
    if (data.categoryId) {
      const category = await db.Category.findByPk(data.categoryId);
      if (!category) {
        throw new AppError("Category not found", 404);
      }
    }

    if (data.brandId) {
      const brand = await db.Brand.findByPk(data.brandId);
      if (!brand) {
        throw new AppError("Brand not found", 404);
      }
    }
  }

  async buildUniqueProductSlug(name, currentProductId = null, requestedSlug = null) {
    const baseSlug = slugify(requestedSlug || name, "product");
    let candidateSlug = baseSlug;
    let suffix = 1;

    while (await db.Product.findOne({
      where: {
        slug: candidateSlug,
        ...(currentProductId ? { id: { [Op.ne]: currentProductId } } : {}),
      },
      paranoid: false,
    })) {
      suffix += 1;
      candidateSlug = `${baseSlug}-${suffix}`;
    }

    return candidateSlug;
  }

  async upsertSpecificationDefinition(categoryId, specification, transaction) {
    const key = slugify(specification.key || specification.name, "spec");
    const [definition] = await db.SpecificationDefinition.findOrCreate({
      where: { categoryId, key },
      defaults: {
        categoryId,
        key,
        name: specification.name,
        dataType: "STRING",
        unit: specification.unit || null,
        sortOrder: specification.sortOrder || 0,
      },
      transaction,
    });

    return definition;
  }

  async replaceProductSpecifications(productId, categoryId, specifications = [], transaction) {
    await db.ProductSpecification.destroy({ where: { productId }, transaction });

    const validSpecifications = specifications.filter((specification) => specification.name && specification.valueText);

    for (const specification of validSpecifications) {
      const definition = await this.upsertSpecificationDefinition(categoryId, specification, transaction);
      await db.ProductSpecification.create(
        {
          productId,
          specificationDefinitionId: definition.id,
          valueText: specification.valueText,
        },
        { transaction },
      );
    }
  }

  async createProduct(data) {
    await this.assertProductRelations(data);

    const transaction = await db.sequelize.transaction();

    try {
      const product = await db.Product.create(
        {
          categoryId: data.categoryId,
          brandId: data.brandId,
          name: data.name,
          slug: await this.buildUniqueProductSlug(data.name, null, data.slug),
          sku: data.sku || null,
          shortDescription: data.shortDescription || null,
          description: data.description || null,
          basePrice: data.basePrice,
          salePrice: data.salePrice || null,
          stockQuantity: data.stockQuantity || 0,
          status: data.status || "DRAFT",
          isFeatured: data.isFeatured || false,
          publishedAt: data.publishedAt || null,
        },
        { transaction },
      );

      if (Array.isArray(data.images) && data.images.length > 0) {
        await db.ProductImage.bulkCreate(
          data.images.map((image, index) => ({
            productId: product.id,
            imageUrl: image.imageUrl,
            publicId: image.publicId || null,
            altText: image.altText || null,
            isPrimary: image.isPrimary || index === 0,
            sortOrder: image.sortOrder || index,
          })),
          { transaction },
        );
      }

      if (Array.isArray(data.variants) && data.variants.length > 0) {
        await db.ProductVariant.bulkCreate(
          data.variants.map((variant) => ({
            productId: product.id,
            sku: variant.sku,
            variantName: variant.variantName,
            attributes: variant.attributes || null,
            price: variant.price || null,
            salePrice: variant.salePrice || null,
            stockQuantity: variant.stockQuantity || 0,
            isDefault: variant.isDefault || false,
            status: variant.status || "ACTIVE",
          })),
          { transaction },
        );
      }

      if (Array.isArray(data.specifications)) {
        await this.replaceProductSpecifications(product.id, product.categoryId, data.specifications, transaction);
      }

      await transaction.commit();
      return this.getProductById(product.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateProduct(id, data, uploadService) {
    const product = await this.getProductById(id);
    await this.assertProductRelations(data);
    const oldImages = Array.isArray(data.images)
      ? await db.ProductImage.findAll({ where: { productId: product.id } })
      : [];

    const transaction = await db.sequelize.transaction();

    try {
      await product.update(
        {
          categoryId: data.categoryId ?? product.categoryId,
          brandId: data.brandId ?? product.brandId,
          name: data.name ?? product.name,
          slug: data.name !== undefined || data.slug !== undefined
            ? await this.buildUniqueProductSlug(data.name ?? product.name, product.id, data.slug)
            : product.slug,
          sku: data.sku ?? product.sku,
          shortDescription: data.shortDescription ?? product.shortDescription,
          description: data.description ?? product.description,
          basePrice: data.basePrice ?? product.basePrice,
          salePrice: data.salePrice ?? product.salePrice,
          stockQuantity: data.stockQuantity ?? product.stockQuantity,
          status: data.status ?? product.status,
          isFeatured: data.isFeatured ?? product.isFeatured,
          publishedAt: data.publishedAt ?? product.publishedAt,
        },
        { transaction },
      );

      if (Array.isArray(data.images)) {
        await db.ProductImage.destroy({ where: { productId: product.id }, transaction });
        await db.ProductImage.bulkCreate(
          data.images.map((image, index) => ({
            productId: product.id,
            imageUrl: image.imageUrl,
            publicId: image.publicId || null,
            altText: image.altText || null,
            isPrimary: image.isPrimary || index === 0,
            sortOrder: image.sortOrder || index,
          })),
          { transaction },
        );
      }

      if (Array.isArray(data.variants)) {
        await db.ProductVariant.destroy({ where: { productId: product.id }, force: true, transaction });
        await db.ProductVariant.bulkCreate(
          data.variants.map((variant) => ({
            productId: product.id,
            sku: variant.sku,
            variantName: variant.variantName,
            attributes: variant.attributes || null,
            price: variant.price || null,
            salePrice: variant.salePrice || null,
            stockQuantity: variant.stockQuantity || 0,
            isDefault: variant.isDefault || false,
            status: variant.status || "ACTIVE",
          })),
          { transaction },
        );
      }

      if (Array.isArray(data.specifications)) {
        await this.replaceProductSpecifications(product.id, data.categoryId ?? product.categoryId, data.specifications, transaction);
      }

      await transaction.commit();

      if (uploadService) {
        await uploadService.deleteMany(oldImages.map((image) => image.publicId));
      }

      return this.getProductById(product.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteProduct(id, uploadService) {
    const product = await this.getProductById(id);
    const images = await db.ProductImage.findAll({ where: { productId: product.id } });

    await product.destroy();

    if (uploadService) {
      await uploadService.deleteMany(images.map((image) => image.publicId));
    }

    return { message: "Product deleted successfully" };
  }
}

module.exports = new ProductService();

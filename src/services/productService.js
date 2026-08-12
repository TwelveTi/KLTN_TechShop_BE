const AppError = require("../utils/AppError");
const { slugify } = require("../utils/slug");
const productRepository = require("../repositories/productRepository");

class ProductService {
  async getAllProducts(query = {}) {
    const { rows, count, page, limit } = await productRepository.findAndCountProducts(query);

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
    const product = await productRepository.findDetailById(id, {
      onlyActive: Boolean(options.onlyActive),
    });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    return product;
  }

  async assertProductRelations(data) {
    if (data.categoryId) {
      const category = await productRepository.findCategoryById(data.categoryId);
      if (!category) {
        throw new AppError("Category not found", 404);
      }
    }

    if (data.brandId) {
      const brand = await productRepository.findBrandById(data.brandId);
      if (!brand) {
        throw new AppError("Brand not found", 404);
      }
    }
  }

  async buildUniqueProductSlug(name, currentProductId = null, requestedSlug = null) {
    const baseSlug = slugify(requestedSlug || name, "product");
    let candidateSlug = baseSlug;
    let suffix = 1;

    while (await productRepository.findBySlug(candidateSlug, { excludeId: currentProductId })) {
      suffix += 1;
      candidateSlug = `${baseSlug}-${suffix}`;
    }

    return candidateSlug;
  }

  async upsertSpecificationDefinition(categoryId, specification, transaction) {
    const key = slugify(specification.key || specification.name, "spec");
    const [definition] = await productRepository.findOrCreateSpecificationDefinition(
      categoryId,
      key,
      {
        categoryId,
        key,
        name: specification.name,
        dataType: "STRING",
        unit: specification.unit || null,
        sortOrder: specification.sortOrder || 0,
      },
      { transaction },
    );

    return definition;
  }

  async replaceProductSpecifications(productId, categoryId, specifications = [], transaction) {
    await productRepository.destroySpecificationsByProduct(productId, { transaction });

    const validSpecifications = specifications.filter((specification) => specification.name && specification.valueText);

    for (const specification of validSpecifications) {
      const definition = await this.upsertSpecificationDefinition(categoryId, specification, transaction);
      await productRepository.createSpecification(
        {
          productId,
          specificationDefinitionId: definition.id,
          valueText: specification.valueText,
        },
        { transaction },
      );
    }
  }

  mapImageRows(images, productId) {
    return images.map((image, index) => ({
      productId,
      imageUrl: image.imageUrl,
      publicId: image.publicId || null,
      altText: image.altText || null,
      isPrimary: image.isPrimary || index === 0,
      sortOrder: image.sortOrder || index,
    }));
  }

  mapVariantRows(variants, productId) {
    return variants.map((variant) => ({
      productId,
      sku: variant.sku,
      variantName: variant.variantName,
      attributes: variant.attributes || null,
      price: variant.price || null,
      salePrice: variant.salePrice || null,
      stockQuantity: variant.stockQuantity || 0,
      isDefault: variant.isDefault || false,
      status: variant.status || "ACTIVE",
    }));
  }

  async createProduct(data) {
    await this.assertProductRelations(data);

    const transaction = await productRepository.beginTransaction();

    try {
      const product = await productRepository.createProduct(
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
        await productRepository.bulkCreateImages(this.mapImageRows(data.images, product.id), { transaction });
      }

      if (Array.isArray(data.variants) && data.variants.length > 0) {
        await productRepository.bulkCreateVariants(this.mapVariantRows(data.variants, product.id), { transaction });
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
      ? await productRepository.findImagesByProduct(product.id)
      : [];

    const transaction = await productRepository.beginTransaction();

    try {
      await productRepository.updateProduct(
        product,
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
        await productRepository.destroyImagesByProduct(product.id, { transaction });
        await productRepository.bulkCreateImages(this.mapImageRows(data.images, product.id), { transaction });
      }

      if (Array.isArray(data.variants)) {
        await productRepository.destroyVariantsByProduct(product.id, { transaction });
        await productRepository.bulkCreateVariants(this.mapVariantRows(data.variants, product.id), { transaction });
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
    const images = await productRepository.findImagesByProduct(product.id);

    await productRepository.destroyProduct(product);

    if (uploadService) {
      await uploadService.deleteMany(images.map((image) => image.publicId));
    }

    return { message: "Product deleted successfully" };
  }
}

module.exports = new ProductService();

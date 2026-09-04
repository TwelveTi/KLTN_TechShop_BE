const AppError = require("../utils/AppError");
const { slugify } = require("../utils/slug");
const { buildSpecValue, inferDataType, SpecValueError } = require("../utils/specValue");
const productRepository = require("../repositories/productRepository");
const behaviorService = require("./behaviorService");

class ProductService {
  async getAllProducts(query = {}, viewer = null) {
    const { rows, count, page, limit } = await productRepository.findAndCountProducts(query);

    // A keyword search is the clearest statement of intent a shopper makes, so
    // it is recorded server-side rather than trusted to the client. Tracking
    // never throws, so a listing is returned even if the write fails.
    if (viewer && query.keyword && String(query.keyword).trim()) {
      await behaviorService.trackSearch({
        userId: viewer.userId || null,
        sessionId: viewer.sessionId || null,
        keyword: query.keyword,
        filters: { category: query.category || query.categoryId || null, brand: query.brand || null },
        resultCount: count,
      });
    }

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

    // VIEW_PRODUCT is deduplicated inside behaviorService, so a refresh or a
    // second tab does not drown the signal in copies of the same event.
    if (options.viewer) {
      await behaviorService.track({
        userId: options.viewer.userId || null,
        sessionId: options.viewer.sessionId || null,
        behaviorType: "VIEW_PRODUCT",
        productId: product.id,
        categoryId: product.categoryId || null,
      });
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

  // Resolve which definition a submitted spec belongs to.
  //
  // Priority: an explicit `definitionId` (the admin picked from the category's
  // existing list) beats a name lookup. That path matters — resolving by name
  // alone is how "RAM", "Bo nho RAM" and "Memory" end up as three definitions
  // for the same thing, which then breaks both filtering and AI comparison.
  //
  // An EXISTING definition's dataType always wins over anything in the payload:
  // a single product edit must not silently re-type a field shared by the whole
  // category.
  async resolveSpecificationDefinition(categoryId, specification, transaction) {
    if (specification.definitionId) {
      const existing = await productRepository.findDefinitionById(specification.definitionId, { transaction });

      if (!existing) {
        throw new AppError(`Specification definition not found: ${specification.definitionId}`, 404);
      }

      if (existing.categoryId !== categoryId) {
        throw new AppError(`Specification "${existing.name}" belongs to another category`, 409);
      }

      return existing;
    }

    const key = slugify(specification.key || specification.name, "spec");
    const existing = await productRepository.findDefinitionByKey(categoryId, key, { transaction });

    if (existing) {
      return existing;
    }

    // First time this category sees the field: create it, inferring the type
    // from the value unless the caller stated one. Inference is a convenience —
    // the admin can correct it later through the definition API.
    const rawValue = specification.value !== undefined ? specification.value : specification.valueText;
    const unit = specification.unit || null;
    const dataType = specification.dataType || inferDataType(rawValue, unit);

    return productRepository.createDefinition(
      {
        categoryId,
        key,
        name: specification.name,
        dataType,
        unit,
        isFilterable: specification.isFilterable ?? dataType === "NUMBER",
        isComparable: specification.isComparable ?? true,
        sortOrder: specification.sortOrder || 0,
      },
      { transaction },
    );
  }

  async replaceProductSpecifications(productId, categoryId, specifications = [], transaction) {
    await productRepository.destroySpecificationsByProduct(productId, { transaction });

    const submitted = specifications.filter((specification) => {
      const rawValue = specification.value !== undefined ? specification.value : specification.valueText;
      return specification.name && rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "";
    });

    for (const specification of submitted) {
      const definition = await this.resolveSpecificationDefinition(categoryId, specification, transaction);
      const rawValue = specification.value !== undefined ? specification.value : specification.valueText;

      // When a payload carries both, `value` is the measurable quantity and
      // `valueText` is the prose to display. Sending only one keeps the old
      // behaviour, so the existing admin form is unaffected.
      const displayText =
        specification.valueText !== undefined && specification.valueText !== null
          ? String(specification.valueText)
          : null;

      let columns;
      try {
        columns = buildSpecValue(rawValue, definition.dataType, definition.unit, displayText);
      } catch (error) {
        if (error instanceof SpecValueError) {
          // Refuse rather than storing the text and leaving the typed column
          // NULL: a NULL here is invisible until the product silently drops out
          // of a filter or an AI comparison.
          throw new AppError(
            `Specification "${definition.name}" expects ${definition.dataType}` +
              `${definition.unit ? ` (${definition.unit})` : ""}: ${error.message}`,
            400,
          );
        }
        throw error;
      }

      await productRepository.createSpecification(
        {
          productId,
          specificationDefinitionId: definition.id,
          ...columns,
        },
        { transaction },
      );
    }
  }

  // ── Specification definitions (admin) ─────────────────────────────────────

  async getDefinitionsByCategory(categoryId) {
    const category = await productRepository.findCategoryById(categoryId);

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    return productRepository.findDefinitionsByCategory(categoryId);
  }

  async createSpecificationDefinition(categoryId, payload) {
    const category = await productRepository.findCategoryById(categoryId);

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    const key = slugify(payload.key || payload.name, "spec");
    const clash = await productRepository.findDefinitionByKey(categoryId, key);

    if (clash) {
      throw new AppError(`Specification "${clash.name}" already exists in this category`, 409);
    }

    return productRepository.createDefinition({
      categoryId,
      key,
      name: payload.name,
      dataType: payload.dataType || "STRING",
      unit: payload.unit || null,
      isFilterable: payload.isFilterable ?? false,
      isComparable: payload.isComparable ?? true,
      sortOrder: payload.sortOrder || 0,
    });
  }

  // Changing `dataType` is the risky edit: rows already stored under the old
  // type have to move to a different column. Every value is re-parsed inside
  // one transaction, and the whole change is refused if any of them cannot be
  // converted — a half-migrated definition is worse than a rejected request.
  async updateSpecificationDefinition(id, payload) {
    const transaction = await productRepository.beginTransaction();

    try {
      const definition = await productRepository.findDefinitionById(id, { transaction });

      if (!definition) {
        throw new AppError("Specification definition not found", 404);
      }

      const changes = {};

      if (payload.name !== undefined) {
        changes.name = payload.name;
      }

      if (payload.key !== undefined || payload.name !== undefined) {
        const key = slugify(payload.key || payload.name || definition.name, "spec");

        if (key !== definition.key) {
          const clash = await productRepository.findDefinitionByKey(definition.categoryId, key, {
            excludeId: definition.id,
            transaction,
          });

          if (clash) {
            throw new AppError(`Specification "${clash.name}" already uses this key`, 409);
          }

          changes.key = key;
        }
      }

      ["unit", "isFilterable", "isComparable", "sortOrder"].forEach((field) => {
        if (payload[field] !== undefined) {
          changes[field] = payload[field];
        }
      });

      const nextUnit = changes.unit !== undefined ? changes.unit : definition.unit;
      const retypeTo = payload.dataType && payload.dataType !== definition.dataType ? payload.dataType : null;

      if (retypeTo) {
        changes.dataType = retypeTo;

        const rows = await productRepository.findSpecificationsByDefinition(definition.id, { transaction });

        for (const row of rows) {
          // valueText is written for every type, so it is the reliable source
          // to re-parse from.
          const source = row.valueText;

          let columns;
          try {
            columns = buildSpecValue(source, retypeTo, nextUnit);
          } catch (error) {
            if (error instanceof SpecValueError) {
              throw new AppError(
                `Cannot change "${definition.name}" to ${retypeTo}: ` +
                  `a stored value (${JSON.stringify(source)}) does not convert — ${error.message}. ` +
                  `Fix that product's value first.`,
                409,
              );
            }
            throw error;
          }

          await productRepository.updateSpecification(row, columns, { transaction });
        }
      }

      await productRepository.updateDefinition(definition, changes, { transaction });
      await transaction.commit();

      return productRepository.findDefinitionById(definition.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteSpecificationDefinition(id) {
    const definition = await productRepository.findDefinitionById(id);

    if (!definition) {
      throw new AppError("Specification definition not found", 404);
    }

    const inUse = await productRepository.countSpecificationsByDefinition(definition.id);

    if (inUse > 0) {
      throw new AppError(
        `"${definition.name}" is used by ${inUse} product(s). Remove it from those products first.`,
        409,
      );
    }

    await productRepository.destroyDefinition(definition);

    return { id: definition.id };
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

      // An empty array means "the client sent no specifications", NOT "delete
      // every specification". A client that saves a product without having
      // loaded its specs first would otherwise wipe the whole spec sheet with no
      // error and no trace — which is exactly what the admin form did, because
      // `GET /admin/products` does not join specifications at all.
      //
      // Clearing every spec is still possible, it just has to be asked for.
      if (Array.isArray(data.specifications)) {
        const isClearRequest = data.specifications.length === 0;

        if (!isClearRequest || data.clearSpecifications === true) {
          await this.replaceProductSpecifications(product.id, data.categoryId ?? product.categoryId, data.specifications, transaction);
        }
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

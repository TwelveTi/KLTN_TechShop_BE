const db = require("../../models");
const productsData = require("../data/products.data");

/**
 * Seeds Products, Images, Variants, Specifications, and Tags
 */
async function seedProducts(taxonomies, transaction) {
  console.log("  Seeding Products, Variants, Images, Specifications, and Tags...");

  const { categoryMap, brandMap, tagMap, specDefMap } = taxonomies;
  const productMap = new Map();
  const variantMap = new Map(); // SKU -> variant object

  for (const item of productsData) {
    const category = categoryMap.get(item.categoryKey);
    const brand = brandMap.get(item.brandKey);

    if (!category || !brand) {
      console.warn(`    Warning: Skipping product ${item.name} - missing category/brand.`);
      continue;
    }

    const product = await db.Product.create(
      {
        categoryId: category.id,
        brandId: brand.id,
        name: item.name,
        slug: item.slug,
        sku: item.sku || null,
        shortDescription: item.shortDescription || null,
        description: item.description || null,
        basePrice: item.basePrice,
        salePrice: item.salePrice || null,
        stockQuantity: item.stockQuantity || 0,
        soldCount: item.soldCount || 0,
        viewCount: item.viewCount || 0,
        averageRating: item.averageRating || 0,
        reviewCount: item.reviewCount || 0,
        status: item.status || "ACTIVE",
        isFeatured: item.isFeatured || false,
        publishedAt: item.publishedAt || (item.status === "ACTIVE" ? new Date() : null),
      },
      { transaction },
    );

    productMap.set(item.key, product);

    // 1. Product Variants
    if (Array.isArray(item.variants) && item.variants.length > 0) {
      for (const v of item.variants) {
        const variant = await db.ProductVariant.create(
          {
            productId: product.id,
            sku: v.sku,
            variantName: v.variantName,
            attributes: v.attributes || null,
            price: v.price || item.basePrice,
            salePrice: v.salePrice !== undefined ? v.salePrice : item.salePrice,
            stockQuantity: v.stockQuantity !== undefined ? v.stockQuantity : item.stockQuantity,
            isDefault: v.isDefault || false,
            status: v.status || "ACTIVE",
          },
          { transaction },
        );
        variantMap.set(v.sku, variant);
      }
    }

    // 2. Product Images
    if (Array.isArray(item.images) && item.images.length > 0) {
      for (let i = 0; i < item.images.length; i++) {
        const img = item.images[i];
        await db.ProductImage.create(
          {
            productId: product.id,
            variantId: null,
            imageUrl: img.imageUrl,
            altText: img.altText || item.name,
            isPrimary: img.isPrimary !== undefined ? img.isPrimary : i === 0,
            sortOrder: img.sortOrder !== undefined ? img.sortOrder : i,
          },
          { transaction },
        );
      }
    }

    // 3. Product Specifications
    //
    // Every skip is reported. This used to fail silently: a product whose
    // `categoryKey` had no definitions simply got no specifications, the seed
    // printed a cheerful success line, and the gap only surfaced much later as
    // a product missing from every spec filter. A seed that quietly drops data
    // is worse than one that fails.
    if (Array.isArray(item.specifications) && item.specifications.length > 0) {
      const categorySpecs = specDefMap.get(item.categoryKey);

      if (!categorySpecs) {
        console.warn(
          `    Warning: ${item.key} declares ${item.specifications.length} specifications but ` +
            `category "${item.categoryKey}" has no definitions — none were stored.`,
        );
      } else {
        for (const spec of item.specifications) {
          const def = categorySpecs.get(spec.key);

          if (!def) {
            console.warn(
              `    Warning: ${item.key} — no "${spec.key}" definition under "${item.categoryKey}", skipped.`,
            );
            continue;
          }

          await db.ProductSpecification.create(
            {
              productId: product.id,
              specificationDefinitionId: def.id,
              valueText: spec.valueText,
              // `??` not `||`: a BOOLEAN spec that is legitimately `false`
              // ("Không áp dụng" for ANC) would otherwise be stored as NULL,
              // which reads as "unknown" instead of "no".
              valueNumber: spec.valueNumber ?? null,
              valueBoolean: spec.valueBoolean ?? null,
              valueJson: spec.valueJson ?? null,
            },
            { transaction },
          );
        }
      }
    }

    // 4. Product Tags
    if (Array.isArray(item.tagSlugs) && item.tagSlugs.length > 0) {
      for (const tagSlug of item.tagSlugs) {
        const tag = tagMap.get(tagSlug);
        if (tag) {
          await db.ProductTag.create(
            {
              productId: product.id,
              tagId: tag.id,
            },
            { transaction },
          );
        }
      }
    }
  }

  console.log(`    Created ${productMap.size} Products with Images, Variants, Specifications, and Tags.`);
  return { productMap, variantMap };
}

module.exports = { seedProducts };

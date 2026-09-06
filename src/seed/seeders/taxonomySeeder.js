const db = require("../../models");
const categoriesData = require("../data/categories.data");
const brandsData = require("../data/brands.data");
const tagsData = require("../data/tags.data");
const specDefinitionsData = require("../data/specs.data");

/**
 * Seeds Categories (Hierarchical), Brands, Tags, and SpecificationDefinitions
 */
async function seedTaxonomy(transaction) {
  console.log("  Seeding Taxonomy (Categories, Brands, Tags, Specification Definitions)...");

  const categoryMap = new Map();
  const childKeysByParent = new Map(); // parent key -> [child keys]
  const brandMap = new Map();
  const tagMap = new Map();
  const specDefMap = new Map(); // key -> Map of specKey -> specDef

  // 1. Categories (Parent first, then children)
  for (const cat of categoriesData) {
    const parentCategory = await db.Category.create(
      {
        parentId: null,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || null,
        imageUrl: cat.imageUrl || null,
        isActive: cat.isActive !== undefined ? cat.isActive : true,
        sortOrder: cat.sortOrder || 0,
      },
      { transaction },
    );
    categoryMap.set(cat.key, parentCategory);

    childKeysByParent.set(cat.key, []);

    if (Array.isArray(cat.children) && cat.children.length > 0) {
      for (const child of cat.children) {
        const childCategory = await db.Category.create(
          {
            parentId: parentCategory.id,
            name: child.name,
            slug: child.slug,
            description: child.description || null,
            imageUrl: child.imageUrl || null,
            isActive: child.isActive !== undefined ? child.isActive : true,
            sortOrder: child.sortOrder || 0,
          },
          { transaction },
        );
        categoryMap.set(child.key, childCategory);
        childKeysByParent.get(cat.key).push(child.key);
      }
    }
  }

  // 2. Brands
  for (const brand of brandsData) {
    const createdBrand = await db.Brand.create(
      {
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl || null,
        description: brand.description || null,
        isActive: brand.isActive !== undefined ? brand.isActive : true,
      },
      { transaction },
    );
    brandMap.set(brand.key, createdBrand);
  }

  // 3. Tags
  for (const tag of tagsData) {
    const createdTag = await db.Tag.create(
      {
        name: tag.name,
        slug: tag.slug,
      },
      { transaction },
    );
    tagMap.set(tag.slug, createdTag);
  }

  // 4. Specification Definitions
  //
  // `specs.data.js` declares each definition once, on the parent ("laptop"), but
  // products live on the leaves ("macbook", "laptopGaming", "laptopOffice"). A
  // definition belongs to exactly one category — `specification_definitions` is
  // keyed by `(category_id, key)` and there is no inheritance in the schema — so
  // a leaf with no rows of its own is a leaf whose products can hold no specs at
  // all, and whose filters have nothing to offer.
  //
  // Rather than repeat eight laptop definitions three times in the data file,
  // the parent's set is copied down to each child here. Writing them out by hand
  // would mean three places to edit every time a spec changes, and two of them
  // would eventually be forgotten.
  for (const spec of specDefinitionsData) {
    const targetKeys = [spec.categoryKey, ...(childKeysByParent.get(spec.categoryKey) || [])];

    for (const categoryKey of targetKeys) {
      const category = categoryMap.get(categoryKey);
      if (!category) continue;

      const specDef = await db.SpecificationDefinition.create(
        {
          categoryId: category.id,
          name: spec.name,
          key: spec.key,
          dataType: spec.dataType || "STRING",
          unit: spec.unit || null,
          isFilterable: spec.isFilterable || false,
          isComparable: spec.isComparable || false,
          sortOrder: spec.sortOrder || 0,
        },
        { transaction },
      );

      if (!specDefMap.has(categoryKey)) {
        specDefMap.set(categoryKey, new Map());
      }
      specDefMap.get(categoryKey).set(spec.key, specDef);
    }
  }

  console.log(`    Created ${categoryMap.size} Categories, ${brandMap.size} Brands, ${tagMap.size} Tags, and Specification Definitions.`);

  return { categoryMap, brandMap, tagMap, specDefMap };
}

module.exports = { seedTaxonomy };

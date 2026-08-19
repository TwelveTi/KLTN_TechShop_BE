const AppError = require("../utils/AppError");
const catalogRepository = require("../repositories/catalogRepository");

// The public catalog taxonomy.
//
// Every entry carries `productCount`, because the storefront's category pills
// and brand filters show one. Before this endpoint existed the frontend fetched
// `/products?limit=100` and derived the taxonomy client-side, which silently
// lost anything outside the first 100 products and recomputed on every visit.
class CatalogService {
  // The GROUP BY rows come back as { categoryId, total } with `total` a string
  // from MySQL; fold them into a lookup of real numbers.
  toCountMap(rows, key) {
    return rows.reduce((map, row) => {
      map[row[key]] = Number(row.total) || 0;
      return map;
    }, {});
  }

  // A parent's count includes its children's products. A shopper clicking
  // "Laptop" expects everything beneath it, not just items filed directly on
  // the parent node.
  rollUpCounts(categories, directCounts) {
    const childrenOf = categories.reduce((map, category) => {
      const parent = category.parentId || "__root__";
      (map[parent] = map[parent] || []).push(category);
      return map;
    }, {});

    const totals = {};

    const walk = (category, seen) => {
      if (totals[category.id] !== undefined) {
        return totals[category.id];
      }

      // Guard against a cycle in parentId; without it a bad row would hang the
      // request instead of returning a slightly wrong number.
      if (seen.has(category.id)) {
        return directCounts[category.id] || 0;
      }
      seen.add(category.id);

      const own = directCounts[category.id] || 0;
      const fromChildren = (childrenOf[category.id] || []).reduce(
        (sum, child) => sum + walk(child, seen),
        0,
      );

      totals[category.id] = own + fromChildren;
      return totals[category.id];
    };

    categories.forEach((category) => walk(category, new Set()));

    return totals;
  }

  formatCategory(category, totals) {
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      productCount: totals[category.id] || 0,
    };
  }

  async getCategories({ tree = false } = {}) {
    const [categories, countRows, totalProducts] = await Promise.all([
      catalogRepository.findActiveCategories(),
      catalogRepository.countActiveProductsByCategory(),
      catalogRepository.countActiveProducts(),
    ]);

    const plain = categories.map((category) => category.get({ plain: true }));
    const totals = this.rollUpCounts(plain, this.toCountMap(countRows, "categoryId"));
    const items = plain.map((category) => this.formatCategory(category, totals));

    if (!tree) {
      return { items, totalProducts };
    }

    // Nested shape for a department menu. Children are attached to the parent
    // that is actually present in the active set; a category whose parent is
    // inactive surfaces at the root rather than disappearing.
    const byId = new Map(items.map((item) => [item.id, { ...item, children: [] }]));
    const roots = [];

    byId.forEach((item) => {
      const parent = item.parentId ? byId.get(item.parentId) : null;

      if (parent) {
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    });

    return { items: roots, totalProducts };
  }

  async getCategoryBySlug(slug) {
    const category = await catalogRepository.findActiveCategoryBySlug(slug);

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    const [categories, countRows] = await Promise.all([
      catalogRepository.findActiveCategories(),
      catalogRepository.countActiveProductsByCategory(),
    ]);

    const plain = categories.map((row) => row.get({ plain: true }));
    const totals = this.rollUpCounts(plain, this.toCountMap(countRows, "categoryId"));

    return this.formatCategory(category.get({ plain: true }), totals);
  }

  async getBrands() {
    const [brands, countRows] = await Promise.all([
      catalogRepository.findActiveBrands(),
      catalogRepository.countActiveProductsByBrand(),
    ]);

    const counts = this.toCountMap(countRows, "brandId");

    return {
      items: brands.map((brand) => ({
        ...brand.get({ plain: true }),
        productCount: counts[brand.id] || 0,
      })),
    };
  }

  async getBrandBySlug(slug) {
    const brand = await catalogRepository.findActiveBrandBySlug(slug);

    if (!brand) {
      throw new AppError("Brand not found", 404);
    }

    const counts = this.toCountMap(await catalogRepository.countActiveProductsByBrand(), "brandId");

    return { ...brand.get({ plain: true }), productCount: counts[brand.id] || 0 };
  }
}

module.exports = new CatalogService();

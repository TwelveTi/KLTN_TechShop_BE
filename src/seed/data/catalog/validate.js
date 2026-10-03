const categoriesData = require("../categories.data");
const brandsData = require("../brands.data");
const tagsData = require("../tags.data");
const specDefinitionsData = require("../specs.data");

/**
 * Kiểm tra tính toàn vẹn của catalogue trước khi seed.
 *
 * VÌ SAO CHẠY MỖI LẦN SEED, KHÔNG PHẢI MỘT BÀI TEST RIÊNG
 * -------------------------------------------------------
 * `productSeeder` xử lý dữ liệu sai bằng cách BỎ QUA và in cảnh báo: sai
 * `categoryKey` thì cả sản phẩm biến mất, sai `spec.key` thì riêng dòng thông
 * số đó biến mất. Với 27 sản phẩm thì cảnh báo còn đọc được trên màn hình. Với
 * 202 sản phẩm thì một dòng cảnh báo lẫn giữa hàng trăm dòng log là không ai
 * thấy, và lỗi chỉ lộ ra nhiều tuần sau dưới dạng "sao sản phẩm này không có
 * trong bộ lọc". Ném lỗi ngay tại đây đắt hơn một lần và rẻ hơn về sau.
 */

const LEAF_CATEGORIES = new Set();
const ALL_CATEGORIES = new Set();
categoriesData.forEach((parent) => {
  ALL_CATEGORIES.add(parent.key);
  const children = parent.children || [];
  children.forEach((child) => {
    ALL_CATEGORIES.add(child.key);
    LEAF_CATEGORIES.add(child.key);
  });
  // Một danh mục cha không có con thì bản thân nó là lá.
  if (children.length === 0) {
    LEAF_CATEGORIES.add(parent.key);
  }
});

const BRAND_KEYS = new Set(brandsData.map((brand) => brand.key));
const TAG_SLUGS = new Set(tagsData.map((tag) => tag.slug));

// Tập thông số hợp lệ của mỗi danh mục: khai trực tiếp trên nó, cộng thêm phần
// `taxonomySeeder` chép xuống từ danh mục cha.
const parentOfLeaf = new Map();
categoriesData.forEach((parent) => {
  (parent.children || []).forEach((child) => parentOfLeaf.set(child.key, parent.key));
});

const specKeysByCategory = {};
specDefinitionsData.forEach((def) => {
  (specKeysByCategory[def.categoryKey] = specKeysByCategory[def.categoryKey] || new Set()).add(def.key);
});

function allowedSpecKeys(categoryKey) {
  const own = specKeysByCategory[categoryKey] || new Set();
  const parent = parentOfLeaf.get(categoryKey);
  const inherited = parent ? specKeysByCategory[parent] || new Set() : new Set();
  return new Set([...own, ...inherited]);
}

// Thông số mà khuôn mô tả trong `buildFamilyProducts.js` đọc tới. Thiếu một cái
// là câu mô tả in ra chữ "undefined" và chữ đó đi thẳng vào chunk RAG.
const REQUIRED_SPECS = {
  laptopGaming: ["cpu", "ram", "storage", "gpu", "screen", "weight", "battery", "os"],
  laptopOffice: ["cpu", "ram", "storage", "gpu", "screen", "weight", "battery", "os"],
  laptopCreator: ["cpu", "ram", "storage", "gpu", "screen", "weight", "battery", "os"],
  macbook: ["cpu", "ram", "storage", "gpu", "screen", "weight", "battery", "os"],
  smartphone: ["screen", "chipset", "ram", "storage", "cameraRear", "cameraFront", "battery", "os"],
  smartphoneMid: ["screen", "chipset", "ram", "storage", "cameraRear", "cameraFront", "battery", "os"],
  tablet: ["screen", "chipset", "ram", "storage", "cameraRear", "cameraFront", "battery", "os"],
  headphone: ["driverSize", "batteryLife", "bluetoothVersion", "ancSupport", "waterproofRating"],
  speaker: ["driverSize", "batteryLife", "bluetoothVersion", "ancSupport", "waterproofRating"],
  smartwatch: ["caseSize", "screenType", "batteryLife", "waterResistance", "healthFeatures"],
  monitor: ["panelType", "resolution", "refreshRate", "screenSize", "brightness", "connectivity"],
  peripheral: ["panelType", "resolution", "refreshRate", "weight", "batteryLife", "connectivity"],
  charging: ["power", "portCount", "connectivity"],
  storage: ["capacity", "readSpeed", "interface", "connectivity"],
};

function validateFamilies(families) {
  const problems = [];
  const seenKeys = new Set();

  families.forEach((family) => {
    const where = `${family.key || "(thiếu key)"}`;

    if (!family.key || /[^A-Za-z0-9]/.test(family.key)) {
      problems.push(`${where}: key phải là chữ và số liền nhau, không dấu cách`);
    }
    if (seenKeys.has(family.key)) {
      problems.push(`${where}: key bị trùng`);
    }
    seenKeys.add(family.key);

    if (!LEAF_CATEGORIES.has(family.cat)) {
      problems.push(`${where}: "${family.cat}" không phải danh mục lá`);
    }
    if (!BRAND_KEYS.has(family.brand)) {
      problems.push(`${where}: không có thương hiệu "${family.brand}"`);
    }

    (family.tags || []).forEach((tag) => {
      if (!TAG_SLUGS.has(tag)) {
        problems.push(`${where}: không có tag "${tag}"`);
      }
    });

    if (family.sale && family.sale >= family.price) {
      problems.push(`${where}: giá khuyến mãi ${family.sale} không thấp hơn giá gốc ${family.price}`);
    }

    const variantCount = (family.variants || []).length || 1;
    if (family.stock < variantCount) {
      problems.push(`${where}: tồn kho ${family.stock} ít hơn số biến thể ${variantCount}`);
    }

    // Mọi biến thể phải ra giá dương sau khi cộng `delta`, kể cả delta âm.
    (family.variants || []).forEach((variant) => {
      if (family.price + (variant.delta || 0) <= 0) {
        problems.push(`${where}: biến thể "${variant.label}" có giá không dương`);
      }
    });

    const allowed = allowedSpecKeys(family.cat);
    Object.keys(family.specs || {}).forEach((key) => {
      if (!allowed.has(key)) {
        problems.push(`${where}: thông số "${key}" không có định nghĩa trong "${family.cat}"`);
      }
    });

    (REQUIRED_SPECS[family.cat] || []).forEach((key) => {
      if (family.specs?.[key] === undefined) {
        problems.push(`${where}: thiếu thông số bắt buộc "${key}"`);
      }
    });
  });

  return problems;
}

// Chạy trên toàn bộ danh sách sản phẩm cuối cùng, gồm cả 27 bản viết tay: khoá,
// slug và SKU phải là duy nhất trên cả hai nguồn chứ không riêng từng nguồn.
function validateProducts(products) {
  const problems = [];
  const seen = { key: new Map(), slug: new Map(), sku: new Map() };

  const claim = (field, value, owner) => {
    if (value === null || value === undefined) return;
    const previous = seen[field].get(value);
    if (previous) {
      problems.push(`${field} "${value}" dùng ở cả ${previous} và ${owner}`);
      return;
    }
    seen[field].set(value, owner);
  };

  products.forEach((product) => {
    claim("key", product.key, product.key);
    claim("slug", product.slug, product.key);
    claim("sku", product.sku, product.key);

    (product.variants || []).forEach((variant) => claim("sku", variant.sku, `${product.key}/biến thể`));

    // Trang chi tiết hiện `stockQuantity` của SẢN PHẨM nhưng lại bán theo biến
    // thể, nên hai con số lệch nhau là người mua đọc một đằng mua được một nẻo.
    const variants = product.variants || [];
    if (variants.length > 0) {
      const tongBienThe = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
      if (tongBienThe !== product.stockQuantity) {
        problems.push(
          `${product.key}: tồn kho sản phẩm ${product.stockQuantity} nhưng các biến thể cộng lại ${tongBienThe}`,
        );
      }
    }
  });

  return problems;
}

function assertValid(families, products) {
  const problems = [...validateFamilies(families), ...validateProducts(products)];

  if (problems.length > 0) {
    throw new Error(`Catalogue có ${problems.length} lỗi:\n  - ${problems.join("\n  - ")}`);
  }
}

module.exports = { assertValid, validateFamilies, validateProducts };

const categoriesData = require("./categories.data");
const specDefinitionsData = require("./specs.data");

/**
 * Bộ dựng sản phẩm cho phần catalogue mở rộng.
 *
 * VÌ SAO TỒN TẠI
 * --------------
 * 27 sản phẩm viết tay trong `products.data.js` không đủ để lõi đề tài hiện ra:
 * một câu hỏi tư vấn "laptop dưới 30 triệu" chỉ tìm được 2 máy, và rail gợi ý
 * K=10 chiếm 42% kho hàng nên mọi thước đo đều bão hoà. Nhưng viết tay 175 bản
 * ghi đầy đủ — mỗi bản ~50 dòng gồm mô tả, biến thể, ảnh, thông số — thì không
 * kịp mốc đóng băng code.
 *
 * Cách chia ở đây: **thông số và giá là dữ liệu thật, viết tay** trong
 * `catalogFamilies.data.js`; **phần khuôn mẫu lặp lại** — slug, SKU, mô tả dài,
 * ảnh, biến thể — do tệp này sinh ra. Nhờ vậy AI Advisor vẫn trích dẫn được RAM,
 * pin, giá đúng như thật, vì nó đọc `ProductSpecification` chứ không đọc văn xuôi.
 *
 * Mô tả dài được ghép từ chính các thông số đã khai, theo khuôn mẫu riêng của
 * từng danh mục. Nó KHÔNG thêm thông tin nào không có trong `specs` — một mô tả
 * bịa ra đặc điểm không đo được sẽ chui vào chunk RAG và thành nguồn để mô hình
 * dẫn lại.
 */

// Tra tên hiển thị của một thông số. `specs.data.js` khai định nghĩa trên danh
// mục cha cho laptop/điện thoại/âm thanh rồi `taxonomySeeder` chép xuống các lá,
// nên ở đây phải lần ngược lên cha đúng như vậy.
const parentOfLeaf = new Map();
categoriesData.forEach((parent) => {
  (parent.children || []).forEach((child) => parentOfLeaf.set(child.key, parent.key));
});

const specNameByCategory = specDefinitionsData.reduce((map, def) => {
  (map[def.categoryKey] = map[def.categoryKey] || {})[def.key] = def.name;
  return map;
}, {});

function specName(categoryKey, key) {
  const own = specNameByCategory[categoryKey]?.[key];
  if (own) return own;

  const parent = parentOfLeaf.get(categoryKey);
  const inherited = parent ? specNameByCategory[parent]?.[key] : null;

  if (!inherited) {
    throw new Error(`Không có định nghĩa thông số "${key}" cho danh mục "${categoryKey}"`);
  }
  return inherited;
}

// Bỏ dấu tiếng Việt rồi rút về chữ thường nối gạch. Không dùng `normalize("NFD")`
// một mình vì "đ" không phải chữ có dấu tách được, phải thay riêng.
function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

// Băm ổn định từ `key`: cùng một sản phẩm luôn chọn đúng một khuôn câu và đúng
// một tấm ảnh qua mọi lần seed. Seed mà đổi mỗi lần chạy thì không so sánh được
// hai lượt đo với nhau.
function hash(text) {
  let value = 0;
  for (let i = 0; i < text.length; i++) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0;
  }
  return value;
}

const pick = (list, key, salt = 0) => list[(hash(key) + salt) % list.length];

// ── Thông số ────────────────────────────────────────────────────────────────

// Giá trị trong bảng dòng sản phẩm có ba dạng:
//   "Intel Core i7"        → chỉ có text
//   [16, "16GB DDR5"]      → NUMBER, text hiển thị kèm
//   [true, "Có, 4 micro"]  → BOOLEAN
function buildSpecifications(family) {
  return Object.entries(family.specs).map(([key, raw]) => {
    const [value, text] = Array.isArray(raw) ? raw : [null, raw];

    return {
      key,
      name: specName(family.cat, key),
      valueText: text,
      ...(typeof value === "number" ? { valueNumber: value } : {}),
      ...(typeof value === "boolean" ? { valueBoolean: value } : {}),
    };
  });
}

// Lấy phần chữ của một thông số để nhét vào câu mô tả.
const specText = (family, key) => {
  const raw = family.specs[key];
  if (raw === undefined) return null;
  return Array.isArray(raw) ? raw[1] : raw;
};

// ── Mô tả dài ───────────────────────────────────────────────────────────────

// Mỗi danh mục có khuôn riêng vì thứ đáng nói ở mỗi nhóm hàng là khác nhau: với
// laptop là CPU và pin, với tai nghe là chống ồn và thời lượng, với màn hình là
// tấm nền và tần số quét. Dùng chung một khuôn sẽ ra 175 đoạn giống hệt nhau.
const DESCRIPTION_FRAMES = {
  laptop: [
    (f) => `Máy chạy ${specText(f, "cpu")} với ${specText(f, "ram")} và ${specText(f, "storage")}, đủ sức cho khối lượng công việc hằng ngày lẫn các tác vụ nặng hơn.`,
    (f) => `Cấu hình gồm ${specText(f, "cpu")}, ${specText(f, "ram")} và ${specText(f, "storage")}, xử lý mượt các tác vụ đa nhiệm nhiều cửa sổ.`,
  ],
  laptopSecond: [
    (f) => `Màn hình ${specText(f, "screen")}, đồ hoạ ${specText(f, "gpu")}. Trọng lượng ${specText(f, "weight")} và viên pin ${specText(f, "battery")} nên mang đi cả ngày không quá vất vả.`,
    (f) => `Phần hiển thị là ${specText(f, "screen")} đi cùng ${specText(f, "gpu")}. Máy nặng ${specText(f, "weight")}, pin ${specText(f, "battery")}, chạy ${specText(f, "os")}.`,
  ],
  smartphoneTablet: [
    (f) => `Màn hình ${specText(f, "screen")} chạy trên ${specText(f, "chipset")}, kèm ${specText(f, "ram")} và ${specText(f, "storage")}.`,
    (f) => `Máy dùng ${specText(f, "chipset")} với ${specText(f, "ram")}, bộ nhớ trong ${specText(f, "storage")}, màn hình ${specText(f, "screen")}.`,
  ],
  smartphoneTabletSecond: [
    (f) => `Camera sau ${specText(f, "cameraRear")}, camera trước ${specText(f, "cameraFront")}. Pin ${specText(f, "battery")} trên nền ${specText(f, "os")}.`,
    (f) => `Cụm camera sau ${specText(f, "cameraRear")} và camera selfie ${specText(f, "cameraFront")}. Dung lượng pin ${specText(f, "battery")}, hệ điều hành ${specText(f, "os")}.`,
  ],
  audio: [
    (f) => `Màng loa ${specText(f, "driverSize")} kết nối qua ${specText(f, "bluetoothVersion")}.`,
    (f) => `Thiết bị dùng ${specText(f, "driverSize")}, chuẩn kết nối ${specText(f, "bluetoothVersion")}.`,
  ],
  // Loa để bàn và tai nghe có dây khai `batteryLife` là 0 với chữ "Không dùng
  // pin". Dùng dấu hai chấm thay vì ghép thẳng vào câu, để một thông số vừa có
  // thể là "30 giờ" vừa có thể là "Không dùng pin" mà câu vẫn đọc trôi.
  audioSecond: [
    (f) => `Về pin: ${specText(f, "batteryLife")}. Chống ồn chủ động: ${specText(f, "ancSupport")}. Khả năng kháng nước ${specText(f, "waterproofRating")}.`,
    (f) => `Chuẩn kháng nước ${specText(f, "waterproofRating")}. Về pin: ${specText(f, "batteryLife")}. Về chống ồn chủ động: ${specText(f, "ancSupport")}.`,
  ],
  smartwatch: [
    (f) => `Khung viền ${specText(f, "caseSize")} với màn hình ${specText(f, "screenType")}.`,
    (f) => `Mặt đồng hồ ${specText(f, "caseSize")}, tấm nền ${specText(f, "screenType")}.`,
  ],
  smartwatchSecond: [
    (f) => `Pin ${specText(f, "batteryLife")}, chống nước ${specText(f, "waterResistance")}. Cảm biến sức khoẻ gồm ${specText(f, "healthFeatures")}.`,
    (f) => `Thời lượng pin ${specText(f, "batteryLife")} và chuẩn chống nước ${specText(f, "waterResistance")}. Theo dõi sức khoẻ qua ${specText(f, "healthFeatures")}.`,
  ],
  // Câu đầu gom kích thước, tấm nền, phân giải và tần số quét; câu sau chỉ còn
  // độ sáng và cổng. Chia như vậy để bất kỳ cặp khuôn nào ghép với nhau cũng
  // không nhắc lại cùng một thông số hai lần.
  monitor: [
    (f) => `Màn hình ${specText(f, "screenSize")} dùng tấm nền ${specText(f, "panelType")}, độ phân giải ${specText(f, "resolution")} ở tần số quét ${specText(f, "refreshRate")}.`,
    (f) => `Tấm nền ${specText(f, "panelType")} cỡ ${specText(f, "screenSize")}, phân giải ${specText(f, "resolution")}, quét ở ${specText(f, "refreshRate")}.`,
  ],
  monitorSecond: [
    (f) => `Độ sáng tối đa ${specText(f, "brightness")}. Kết nối qua ${specText(f, "connectivity")}.`,
    (f) => `Độ sáng ${specText(f, "brightness")}, cổng kết nối gồm ${specText(f, "connectivity")}.`,
  ],
  // Bàn phím khai `resolution` là "Không áp dụng" vì định nghĩa này dùng chung
  // cho cả chuột. Ghép nguyên văn vào câu thì ra "đi cùng Không áp dụng", nên
  // câu mô tả bỏ hẳn vế đó thay vì đọc ra một mệnh đề vô nghĩa.
  peripheral: [
    (f) => {
      const sensor = specText(f, "resolution");
      return sensor.startsWith("Không áp dụng")
        ? `Thiết bị dùng ${specText(f, "panelType")}.`
        : `Thiết bị dùng ${specText(f, "panelType")}, cảm biến ${sensor}.`;
    },
    (f) => {
      const sensor = specText(f, "resolution");
      return sensor.startsWith("Không áp dụng")
        ? `Cơ chế phím là ${specText(f, "panelType")}.`
        : `Cơ chế ${specText(f, "panelType")} đi cùng ${sensor}.`;
    },
  ],
  peripheralSecond: [
    (f) => `Nặng ${specText(f, "weight")}, kết nối ${specText(f, "connectivity")}. Về pin: ${specText(f, "batteryLife")}.`,
    (f) => `Trọng lượng ${specText(f, "weight")}. Về pin: ${specText(f, "batteryLife")}. Kết nối: ${specText(f, "connectivity")}.`,
  ],
  charging: [
    (f) => `Công suất tối đa ${specText(f, "power")} chia trên ${specText(f, "portCount")}.`,
    (f) => `Thiết bị cấp tối đa ${specText(f, "power")}, có ${specText(f, "portCount")}.`,
  ],
  chargingSecond: [
    (f) => `Cấu hình cổng: ${specText(f, "connectivity")}.`,
    (f) => `Bố trí cổng gồm ${specText(f, "connectivity")}.`,
  ],
  storage: [
    (f) => `Dung lượng ${specText(f, "capacity")}, tốc độ đọc tối đa ${specText(f, "readSpeed")}.`,
    (f) => `Ổ có ${specText(f, "capacity")} với tốc độ đọc lên tới ${specText(f, "readSpeed")}.`,
  ],
  storageSecond: [
    (f) => `Chuẩn kết nối ${specText(f, "interface")} qua ${specText(f, "connectivity")}.`,
    (f) => `Giao tiếp ${specText(f, "interface")}, cổng ${specText(f, "connectivity")}.`,
  ],
};

// Danh mục lá dùng khuôn của danh mục cha, trừ bốn lá phụ kiện có khuôn riêng.
const FRAME_GROUP = {
  laptopGaming: "laptop",
  laptopOffice: "laptop",
  laptopCreator: "laptop",
  macbook: "laptop",
  smartphone: "smartphoneTablet",
  smartphoneMid: "smartphoneTablet",
  tablet: "smartphoneTablet",
  headphone: "audio",
  speaker: "audio",
  smartwatch: "smartwatch",
  monitor: "monitor",
  peripheral: "peripheral",
  charging: "charging",
  storage: "storage",
};

const CLOSING_LINES = [
  "Hàng chính hãng, bảo hành theo chính sách của nhà sản xuất tại TechShop.",
  "Sản phẩm nhập chính hãng, đầy đủ hộp và phụ kiện đi kèm theo nhà sản xuất.",
  "Máy mới nguyên seal, kích hoạt bảo hành điện tử ngay khi nhận hàng.",
  "Hàng chính hãng phân phối tại Việt Nam, hỗ trợ đổi mới trong 7 ngày nếu lỗi nhà sản xuất.",
];

function buildDescription(family) {
  const group = FRAME_GROUP[family.cat];
  const first = pick(DESCRIPTION_FRAMES[group], family.key)(family);
  const second = pick(DESCRIPTION_FRAMES[`${group}Second`], family.key, 7)(family);
  const closing = pick(CLOSING_LINES, family.key, 3);

  return [family.blurb, first, second, closing].join(" ");
}

// ── Ảnh ─────────────────────────────────────────────────────────────────────

// Kho ảnh Unsplash theo danh mục. Ảnh minh hoạ chứ không phải ảnh thật của từng
// model — điều này được nói rõ trong README để không ai hiểu nhầm là ảnh gốc từ
// hãng.
const IMAGE_POOL = {
  laptopGaming: ["1603302576837-37561b2e2302", "1593642702821-c8da6771f0c6", "1587202372775-e229f172b9d7"],
  laptopOffice: ["1496181133206-80ce9b88a853", "1517336714731-489689fd1ca8", "1498050108023-c5249f4df085"],
  laptopCreator: ["1498050108023-c5249f4df085", "1531297484001-80022131f5a1", "1484788984921-03950022c9ef"],
  macbook: ["1517336714731-489689fd1ca8", "1541807084-5c52b6b3adef", "1611186871348-b1ce696e52c9"],
  smartphone: ["1592750475338-74b7b21085ab", "1511707171634-5f897ff02aa9", "1580910051074-3eb694886505"],
  smartphoneMid: ["1598327105666-5b89351aff97", "1510557880182-3d4d3cba35a5", "1567581935884-3349723552ca"],
  tablet: ["1544244015-0df4b3ffc6b0", "1561154464-82e9adf32764", "1585790050230-5dd28404ccb9"],
  headphone: ["1505740420928-5e560c06d30e", "1583394838336-acd977736f90", "1590658268037-6bf12165a8df"],
  speaker: ["1608043152269-423dbba4e7e1", "1545454675-3531b543be5d", "1589003077984-894e133dabab"],
  smartwatch: ["1523275335684-37898b6baf30", "1546868871-7041f2a55e12", "1508685096489-7aacd43bd3b1"],
  monitor: ["1527443224154-c4a3942d3acf", "1517336714731-489689fd1ca8", "1593640408182-31c70c8268f5"],
  peripheral: ["1587829741301-dc798b83add3", "1527814050087-3793815479db", "1618384887929-16ec33fab9ef"],
  charging: ["1583863788434-e58a36330cf0", "1585338447937-7082f8fc763d", "1606813907291-d86efa9b94db"],
  storage: ["1531492746076-161ca9bcad58", "1597872200969-2b65d56bd16b", "1618410320928-25228d811631"],
};

function buildImages(family) {
  const pool = IMAGE_POOL[family.cat];
  const offset = hash(family.key) % pool.length;

  // Hai ảnh mỗi sản phẩm: trang chi tiết có khung ảnh phụ, chỉ một ảnh thì khung
  // đó trống.
  return [0, 1].map((index) => {
    const photoId = pool[(offset + index) % pool.length];
    return {
      imageUrl: `https://images.unsplash.com/photo-${photoId}?w=800&auto=format&fit=crop&q=80`,
      altText: `${family.name} - ảnh ${index + 1}`,
      isPrimary: index === 0,
      sortOrder: index,
    };
  });
}

// ── Biến thể ────────────────────────────────────────────────────────────────

// `variants` trong bảng dòng sản phẩm chỉ khai nhãn và phần giá chênh; phần còn
// lại — SKU, chia tồn kho, đánh dấu mặc định — sinh ở đây.
function buildVariants(family) {
  const list = family.variants || [{ label: "Bản tiêu chuẩn", attrs: {} }];
  const perVariant = Math.max(Math.floor(family.stock / list.length), 1);

  return list.map((variant, index) => {
    const delta = variant.delta || 0;
    const price = family.price + delta;

    return {
      sku: `${family.key.toUpperCase().replace(/[^A-Z0-9]/g, "")}-V${index + 1}`,
      variantName: variant.label,
      attributes: variant.attrs || {},
      price,
      salePrice: family.sale ? family.sale + delta : null,
      // Biến thể cuối nhận phần dư, để tổng tồn kho các biến thể khớp đúng
      // `stockQuantity` của sản phẩm thay vì lệch vài cái.
      stockQuantity:
        index === list.length - 1 ? family.stock - perVariant * (list.length - 1) : perVariant,
      isDefault: index === 0,
      status: "ACTIVE",
    };
  });
}

// ── Lắp ráp ─────────────────────────────────────────────────────────────────

function buildFamilyProducts(families) {
  return families.map((family) => ({
    key: family.key,
    name: family.name,
    slug: slugify(family.name),
    sku: family.key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24),
    categoryKey: family.cat,
    brandKey: family.brand,
    shortDescription: family.blurb,
    description: buildDescription(family),
    basePrice: family.price,
    salePrice: family.sale || null,
    stockQuantity: family.stock,
    soldCount: family.sold,
    viewCount: family.views,
    status: "ACTIVE",
    isFeatured: Boolean(family.featured),
    publishedAt: new Date(family.published),
    images: buildImages(family),
    variants: buildVariants(family),
    specifications: buildSpecifications(family),
    tagSlugs: family.tags || [],
  }));
}

module.exports = { buildFamilyProducts, slugify, hash, pick };

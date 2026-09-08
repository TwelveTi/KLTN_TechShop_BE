const db = require("../../models");
const { createRandom } = require("../simulate/random");

/**
 * Seeds the behaviour log (`user_behaviors` + `search_histories`) for the real
 * demo accounts.
 *
 * **Vì sao cần seeder này.** `seed:catalog` trước đây tạo users, orders,
 * cart/wishlist và reviews nhưng KHÔNG tạo một dòng `user_behaviors` nào — chỉ
 * `src/seed/index.js` và `npm run simulate` mới tạo. Bộ gợi ý thì đọc tín hiệu
 * cá nhân từ đúng ba bảng mà seeder này ghi:
 *
 *   - `userPreference`    <- `user_preference_profiles` (dựng từ user_behaviors)
 *   - `purchaseHistory`   <- `user_behaviors` với behaviorType = 'PURCHASE'
 *   - `productSimilarity` <- các sản phẩm đã VIEW_PRODUCT
 *   - `searchHistory`     <- `search_histories`
 *
 * Không có ba bảng đó thì cả bốn thành phần trả rỗng, hybrid chỉ còn `popularity`
 * và **mọi tài khoản nhận đúng một danh sách giống nhau** — đo được ngày
 * 2026-09-07: 6/6 tài khoản thật cho danh sách y hệt, trong khi 6 tài khoản mô
 * phỏng cho 6 danh sách khác nhau.
 *
 * **Suy ra từ dữ liệu thật, không bịa song song.** Mỗi PURCHASE ở đây tương ứng
 * một dòng `order_items` có thật với đúng ngày của đơn hàng; ADD_TO_CART lấy từ
 * `cart_items`, FAVORITE từ `wishlist_items`, REVIEW từ `reviews`. Nếu sinh một
 * lịch sử hành vi độc lập với bảng đơn hàng thì hai nguồn sẽ nói khác nhau về
 * cùng một khách — đúng loại lỗi mà món nợ `review_count` vừa trả xong.
 *
 * Chỉ phần VIEW_PRODUCT là suy diễn: khách xem sản phẩm vài ngày trước khi mua,
 * và xem thêm vài sản phẩm cùng danh mục rồi không mua. Đó là phần cho
 * `productSimilarity` chất liệu để chạy.
 *
 * **Tất định.** Mọi lựa chọn rút từ `createRandom(SEED + index)` và mọi vòng lặp
 * đi theo `sku` đã sắp xếp, KHÔNG theo thứ tự UUID mà MySQL trả về — UUID sinh
 * lại mỗi lượt seed nên bất cứ chỗ nào dựa vào thứ tự đó sẽ cho kết quả khác
 * nhau giữa hai lượt (đúng lỗi đang làm `npm run simulate` không tái lập được,
 * xem `simulate/planner.js`).
 *
 * Mốc thời gian neo vào ngày của đơn hàng và review thật (tháng 7–8/2026). Bộ
 * gợi ý chỉ đọc hành vi trong `RECENCY_WINDOW_DAYS = 90` ngày, nên nếu chạy seed
 * ở thời điểm cách các mốc đó hơn 90 ngày thì tín hiệu sẽ hết hạn — cùng một
 * giới hạn mà `orders.data.js` đã có, không phải giới hạn mới.
 *
 * Chỉ 12 tài khoản `customerN` được seed. `admin`, `staff`, `unverifiedUser`,
 * `inactiveUser`, `blockedUser`, `googleUser` cố ý để trống: chúng là edge case
 * cho các luồng khác, và một tài khoản bị khoá có lịch sử mua sắm dày là dữ liệu
 * tự mâu thuẫn.
 */

const SEED = 2026;

// Số sản phẩm cùng danh mục mà khách xem rồi KHÔNG mua. Đây là tín hiệu chính
// của `productSimilarity`: không có nó thì thành phần này chỉ thấy đúng những
// sản phẩm đã mua, mà những sản phẩm đã mua thì bị loại khỏi kết quả gợi ý.
const COMPARE_VIEWS = 3;

const DAY = 86400000;

/**
 * Hai khách chưa mua gì. Không phải chỗ trống bị bỏ quên mà là một trạng thái
 * phải có trong bản demo: khách đã xem và tìm kiếm nhưng chưa chuyển đổi. Bộ gợi
 * ý phải cá nhân hoá được cho họ chỉ bằng view và search, không có PURCHASE nào.
 */
const BROWSE_ONLY = {
  customer11: ["Laptop Gaming", "Phụ Kiện & Màn Hình"],
  customer12: ["Âm Thanh & Tai Nghe", "Đồng Hồ Thông Minh"],
};

// Từ khoá tìm kiếm theo danh mục. Khoá là `categories.name` vì tên danh mục ổn
// định trong `categories.data.js`, còn id thì sinh lại mỗi lượt seed.
const KEYWORDS_BY_CATEGORY = {
  MacBook: ["macbook pro m3", "macbook air m2 giá bao nhiêu", "laptop apple cho lập trình"],
  "Laptop Văn Phòng & Doanh Nhân": ["laptop mỏng nhẹ pin lâu", "laptop văn phòng 20 triệu", "thinkpad x1 carbon"],
  "Laptop Gaming": ["laptop gaming rtx 4060", "legion pro 5 giá", "laptop chơi game tản nhiệt tốt"],
  "Laptops & Máy Tính": ["laptop cấu hình cao", "laptop 16gb ram"],
  "Smartphone Flagship": ["iphone 15 pro max", "galaxy s24 ultra", "điện thoại chụp ảnh đẹp"],
  "Điện Thoại & Tablet": ["điện thoại pin trâu", "điện thoại sạc nhanh"],
  "Máy Tính Bảng (Tablet)": ["ipad pro 12.9", "máy tính bảng vẽ có bút", "galaxy tab s9"],
  "Âm Thanh & Tai Nghe": ["tai nghe chống ồn", "airpods pro 2", "loa bluetooth nghe nhạc hay"],
  "Đồng Hồ Thông Minh": ["apple watch ultra 2", "galaxy watch 6 classic", "đồng hồ thể thao pin lâu"],
  "Phụ Kiện & Màn Hình": ["màn hình 2k 144hz", "chuột logitech công thái học", "bàn phím không dây gõ êm"],
  "Nhà Thông Minh (Smart Home)": ["thiết bị nhà thông minh"],
};

const uniqueBy = (rows, keyOf) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyOf(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Seeds behaviour events and search history for the 12 demo shoppers.
 *
 * Returns the ids of the users it touched so the caller can rebuild their
 * preference profiles AFTER the transaction commits — `behaviorService`
 * recomputes a profile with its own queries and cannot see uncommitted rows.
 */
async function seedBehaviors(userMap, productMap, transaction) {
  console.log("  Seeding UserBehaviors and SearchHistory for demo accounts...");

  // Thứ tự theo `sku` để không phụ thuộc thứ tự UUID (xem chú thích đầu file).
  const products = await db.Product.findAll({
    where: { status: "ACTIVE" },
    attributes: ["id", "sku", "name", "categoryId", "brandId"],
    order: [["sku", "ASC"]],
    raw: true,
    transaction,
  });

  const categories = await db.Category.findAll({ attributes: ["id", "name"], raw: true, transaction });
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const productsByCategory = new Map();
  for (const product of products) {
    if (!productsByCategory.has(product.categoryId)) productsByCategory.set(product.categoryId, []);
    productsByCategory.get(product.categoryId).push(product);
  }

  const customerKeys = [...Array(12)].map((_, i) => `customer${i + 1}`);
  const behaviorRows = [];
  const searchRows = [];
  const touchedUserIds = [];

  for (const [index, userKey] of customerKeys.entries()) {
    const user = userMap.get(userKey);
    if (!user) continue;

    const random = createRandom(SEED + index);
    touchedUserIds.push(user.id);

    const push = (behaviorType, product, occurredAt, metadata = null) =>
      behaviorRows.push({
        userId: user.id,
        sessionId: null,
        productId: product ? product.id : null,
        categoryId: product ? product.categoryId : null,
        behaviorType,
        metadata,
        occurredAt,
      });

    // ── Tín hiệu suy ra từ dữ liệu có thật ─────────────────────────────────
    const orderItems = await db.OrderItem.findAll({
      attributes: ["productId"],
      include: [
        {
          model: db.Order,
          as: "order",
          attributes: ["createdAt"],
          where: { userId: user.id },
          required: true,
        },
      ],
      transaction,
    });

    // Hai đơn cùng mốc thời gian thì phải có thứ tự xác định; không có nhánh
    // `sku` thì thứ tự rơi về thứ tự MySQL trả `order_items`, tức là phụ thuộc
    // UUID lần nữa.
    const purchases = uniqueBy(
      orderItems
        .map((row) => ({ product: productById.get(row.productId), at: new Date(row.order.createdAt) }))
        .filter((row) => row.product)
        .sort((a, b) => a.at - b.at || a.product.sku.localeCompare(b.product.sku)),
      (row) => row.product.id,
    );

    const touchedCategories = new Set();

    for (const { product, at } of purchases) {
      push("PURCHASE", product, at, { source: "seed:orders" });
      touchedCategories.add(product.categoryId);

      // Xem trước khi mua. Hai lần, cách nhau vài ngày: một lần tìm hiểu, một
      // lần quay lại chốt. Cách nhau > 30 phút nên không vi phạm quy tắc chống
      // trùng view của `behaviorService.isDuplicateView`.
      push("VIEW_PRODUCT", product, new Date(at.getTime() - 3 * DAY));
      push("VIEW_PRODUCT", product, new Date(at.getTime() - DAY));
    }

    const cartItems = await db.CartItem.findAll({
      attributes: ["productId", "createdAt"],
      include: [{ model: db.Cart, as: "cart", attributes: [], where: { userId: user.id }, required: true }],
      transaction,
    });

    for (const item of cartItems) {
      const product = productById.get(item.productId);
      if (!product) continue;
      push("ADD_TO_CART", product, new Date(item.createdAt), { source: "seed:cart" });
      push("VIEW_PRODUCT", product, new Date(new Date(item.createdAt).getTime() - DAY));
      touchedCategories.add(product.categoryId);
    }

    const wishlistItems = await db.WishlistItem.findAll({
      attributes: ["productId", "createdAt"],
      include: [
        { model: db.Wishlist, as: "wishlist", attributes: [], where: { userId: user.id }, required: true },
      ],
      transaction,
    });

    for (const item of wishlistItems) {
      const product = productById.get(item.productId);
      if (!product) continue;
      push("FAVORITE", product, new Date(item.createdAt), { source: "seed:wishlist" });
      touchedCategories.add(product.categoryId);
    }

    // Viết review là tín hiệu quan tâm mạnh (SIGNAL_WEIGHTS.REVIEW = 3) và đã
    // có sẵn 98 dòng thật sau lượt trả nợ review, nên dùng luôn.
    const reviews = await db.Review.findAll({
      where: { userId: user.id },
      attributes: ["productId", "reviewedAt"],
      transaction,
    });

    for (const review of reviews) {
      const product = productById.get(review.productId);
      if (!product) continue;
      push("REVIEW", product, new Date(review.reviewedAt), { source: "seed:reviews" });
      touchedCategories.add(product.categoryId);
    }

    // ── Khách chưa mua gì: chỉ xem và tìm kiếm ─────────────────────────────
    const browseCategoryNames = BROWSE_ONLY[userKey] || [];
    for (const name of browseCategoryNames) {
      const categoryId = categoryIdByName.get(name);
      if (categoryId) touchedCategories.add(categoryId);
    }

    // ── Xem rồi không mua, trong chính các danh mục khách đã quan tâm ──────
    const purchasedIds = new Set(purchases.map((row) => row.product.id));
    // Neo vào mốc muộn nhất khách đã hoạt động; khách chưa mua gì thì neo vào
    // cuối dòng thời gian của catalogue để hành vi vẫn nằm trong cửa sổ 90 ngày.
    const anchor = purchases.length > 0
      ? purchases[purchases.length - 1].at
      : new Date("2026-08-25T10:00:00Z");

    // Sắp theo TÊN danh mục, không phải theo id. `touchedCategories` chứa UUID
    // và UUID sinh lại mỗi lượt seed, nên `[...set].sort()` sẽ cho thứ tự khác
    // nhau giữa hai lượt — thứ tự đó lại quyết định `random.shuffle` được gọi
    // theo trình tự nào, tức là chọn ra sản phẩm khác. Đúng lỗi đang làm
    // `simulate/planner.js` không tái lập được; không lặp lại nó ở đây.
    const orderedCategoryIds = [...touchedCategories]
      .map((id) => ({ id, name: categoryNameById.get(id) || "" }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((row) => row.id);

    for (const categoryId of orderedCategoryIds) {
      const pool = (productsByCategory.get(categoryId) || []).filter((p) => !purchasedIds.has(p.id));
      if (pool.length === 0) continue;

      const picked = random.shuffle(pool).slice(0, COMPARE_VIEWS);
      for (const [n, product] of picked.entries()) {
        push("VIEW_PRODUCT", product, new Date(anchor.getTime() - (5 + n) * DAY), { compared: true });
      }

      // Khách chưa mua gì thì cho một FAVORITE để hồ sơ có khoảng giá — không có
      // PURCHASE/ADD_TO_CART/FAVORITE nào thì `recomputeProfile` để min/max/avg
      // price bằng null và `userPreference` mất phần lọc theo ngân sách.
      if (purchases.length === 0 && cartItems.length === 0 && picked.length > 0) {
        push("FAVORITE", picked[0], new Date(anchor.getTime() - 4 * DAY), { source: "seed:browse" });
      }
    }

    // ── Tìm kiếm ───────────────────────────────────────────────────────────
    // Cùng lý do: đi theo `orderedCategoryIds` (đã sắp theo tên) để tập từ khoá
    // và thứ tự tiêu thụ RNG không phụ thuộc UUID.
    const keywordPool = orderedCategoryIds.flatMap(
      (categoryId) => KEYWORDS_BY_CATEGORY[categoryNameById.get(categoryId)] || [],
    );

    const keywords = [...new Set(random.shuffle(keywordPool))].slice(0, 4);

    for (const [n, keyword] of keywords.entries()) {
      const searchedAt = new Date(anchor.getTime() - (6 + n * 2) * DAY);
      searchRows.push({
        userId: user.id,
        sessionId: null,
        keyword,
        categoryId: null,
        productId: null,
        filters: null,
        resultCount: random.int(3, 18),
        searchedAt,
      });
      // Dòng SEARCH trong `user_behaviors` là thứ `recomputeProfile` đếm; dòng
      // trong `search_histories` là thứ thành phần `searchHistory` đọc. Cần cả
      // hai, và ở runtime `behaviorService.recordSearch` cũng ghi cả hai.
      behaviorRows.push({
        userId: user.id,
        sessionId: null,
        productId: null,
        categoryId: null,
        behaviorType: "SEARCH",
        metadata: { keyword },
        occurredAt: searchedAt,
      });
    }
  }

  await db.UserBehavior.bulkCreate(behaviorRows, { transaction });
  await db.SearchHistory.bulkCreate(searchRows, { transaction });

  const byType = behaviorRows.reduce((acc, row) => {
    acc[row.behaviorType] = (acc[row.behaviorType] || 0) + 1;
    return acc;
  }, {});

  console.log(
    `    Created ${behaviorRows.length} UserBehaviors for ${touchedUserIds.length} accounts ` +
      `(${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(" · ")}).`,
  );
  console.log(`    Created ${searchRows.length} SearchHistory rows.`);

  return { behaviorUserIds: touchedUserIds };
}

/**
 * Rebuilds `user_preference_profiles` through the production code path.
 *
 * Phải gọi SAU khi transaction commit: `behaviorService.recomputeProfile` chạy
 * truy vấn tổng hợp riêng của nó, không nhận transaction, nên gọi bên trong sẽ
 * đọc bảng chưa có dòng nào và ghi ra hồ sơ rỗng.
 *
 * Dùng lại đúng hàm mà app gọi, không tự viết công thức hồ sơ ở đây — nếu
 * `SIGNAL_WEIGHTS` hay `PROFILE_WINDOW_DAYS` đổi thì dữ liệu seed đổi theo, chứ
 * không âm thầm lệch khỏi thứ runtime tính ra.
 */
async function buildPreferenceProfiles(userIds) {
  // require tại đây, không ở đầu file: behaviorService kéo theo cả tầng service
  // và chỉ cần thiết cho bước sau commit.
  const behaviorService = require("../../services/behaviorService");

  let built = 0;
  for (const userId of userIds) {
    await behaviorService.recomputeProfile(userId);
    built += 1;
  }

  console.log(`    Rebuilt ${built} UserPreferenceProfiles via behaviorService.recomputeProfile().`);
  return built;
}

module.exports = { seedBehaviors, buildPreferenceProfiles };

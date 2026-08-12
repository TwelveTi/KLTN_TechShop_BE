require("dotenv").config();

const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const db = require("../models");

const PASSWORD = "TechShop@123";
const NOW = new Date();
const daysAgo = (days) => new Date(NOW.getTime() - days * 86400000);
const money = (value) => Number(value).toFixed(2);
const pick = (items, index) => items[index % items.length];

const users = [
  ["admin", "admin@techshop.dev", "TechShop Admin", "0901000001", "ADMIN", "ACTIVE", true, 1],
  ["staff", "linh.staff@techshop.dev", "Nguyen Gia Linh", "0901000002", "ADMIN", "ACTIVE", true, 3],
  ["minh", "minh.customer@techshop.dev", "Tran Hoang Minh", "0901000011", "CUSTOMER", "ACTIVE", true, 2],
  ["anh", "anh.customer@techshop.dev", "Le Mai Anh", "0901000012", "CUSTOMER", "ACTIVE", true, 7],
  ["khoa", "khoa.customer@techshop.dev", "Pham Dang Khoa", "0901000013", "CUSTOMER", "ACTIVE", false, null],
  ["vy", "vy.customer@techshop.dev", "Do Tuong Vy", "0901000014", "CUSTOMER", "ACTIVE", true, 11],
  ["long", "long.customer@techshop.dev", "Hoang Bao Long", "0901000015", "CUSTOMER", "INACTIVE", true, 24],
  ["thao", "thao.customer@techshop.dev", "Bui Minh Thao", "0901000016", "CUSTOMER", "ACTIVE", false, null],
  ["nam", "nam.customer@techshop.dev", "Vo Quoc Nam", "0901000017", "CUSTOMER", "BLOCKED", true, 42],
  ["ha", "ha.customer@techshop.dev", "Dang Ngoc Ha", "0901000018", "CUSTOMER", "ACTIVE", true, 5],
  ["son", "son.customer@techshop.dev", "Nguyen Thai Son", "0901000019", "CUSTOMER", "ACTIVE", true, 14],
  ["nhi", "nhi.customer@techshop.dev", "Phan Yen Nhi", "0901000020", "CUSTOMER", "ACTIVE", false, null],
  ["tuan", "tuan.customer@techshop.dev", "Mai Anh Tuan", "0901000021", "CUSTOMER", "ACTIVE", true, 4],
  ["quyen", "quyen.customer@techshop.dev", "Huynh Bao Quyen", "0901000022", "CUSTOMER", "ACTIVE", true, 9],
  ["dat", "dat.customer@techshop.dev", "Lam Thanh Dat", "0901000023", "CUSTOMER", "INACTIVE", false, null],
  ["yen", "yen.customer@techshop.dev", "Truong Hai Yen", "0901000024", "CUSTOMER", "ACTIVE", true, 16],
  ["hieu", "hieu.customer@techshop.dev", "Cao Minh Hieu", "0901000025", "CUSTOMER", "ACTIVE", true, 8],
  ["my", "my.customer@techshop.dev", "Ngo Tra My", "0901000026", "CUSTOMER", "ACTIVE", false, null],
].map(([key, email, fullName, phone, role, status, verified, lastLoginDaysAgo]) => ({
  key, email, fullName, phone, role, status, verified, lastLoginDaysAgo,
}));

const categories = [
  ["Laptop", "seed-laptop", "Laptop van phong, gaming va sang tao noi dung."],
  ["Smartphone", "seed-smartphone", "Dien thoai thong minh moi nhat."],
  ["Tablet", "seed-tablet", "May tinh bang hoc tap, giai tri va lam viec."],
  ["Monitor", "seed-monitor", "Man hinh do hoa, gaming va van phong."],
  ["Audio", "seed-audio", "Tai nghe, loa va thiet bi am thanh."],
  ["Accessory", "seed-accessory", "Phu kien cong nghe hang ngay."],
  ["Networking", "seed-networking", "Router, mesh Wi-Fi va thiet bi mang."],
  ["Smart Home", "seed-smart-home", "Thiet bi nha thong minh."],
].map(([name, slug, description], index) => ({ name, slug, description, sortOrder: index + 1 }));

const brands = ["Apple", "Samsung", "Dell", "Asus", "Lenovo", "Sony", "Logitech", "TP-Link", "Xiaomi", "LG"]
  .map((name) => ({ name, slug: `seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, description: `${name} products for TechShop seed.` }));

const tags = ["Gaming", "Work From Home", "Creator", "Student", "Best Seller", "New Arrival", "Budget", "Premium", "Portable", "Smart Living"]
  .map((name) => ({ name, slug: `seed-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` }));

const specByCategory = {
  "seed-laptop": [["CPU", "cpu"], ["RAM", "ram"], ["Storage", "storage"], ["Display", "display"], ["Weight", "weight"]],
  "seed-smartphone": [["Chipset", "chipset"], ["RAM", "ram"], ["Storage", "storage"], ["Camera", "camera"], ["Battery", "battery"]],
  "seed-tablet": [["Chipset", "chipset"], ["Storage", "storage"], ["Display", "display"], ["Battery", "battery"], ["Pencil Support", "pencil_support"]],
  "seed-monitor": [["Size", "size"], ["Resolution", "resolution"], ["Refresh Rate", "refresh_rate"], ["Panel", "panel"], ["Ports", "ports"]],
  "seed-audio": [["Driver", "driver"], ["Connection", "connection"], ["Battery", "battery"], ["Noise Cancelling", "noise_cancelling"], ["Weight", "weight"]],
  "seed-accessory": [["Connection", "connection"], ["Compatibility", "compatibility"], ["Material", "material"], ["Battery", "battery"], ["Warranty", "warranty"]],
  "seed-networking": [["Wi-Fi Standard", "wifi_standard"], ["Speed", "speed"], ["Coverage", "coverage"], ["Ports", "ports"], ["Mesh Support", "mesh_support"]],
  "seed-smart-home": [["Protocol", "protocol"], ["Power", "power"], ["Compatibility", "compatibility"], ["App Control", "app_control"], ["Warranty", "warranty"]],
};

const products = [
  ["MacBook Air M3 13 inch 2026", "seed-macbook-air-m3-13", "seed-laptop", "seed-apple", 28990000, 26990000, 24, "ACTIVE", true, ["Apple M3", "16GB", "512GB SSD", "13.6 inch Liquid Retina", "1.24 kg"], ["Premium", "Portable"]],
  ["MacBook Pro M4 Pro 14 inch", "seed-macbook-pro-m4-pro-14", "seed-laptop", "seed-apple", 52990000, null, 8, "ACTIVE", true, ["Apple M4 Pro", "24GB", "1TB SSD", "14.2 inch Liquid Retina XDR", "1.6 kg"], ["Creator", "Premium"]],
  ["Dell XPS 13 Plus", "seed-dell-xps-13-plus", "seed-laptop", "seed-dell", 35990000, 32990000, 6, "ACTIVE", false, ["Intel Core Ultra 7", "16GB", "1TB SSD", "13.4 inch OLED", "1.26 kg"], ["Work From Home", "Premium"]],
  ["Dell Inspiron 15 3530", "seed-dell-inspiron-15-3530", "seed-laptop", "seed-dell", 16990000, 14990000, 18, "ACTIVE", false, ["Intel Core i5", "16GB", "512GB SSD", "15.6 inch FHD", "1.65 kg"], ["Student", "Budget"]],
  ["Asus ROG Zephyrus G14", "seed-asus-rog-zephyrus-g14", "seed-laptop", "seed-asus", 44990000, 41990000, 4, "ACTIVE", true, ["AMD Ryzen 9", "32GB", "1TB SSD", "14 inch OLED 120Hz", "1.5 kg"], ["Gaming", "Creator"]],
  ["Asus Vivobook S 14 OLED", "seed-asus-vivobook-s-14-oled", "seed-laptop", "seed-asus", 22990000, 20990000, 13, "ACTIVE", false, ["Intel Core Ultra 5", "16GB", "512GB SSD", "14 inch OLED", "1.3 kg"], ["Student", "Portable"]],
  ["Lenovo ThinkPad X1 Carbon Gen 13", "seed-thinkpad-x1-carbon-gen-13", "seed-laptop", "seed-lenovo", 46990000, null, 3, "ACTIVE", false, ["Intel Core Ultra 7", "32GB", "1TB SSD", "14 inch 2.8K", "1.09 kg"], ["Work From Home", "Premium"]],
  ["Lenovo LOQ 15 Gaming", "seed-lenovo-loq-15-gaming", "seed-laptop", "seed-lenovo", 24990000, 21990000, 0, "OUT_OF_STOCK", false, ["AMD Ryzen 7", "16GB", "512GB SSD", "15.6 inch 144Hz", "2.4 kg"], ["Gaming", "Budget"]],
  ["iPhone 16 Pro 256GB", "seed-iphone-16-pro-256gb", "seed-smartphone", "seed-apple", 31990000, 29990000, 15, "ACTIVE", true, ["A18 Pro", "8GB", "256GB", "48MP Fusion", "3582 mAh"], ["Premium", "Best Seller"]],
  ["iPhone 16 128GB", "seed-iphone-16-128gb", "seed-smartphone", "seed-apple", 22990000, null, 22, "ACTIVE", true, ["A18", "8GB", "128GB", "48MP", "3561 mAh"], ["New Arrival", "Portable"]],
  ["Samsung Galaxy S26 Ultra", "seed-galaxy-s26-ultra", "seed-smartphone", "seed-samsung", 30990000, 28990000, 11, "ACTIVE", true, ["Snapdragon flagship", "12GB", "512GB", "200MP", "5000 mAh"], ["Premium", "Creator"]],
  ["Samsung Galaxy A56 5G", "seed-galaxy-a56-5g", "seed-smartphone", "seed-samsung", 10990000, 9990000, 31, "ACTIVE", false, ["Exynos 1580", "8GB", "256GB", "50MP", "5000 mAh"], ["Budget", "Student"]],
  ["Xiaomi 15 5G", "seed-xiaomi-15-5g", "seed-smartphone", "seed-xiaomi", 19990000, 18490000, 17, "ACTIVE", false, ["Snapdragon 8 Elite", "12GB", "256GB", "Leica 50MP", "5240 mAh"], ["New Arrival", "Best Seller"]],
  ["Xiaomi Redmi Note 15 Pro", "seed-redmi-note-15-pro", "seed-smartphone", "seed-xiaomi", 8990000, 7990000, 2, "ACTIVE", false, ["MediaTek Dimensity", "8GB", "256GB", "108MP", "5100 mAh"], ["Budget", "Student"]],
  ["iPad Air M3 11 inch", "seed-ipad-air-m3-11", "seed-tablet", "seed-apple", 16990000, 15990000, 14, "ACTIVE", true, ["Apple M3", "128GB", "11 inch Liquid Retina", "10 hours", "Apple Pencil Pro"], ["Creator", "Portable"]],
  ["iPad Pro M4 13 inch", "seed-ipad-pro-m4-13", "seed-tablet", "seed-apple", 33990000, null, 7, "ACTIVE", true, ["Apple M4", "256GB", "13 inch Ultra Retina XDR", "10 hours", "Apple Pencil Pro"], ["Premium", "Creator"]],
  ["Samsung Galaxy Tab S11", "seed-galaxy-tab-s11", "seed-tablet", "seed-samsung", 22990000, 20990000, 9, "ACTIVE", false, ["Snapdragon flagship", "256GB", "11 inch AMOLED", "8400 mAh", "S Pen"], ["Work From Home", "Creator"]],
  ["Lenovo Tab Plus 12", "seed-lenovo-tab-plus-12", "seed-tablet", "seed-lenovo", 7990000, 7290000, 19, "ACTIVE", false, ["MediaTek Helio", "128GB", "12 inch 2K", "8600 mAh", "Passive stylus"], ["Student", "Budget"]],
  ["LG UltraGear 27GR95QE OLED", "seed-lg-ultragear-27gr95qe-oled", "seed-monitor", "seed-lg", 21990000, 19990000, 5, "ACTIVE", true, ["27 inch", "QHD", "240Hz", "OLED", "HDMI 2.1, DisplayPort"], ["Gaming", "Premium"]],
  ["Dell UltraSharp U2724DE", "seed-dell-ultrasharp-u2724de", "seed-monitor", "seed-dell", 13990000, null, 12, "ACTIVE", false, ["27 inch", "QHD", "120Hz", "IPS Black", "USB-C, HDMI, DP"], ["Work From Home", "Creator"]],
  ["Asus ProArt PA279CRV", "seed-asus-proart-pa279crv", "seed-monitor", "seed-asus", 14990000, 13490000, 8, "ACTIVE", false, ["27 inch", "4K UHD", "60Hz", "IPS", "USB-C 96W, HDMI, DP"], ["Creator", "Premium"]],
  ["Samsung Odyssey G5 32", "seed-samsung-odyssey-g5-32", "seed-monitor", "seed-samsung", 8990000, 7990000, 0, "OUT_OF_STOCK", false, ["32 inch", "QHD", "165Hz", "VA", "HDMI, DisplayPort"], ["Gaming", "Budget"]],
  ["Apple AirPods Pro 3", "seed-airpods-pro-3", "seed-audio", "seed-apple", 6490000, 5990000, 27, "ACTIVE", true, ["Custom Apple driver", "Bluetooth", "30 hours with case", "Adaptive ANC", "5.3 g each"], ["Premium", "Portable"]],
  ["Sony WH-1000XM6", "seed-sony-wh-1000xm6", "seed-audio", "seed-sony", 8990000, 8290000, 10, "ACTIVE", true, ["40mm", "Bluetooth / 3.5mm", "30 hours", "HD ANC", "250 g"], ["Work From Home", "Premium"]],
  ["Sony WF-C700N", "seed-sony-wf-c700n", "seed-audio", "seed-sony", 2990000, 2490000, 25, "ACTIVE", false, ["5mm", "Bluetooth", "20 hours with case", "ANC", "4.6 g each"], ["Budget", "Portable"]],
  ["Samsung Galaxy Buds3 Pro", "seed-galaxy-buds3-pro", "seed-audio", "seed-samsung", 5490000, null, 16, "ACTIVE", false, ["Dual amplifier", "Bluetooth", "26 hours with case", "Adaptive ANC", "5.4 g each"], ["New Arrival", "Portable"]],
  ["Logitech MX Master 4", "seed-logitech-mx-master-4", "seed-accessory", "seed-logitech", 2890000, 2590000, 40, "ACTIVE", true, ["Bluetooth / USB receiver", "Windows, macOS, Linux", "Recycled plastic", "70 days", "24 months"], ["Work From Home", "Best Seller"]],
  ["Logitech MX Keys S", "seed-logitech-mx-keys-s", "seed-accessory", "seed-logitech", 2690000, 2390000, 33, "ACTIVE", false, ["Bluetooth / USB receiver", "Windows, macOS, iPadOS", "Aluminum top case", "10 days backlit", "24 months"], ["Work From Home", "Best Seller"]],
  ["Apple Magic Keyboard USB-C", "seed-apple-magic-keyboard-usb-c", "seed-accessory", "seed-apple", 3290000, null, 15, "ACTIVE", false, ["Bluetooth / USB-C", "macOS, iPadOS", "Aluminum", "1 month", "12 months"], ["Premium", "Portable"]],
  ["Samsung T9 Portable SSD 2TB", "seed-samsung-t9-portable-ssd-2tb", "seed-accessory", "seed-samsung", 4990000, 4490000, 21, "ACTIVE", false, ["USB-C 3.2 Gen 2x2", "Windows, macOS, Android", "Rubberized shell", "No battery", "36 months"], ["Creator", "Portable"]],
  ["TP-Link Deco BE65 Mesh Wi-Fi 7", "seed-tp-link-deco-be65", "seed-networking", "seed-tp-link", 11990000, 10990000, 9, "ACTIVE", true, ["Wi-Fi 7", "11Gbps tri-band", "Up to 700m2", "2.5GbE ports", "Yes"], ["Smart Living", "Premium"]],
  ["TP-Link Archer AX73", "seed-tp-link-archer-ax73", "seed-networking", "seed-tp-link", 3290000, 2890000, 23, "ACTIVE", false, ["Wi-Fi 6", "5400Mbps", "Large apartment", "Gigabit WAN/LAN", "OneMesh"], ["Budget", "Work From Home"]],
  ["Asus ROG Rapture GT-AX6000", "seed-asus-rog-gt-ax6000", "seed-networking", "seed-asus", 6990000, 6290000, 4, "ACTIVE", false, ["Wi-Fi 6", "6000Mbps", "Gaming house", "2.5GbE WAN/LAN", "AiMesh"], ["Gaming", "Premium"]],
  ["Xiaomi Mesh System AX3000", "seed-xiaomi-mesh-ax3000", "seed-networking", "seed-xiaomi", 2490000, 2190000, 18, "ACTIVE", false, ["Wi-Fi 6", "3000Mbps", "Up to 370m2", "Gigabit Ethernet", "Yes"], ["Budget", "Smart Living"]],
  ["Xiaomi Smart Camera C500 Pro", "seed-xiaomi-smart-camera-c500-pro", "seed-smart-home", "seed-xiaomi", 1490000, 1290000, 29, "ACTIVE", false, ["Wi-Fi", "USB-C", "Google Home, Alexa", "Mi Home", "12 months"], ["Smart Living", "Budget"]],
  ["Apple HomePod mini", "seed-apple-homepod-mini", "seed-smart-home", "seed-apple", 2990000, null, 6, "ACTIVE", false, ["Thread / Wi-Fi", "20W adapter", "HomeKit", "Home app", "12 months"], ["Smart Living", "Premium"]],
  ["Samsung SmartThings Station", "seed-samsung-smartthings-station", "seed-smart-home", "seed-samsung", 1990000, 1690000, 0, "OUT_OF_STOCK", false, ["Matter / Thread", "USB-C", "SmartThings", "SmartThings app", "12 months"], ["Smart Living", "New Arrival"]],
  ["LG Smart Monitor StandbyME Go", "seed-lg-standbyme-go", "seed-smart-home", "seed-lg", 19990000, 18490000, 3, "INACTIVE", false, ["Wi-Fi", "Built-in battery", "AirPlay, webOS", "LG ThinQ", "24 months"], ["Premium", "Smart Living"]],
  ["Asus Zenbook Duo OLED", "seed-asus-zenbook-duo-oled", "seed-laptop", "seed-asus", 42990000, 39990000, 5, "DRAFT", false, ["Intel Core Ultra 9", "32GB", "1TB SSD", "Dual 14 inch OLED", "1.65 kg"], ["Creator", "New Arrival"]],
  ["Sony LinkBuds Speaker", "seed-sony-linkbuds-speaker", "seed-audio", "seed-sony", 4490000, 3990000, 1, "ACTIVE", false, ["Full range driver", "Bluetooth", "25 hours", "No", "520 g"], ["Portable", "New Arrival"]],
];

const addresses = [
  ["minh.customer@techshop.dev", "Tran Hoang Minh", "0901000011", "Ho Chi Minh", "Quan 1", "Ben Nghe", "22 Le Thanh Ton"],
  ["anh.customer@techshop.dev", "Le Mai Anh", "0901000012", "Ha Noi", "Cau Giay", "Dich Vong", "18 Tran Thai Tong"],
  ["vy.customer@techshop.dev", "Do Tuong Vy", "0901000014", "Da Nang", "Hai Chau", "Phuoc Ninh", "55 Nguyen Van Linh"],
  ["ha.customer@techshop.dev", "Dang Ngoc Ha", "0901000018", "Can Tho", "Ninh Kieu", "An Phu", "09 Mau Than"],
  ["son.customer@techshop.dev", "Nguyen Thai Son", "0901000019", "Ho Chi Minh", "Thu Duc", "Linh Trung", "101 Vo Van Ngan"],
  ["tuan.customer@techshop.dev", "Mai Anh Tuan", "0901000021", "Ha Noi", "Dong Da", "Lang Ha", "12 Thai Ha"],
  ["quyen.customer@techshop.dev", "Huynh Bao Quyen", "0901000022", "Binh Duong", "Thu Dau Mot", "Phu Hoa", "88 Cach Mang Thang Tam"],
  ["yen.customer@techshop.dev", "Truong Hai Yen", "0901000024", "Hai Phong", "Ngo Quyen", "May To", "34 Lach Tray"],
  ["hieu.customer@techshop.dev", "Cao Minh Hieu", "0901000025", "Dong Nai", "Bien Hoa", "Tan Phong", "17 Dong Khoi"],
];

async function clearSeedData() {
  const seedUsers = await db.User.findAll({ where: { email: users.map((u) => u.email) }, paranoid: false, attributes: ["id"] });
  const userIds = seedUsers.map((u) => u.id);
  const seedProducts = await db.Product.findAll({ where: { slug: products.map((p) => p[1]) }, paranoid: false, attributes: ["id"] });
  const productIds = seedProducts.map((p) => p.id);
  const seedOrders = await db.Order.findAll({ where: { orderCode: { [Op.like]: "TS-SEED-%" } }, paranoid: false, attributes: ["id"] });
  const orderIds = seedOrders.map((o) => o.id);
  const seedCarts = await db.Cart.findAll({ where: { userId: userIds }, attributes: ["id"] });
  const cartIds = seedCarts.map((c) => c.id);
  const seedWishlists = await db.Wishlist.findAll({ where: { userId: userIds }, attributes: ["id"] });
  const wishlistIds = seedWishlists.map((w) => w.id);

  await db.sequelize.transaction(async (transaction) => {
    await db.SearchHistory.destroy({ where: { [Op.or]: [{ userId: userIds }, { productId: productIds }, { sessionId: { [Op.like]: "seed-session-%" } }] }, force: true, transaction });
    await db.UserBehavior.destroy({ where: { [Op.or]: [{ userId: userIds }, { productId: productIds }, { sessionId: { [Op.like]: "seed-session-%" } }] }, force: true, transaction });
    await db.UserPreferenceProfile.destroy({ where: { userId: userIds }, force: true, transaction });
    await db.Review.destroy({ where: { [Op.or]: [{ userId: userIds }, { productId: productIds }] }, force: true, transaction });
    await db.OrderStatusHistory.destroy({ where: { orderId: orderIds }, force: true, transaction });
    await db.OrderItem.destroy({ where: { orderId: orderIds }, force: true, transaction });
    await db.Payment.destroy({ where: { orderId: orderIds }, force: true, transaction });
    await db.Order.destroy({ where: { id: orderIds }, force: true, transaction });
    await db.CartItem.destroy({ where: { [Op.or]: [{ productId: productIds }, { cartId: cartIds }] }, force: true, transaction });
    await db.WishlistItem.destroy({ where: { [Op.or]: [{ productId: productIds }, { wishlistId: wishlistIds }] }, force: true, transaction });
    await db.ProductTag.destroy({ where: { productId: productIds }, force: true, transaction });
    await db.ProductSpecification.destroy({ where: { productId: productIds }, force: true, transaction });
    await db.ProductImage.destroy({ where: { productId: productIds }, force: true, transaction });
    await db.ProductVariant.destroy({ where: { productId: productIds }, force: true, transaction });
    await db.Product.destroy({ where: { slug: products.map((p) => p[1]) }, force: true, transaction });
    await db.SpecificationDefinition.destroy({ where: { categoryId: (await db.Category.findAll({ where: { slug: categories.map((c) => c.slug) }, paranoid: false, attributes: ["id"], transaction })).map((c) => c.id) }, force: true, transaction });
    await db.Tag.destroy({ where: { slug: tags.map((t) => t.slug) }, force: true, transaction });
    await db.UserAddress.destroy({ where: { userId: userIds }, force: true, transaction });
    await db.Cart.destroy({ where: { userId: userIds }, force: true, transaction });
    await db.Wishlist.destroy({ where: { userId: userIds }, force: true, transaction });
    await db.AuthProvider.destroy({ where: { userId: userIds }, force: true, transaction });
    await db.RefreshToken.destroy({ where: { userId: userIds }, force: true, transaction });
    await db.User.destroy({ where: { id: userIds }, force: true, transaction });
    await db.Brand.destroy({ where: { slug: brands.map((b) => b.slug) }, force: true, transaction });
    await db.Category.destroy({ where: { slug: categories.map((c) => c.slug) }, force: true, transaction });
  });
}

async function seedUsers(transaction) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const userMap = new Map();
  for (const [index, userData] of users.entries()) {
    const user = await db.User.create({
      email: userData.email,
      fullName: userData.fullName,
      phone: userData.phone,
      role: userData.role,
      status: userData.status,
      emailVerifiedAt: userData.verified ? daysAgo(60 - index) : null,
      lastLoginAt: userData.lastLoginDaysAgo == null ? null : daysAgo(userData.lastLoginDaysAgo),
      avatarUrl: `https://dummyimage.com/300x300/1f2937/ffffff.png&text=${encodeURIComponent(userData.fullName.split(" ").slice(-1)[0])}`,
      createdAt: daysAgo(70 - index),
      updatedAt: daysAgo(userData.lastLoginDaysAgo || 10),
    }, { transaction });
    await db.AuthProvider.create({
      userId: user.id,
      provider: "LOCAL",
      providerEmail: user.email,
      passwordHash,
      linkedAt: user.createdAt,
      lastUsedAt: user.lastLoginAt,
    }, { transaction });
    await db.Cart.create({ userId: user.id, createdAt: user.createdAt, updatedAt: user.updatedAt }, { transaction });
    await db.Wishlist.create({ userId: user.id, createdAt: user.createdAt, updatedAt: user.updatedAt }, { transaction });
    userMap.set(user.email, user);
  }
  return userMap;
}

async function seedCatalog(transaction) {
  const categoryMap = new Map();
  for (const categoryData of categories) {
    const category = await db.Category.create({
      ...categoryData,
      imageUrl: `https://source.unsplash.com/800x600/?${encodeURIComponent(categoryData.name)},technology`,
      isActive: categoryData.slug !== "seed-smart-home",
    }, { transaction });
    categoryMap.set(category.slug, category);
  }

  const brandMap = new Map();
  for (const brandData of brands) {
    const existingBrand = await db.Brand.findOne({
      where: { name: brandData.name },
      paranoid: false,
      transaction,
    });

    if (existingBrand) {
      if (existingBrand.deletedAt) {
        await existingBrand.restore({ transaction });
      }
      brandMap.set(brandData.slug, existingBrand);
      continue;
    }

    const brand = await db.Brand.create({
      ...brandData,
      logoUrl: `https://dummyimage.com/300x120/111827/ffffff.png&text=${encodeURIComponent(brandData.name)}`,
      isActive: brandData.slug !== "seed-lg",
    }, { transaction });
    brandMap.set(brand.slug, brand);
  }

  const tagMap = new Map();
  for (const tagData of tags) {
    const tag = await db.Tag.create(tagData, { transaction });
    tagMap.set(tag.name, tag);
  }

  const specMap = new Map();
  for (const category of categories) {
    for (const [index, [name, key]] of specByCategory[category.slug].entries()) {
      const definition = await db.SpecificationDefinition.create({
        categoryId: categoryMap.get(category.slug).id,
        name,
        key,
        dataType: "STRING",
        isFilterable: index < 3,
        isComparable: true,
        sortOrder: index + 1,
      }, { transaction });
      specMap.set(`${category.slug}:${key}`, definition);
    }
  }

  return { categoryMap, brandMap, tagMap, specMap };
}

function buildVariants(product, item, index) {
  const [, , categorySlug, , basePrice, salePrice, stockQuantity, status] = item;
  if (status === "DRAFT") return [];
  const colorSets = {
    "seed-laptop": ["Silver", "Space Gray"],
    "seed-smartphone": ["Black", "Natural Titanium", "Blue"],
    "seed-tablet": ["Gray", "Starlight"],
    "seed-monitor": ["Black"],
    "seed-audio": ["Black", "White"],
    "seed-accessory": ["Graphite", "White"],
    "seed-networking": ["White"],
    "seed-smart-home": ["White", "Black"],
  };
  const colors = colorSets[categorySlug];
  const count = ["seed-laptop", "seed-smartphone", "seed-audio", "seed-accessory"].includes(categorySlug) ? Math.min(colors.length, 2 + (index % 2)) : 1;
  return Array.from({ length: count }, (_, variantIndex) => {
    const variantStock = status === "OUT_OF_STOCK" ? 0 : Math.max(stockQuantity - variantIndex * 3, variantIndex === 0 ? 1 : 0);
    return {
      productId: product.id,
      sku: `${product.sku}-V${variantIndex + 1}`,
      variantName: colors[variantIndex],
      attributes: { color: colors[variantIndex], warranty: "12 months" },
      price: money(basePrice + variantIndex * 500000),
      salePrice: salePrice == null ? null : money(salePrice + variantIndex * 300000),
      stockQuantity: variantStock,
      isDefault: variantIndex === 0,
      status: status === "OUT_OF_STOCK" || variantStock === 0 ? "OUT_OF_STOCK" : "ACTIVE",
    };
  });
}

async function seedProducts(catalog, transaction) {
  const productMap = new Map();
  const variantMap = new Map();
  const imageMap = new Map();
  for (const [index, item] of products.entries()) {
    const [name, slug, categorySlug, brandSlug, basePrice, salePrice, stockQuantity, status, isFeatured, specValues, tagNames] = item;
    const createdAt = daysAgo(45 - (index % 30));
    const product = await db.Product.create({
      categoryId: catalog.categoryMap.get(categorySlug).id,
      brandId: catalog.brandMap.get(brandSlug).id,
      name,
      slug,
      sku: `TS-SEED-P${String(index + 1).padStart(3, "0")}`,
      shortDescription: `${name} chinh hang, phu hop nhu cau ${tagNames.join(", ").toLowerCase()}.`,
      description: `${name} la san pham mau trong bo development seed cua TechShop, co day du hinh anh, thong so va trang thai de test frontend/admin dashboard.`,
      basePrice: money(basePrice),
      salePrice: salePrice == null ? null : money(salePrice),
      stockQuantity,
      soldCount: 0,
      viewCount: 120 + index * 37,
      averageRating: "0.00",
      reviewCount: 0,
      status,
      isFeatured,
      publishedAt: ["ACTIVE", "OUT_OF_STOCK"].includes(status) ? createdAt : null,
      createdAt,
      updatedAt: daysAgo(index % 9),
    }, { transaction });
    productMap.set(slug, product);

    const image = await db.ProductImage.create({
      productId: product.id,
      imageUrl: `https://source.unsplash.com/900x900/?${encodeURIComponent(name)}`,
      publicId: `seed/products/${slug}/primary`,
      altText: name,
      isPrimary: true,
      sortOrder: 0,
      createdAt,
    }, { transaction });
    imageMap.set(slug, image);
    await db.ProductImage.create({
      productId: product.id,
      imageUrl: `https://source.unsplash.com/900x900/?${encodeURIComponent(`${catalog.categoryMap.get(categorySlug).name} setup`)}`,
      publicId: `seed/products/${slug}/gallery-1`,
      altText: `${name} gallery`,
      isPrimary: false,
      sortOrder: 1,
      createdAt,
    }, { transaction });

    for (const [specIndex, [, key]] of specByCategory[categorySlug].entries()) {
      await db.ProductSpecification.create({
        productId: product.id,
        specificationDefinitionId: catalog.specMap.get(`${categorySlug}:${key}`).id,
        valueText: specValues[specIndex],
      }, { transaction });
    }
    for (const tagName of tagNames) {
      await db.ProductTag.create({ productId: product.id, tagId: catalog.tagMap.get(tagName).id }, { transaction });
    }
    for (const variant of buildVariants(product, item, index)) {
      const createdVariant = await db.ProductVariant.create(variant, { transaction });
      if (!variantMap.has(slug)) variantMap.set(slug, []);
      variantMap.get(slug).push(createdVariant);
    }
  }
  return { productMap, variantMap, imageMap };
}

async function seedAddresses(userMap, transaction) {
  const addressMap = new Map();
  for (const [index, row] of addresses.entries()) {
    const [email, receiverName, receiverPhone, province, district, ward, addressLine] = row;
    const address = await db.UserAddress.create({
      userId: userMap.get(email).id,
      receiverName,
      receiverPhone,
      province,
      district,
      ward,
      addressLine,
      postalCode: `70${String(index).padStart(3, "0")}`,
      isDefault: true,
    }, { transaction });
    addressMap.set(email, address);
  }
  return addressMap;
}

async function seedCartWishlist(userMap, productData, transaction) {
  const activeProducts = products.filter((p) => p[7] === "ACTIVE");
  const activeCustomers = users.filter((u) => u.role === "CUSTOMER" && u.status === "ACTIVE").map((u) => u.email);
  for (const [index, email] of activeCustomers.entries()) {
    const user = userMap.get(email);
    const cart = await db.Cart.findOne({ where: { userId: user.id }, transaction });
    const wishlist = await db.Wishlist.findOne({ where: { userId: user.id }, transaction });
    for (let offset = 0; offset < (index % 3) + 1; offset += 1) {
      const row = pick(activeProducts, index + offset);
      const variants = productData.variantMap.get(row[1]) || [];
      await db.CartItem.create({ cartId: cart.id, productId: productData.productMap.get(row[1]).id, variantId: variants[0]?.id || null, quantity: 1 + ((index + offset) % 2) }, { transaction });
    }
    for (let offset = 0; offset < 2; offset += 1) {
      const row = pick(activeProducts, index * 2 + offset + 5);
      const variants = productData.variantMap.get(row[1]) || [];
      await db.WishlistItem.create({ wishlistId: wishlist.id, productId: productData.productMap.get(row[1]).id, variantId: variants[0]?.id || null, createdAt: daysAgo(index + offset) }, { transaction });
    }
  }
}

async function seedOrders(userMap, addressMap, productData, transaction) {
  const specs = [
    ["minh.customer@techshop.dev", "DELIVERED", "PAID", 28, 2],
    ["anh.customer@techshop.dev", "SHIPPING", "PAID", 5, 2],
    ["vy.customer@techshop.dev", "PROCESSING", "PAID", 3, 1],
    ["ha.customer@techshop.dev", "PENDING", "UNPAID", 1, 2],
    ["son.customer@techshop.dev", "CANCELLED", "UNPAID", 12, 1],
    ["tuan.customer@techshop.dev", "DELIVERED", "PAID", 17, 3],
    ["quyen.customer@techshop.dev", "REFUNDED", "REFUNDED", 22, 1],
    ["yen.customer@techshop.dev", "PAID", "PAID", 2, 2],
    ["hieu.customer@techshop.dev", "DELIVERED", "PAID", 8, 2],
    ["minh.customer@techshop.dev", "PENDING", "UNPAID", 0, 1],
    ["anh.customer@techshop.dev", "DELIVERED", "PAID", 35, 2],
    ["vy.customer@techshop.dev", "SHIPPING", "PAID", 6, 2],
  ];
  const productRows = products.filter((p) => ["ACTIVE", "OUT_OF_STOCK"].includes(p[7]));
  const reviewCandidates = [];
  for (const [index, [email, status, paymentStatus, ageDays, itemCount]] of specs.entries()) {
    const address = addressMap.get(email);
    const selected = Array.from({ length: itemCount }, (_, offset) => pick(productRows, index * 3 + offset));
    let subtotal = 0;
    const snapshots = selected.map((row, itemIndex) => {
      const variants = productData.variantMap.get(row[1]) || [];
      const variant = variants[itemIndex % Math.max(variants.length, 1)] || null;
      const unitPrice = Number(variant?.salePrice || variant?.price || row[5] || row[4]);
      const quantity = 1 + ((index + itemIndex) % 2);
      subtotal += unitPrice * quantity;
      return { row, product: productData.productMap.get(row[1]), variant, unitPrice, quantity };
    });
    const shippingFee = subtotal >= 15000000 ? 0 : 30000;
    const discountAmount = index % 4 === 0 ? Math.round(subtotal * 0.03) : 0;
    const createdAt = daysAgo(ageDays);
    const paidAt = ["PAID", "REFUNDED"].includes(paymentStatus) ? daysAgo(Math.max(ageDays - 1, 0)) : null;
    const order = await db.Order.create({
      orderCode: `TS-SEED-${String(index + 1).padStart(5, "0")}`,
      userId: userMap.get(email).id,
      addressId: address?.id || null,
      receiverName: address?.receiverName || userMap.get(email).fullName,
      receiverPhone: address?.receiverPhone || userMap.get(email).phone,
      shippingAddress: address ? `${address.addressLine}, ${address.ward}, ${address.district}, ${address.province}` : "Seed address",
      subtotalPrice: money(subtotal),
      shippingFee: money(shippingFee),
      discountAmount: money(discountAmount),
      totalPrice: money(subtotal + shippingFee - discountAmount),
      status,
      paymentStatus,
      note: status === "CANCELLED" ? "Khach hang huy don trong development seed." : "Don hang mau cho TechShop.",
      paidAt,
      cancelledAt: status === "CANCELLED" ? daysAgo(Math.max(ageDays - 1, 0)) : null,
      createdAt,
      updatedAt: daysAgo(Math.max(ageDays - 1, 0)),
    }, { transaction });
    await db.OrderStatusHistory.create({ orderId: order.id, fromStatus: null, toStatus: "PENDING", note: "Seed order created", changedBy: userMap.get("admin@techshop.dev").id, createdAt }, { transaction });
    if (status !== "PENDING") {
      await db.OrderStatusHistory.create({ orderId: order.id, fromStatus: "PENDING", toStatus: status, note: `Seed status changed to ${status}`, changedBy: userMap.get("linh.staff@techshop.dev").id, createdAt: daysAgo(Math.max(ageDays - 1, 0)) }, { transaction });
    }
    for (const snapshot of snapshots) {
      const image = productData.imageMap.get(snapshot.row[1]);
      const item = await db.OrderItem.create({
        orderId: order.id,
        productId: snapshot.product.id,
        variantId: snapshot.variant?.id || null,
        productName: snapshot.product.name,
        productSku: snapshot.variant?.sku || snapshot.product.sku,
        productImageUrl: image?.imageUrl || null,
        variantName: snapshot.variant?.variantName || null,
        variantAttributes: snapshot.variant?.attributes || null,
        unitPrice: money(snapshot.unitPrice),
        quantity: snapshot.quantity,
        totalPrice: money(snapshot.unitPrice * snapshot.quantity),
        createdAt,
      }, { transaction });
      if (status === "DELIVERED") reviewCandidates.push({ email, item, product: snapshot.product });
    }
  }
  return reviewCandidates;
}

async function seedReviews(userMap, reviewCandidates, transaction) {
  const comments = [
    ["Rat dang tien", "San pham dung mo ta, dong goi ky va giao nhanh."],
    ["Hieu nang tot", "Dung de lam viec hang ngay rat muot, pin on."],
    ["Thiet ke dep", "Hoan thien tot, cam giac cao cap hon mong doi."],
    ["Phu hop nhu cau", "Gia hop ly, cau hinh du dung cho hoc tap va giai tri."],
    ["Se mua tiep", "Trai nghiem mua hang tot, du trang thai de test."],
  ];
  for (const [index, candidate] of reviewCandidates.slice(0, 10).entries()) {
    const [title, content] = pick(comments, index);
    await db.Review.create({
      userId: userMap.get(candidate.email).id,
      productId: candidate.product.id,
      orderItemId: candidate.item.id,
      rating: 3 + (index % 3),
      title,
      content,
      status: index % 6 === 0 ? "PENDING" : index % 7 === 0 ? "HIDDEN" : "APPROVED",
      reviewedAt: daysAgo(index + 1),
      createdAt: daysAgo(index + 1),
      updatedAt: daysAgo(index),
    }, { transaction });
  }
}

async function seedSignals(userMap, catalog, productData, transaction) {
  const activeCustomers = users.filter((u) => u.role === "CUSTOMER" && u.status === "ACTIVE").map((u) => u.email);
  const activeProducts = products.filter((p) => p[7] === "ACTIVE");
  for (const [index, email] of activeCustomers.entries()) {
    const row = pick(activeProducts, index);
    const product = productData.productMap.get(row[1]);
    const category = catalog.categoryMap.get(row[2]);
    const user = userMap.get(email);
    await db.SearchHistory.create({
      userId: user.id,
      sessionId: `seed-session-${index}`,
      keyword: row[0].split(" ").slice(0, 2).join(" "),
      categoryId: category.id,
      productId: product.id,
      filters: { minPrice: 1000000, sort: index % 2 ? "priceAsc" : "newest" },
      resultCount: 8 + index,
      searchedAt: daysAgo(index + 1),
      createdAt: daysAgo(index + 1),
    }, { transaction });
    for (const behaviorType of ["SEARCH", "VIEW_PRODUCT", index % 2 ? "FAVORITE" : "ADD_TO_CART"]) {
      await db.UserBehavior.create({ userId: user.id, sessionId: `seed-session-${index}`, productId: product.id, categoryId: category.id, behaviorType, metadata: { source: "development-seed" }, occurredAt: daysAgo(index + 1), createdAt: daysAgo(index + 1) }, { transaction });
    }
    if (index < 8) {
      await db.UserPreferenceProfile.create({
        userId: user.id,
        preferredCategories: [category.id],
        preferredBrands: [catalog.brandMap.get(row[3]).id],
        preferredTags: row[10],
        preferredSpecs: { keyword: row[0] },
        minPrice: money(1000000 + index * 500000),
        maxPrice: money(30000000 + index * 1000000),
        averagePrice: money(row[5] || row[4]),
        lastCalculatedAt: daysAgo(index),
      }, { transaction });
    }
  }
}

async function refreshProductStats(transaction) {
  const seededProducts = await db.Product.findAll({ where: { slug: products.map((p) => p[1]) }, transaction });
  for (const product of seededProducts) {
    const reviews = await db.Review.findAll({ where: { productId: product.id, status: "APPROVED" }, transaction });
    const orderItems = await db.OrderItem.findAll({
      where: { productId: product.id },
      include: [{ model: db.Order, as: "order", where: { paymentStatus: "PAID", status: { [Op.notIn]: ["CANCELLED", "REFUNDED"] } } }],
      transaction,
    });
    await product.update({
      soldCount: orderItems.reduce((sum, item) => sum + Number(item.quantity), 0),
      reviewCount: reviews.length,
      averageRating: money(reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0),
    }, { transaction });
  }
}

async function verifySeed() {
  const countModels = {
    users: db.User,
    auth_providers: db.AuthProvider,
    user_addresses: db.UserAddress,
    categories: db.Category,
    brands: db.Brand,
    products: db.Product,
    product_images: db.ProductImage,
    product_variants: db.ProductVariant,
    specification_definitions: db.SpecificationDefinition,
    product_specifications: db.ProductSpecification,
    tags: db.Tag,
    product_tags: db.ProductTag,
    carts: db.Cart,
    cart_items: db.CartItem,
    wishlists: db.Wishlist,
    wishlist_items: db.WishlistItem,
    orders: db.Order,
    order_items: db.OrderItem,
    order_status_histories: db.OrderStatusHistory,
    reviews: db.Review,
    search_histories: db.SearchHistory,
    user_behaviors: db.UserBehavior,
    user_preference_profiles: db.UserPreferenceProfile,
  };
  const counts = {};
  for (const [name, model] of Object.entries(countModels)) counts[name] = await model.count();
  const admin = await db.User.findOne({ where: { email: "admin@techshop.dev" }, include: [{ model: db.AuthProvider, as: "authProviders", where: { provider: "LOCAL" } }] });
  const productWithRelations = await db.Product.count({
    where: { slug: products.map((p) => p[1]) },
    include: [
      { model: db.Category, as: "category", required: true },
      { model: db.Brand, as: "brand", required: true },
      { model: db.ProductImage, as: "images", required: true },
    ],
    distinct: true,
  });
  return {
    counts,
    passwordOk: await bcrypt.compare(PASSWORD, admin.authProviders[0].passwordHash),
    productWithRelations,
    statusCounts: {
      products: await db.Product.findAll({ attributes: ["status", [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"]], group: ["status"], raw: true }),
      users: await db.User.findAll({ attributes: ["status", "role", [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"]], group: ["status", "role"], raw: true }),
      orders: await db.Order.findAll({ attributes: ["status", "paymentStatus", [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"]], group: ["status", "paymentStatus"], raw: true }),
      reviews: await db.Review.findAll({ attributes: ["status", [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"]], group: ["status"], raw: true }),
    },
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed is disabled in production.");
  }
  await db.sequelize.authenticate();
  await db.sequelize.sync();
  await clearSeedData();
  await db.sequelize.transaction(async (transaction) => {
    const userMap = await seedUsers(transaction);
    const catalog = await seedCatalog(transaction);
    const productData = await seedProducts(catalog, transaction);
    const addressMap = await seedAddresses(userMap, transaction);
    await seedCartWishlist(userMap, productData, transaction);
    const reviewCandidates = await seedOrders(userMap, addressMap, productData, transaction);
    await seedReviews(userMap, reviewCandidates, transaction);
    await seedSignals(userMap, catalog, productData, transaction);
    await refreshProductStats(transaction);
  });
  const result = await verifySeed();
  console.log(JSON.stringify({
    message: "TechShop development seed completed",
    login: {
      adminEmail: "admin@techshop.dev",
      customerEmail: "minh.customer@techshop.dev",
      password: PASSWORD,
      passwordVerified: result.passwordOk,
    },
    counts: result.counts,
    productWithCategoryBrandImage: result.productWithRelations,
    statusCounts: result.statusCounts,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });

/**
 * Seed data for Brands
 */

const brandsData = [
  {
    key: "apple",
    name: "Apple",
    slug: "apple",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
    description: "Thương hiệu công nghệ hàng đầu thế giới với hệ sinh thái iPhone, MacBook, iPad, Apple Watch",
    isActive: true,
  },
  {
    key: "samsung",
    name: "Samsung",
    slug: "samsung",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg",
    description: "Tập đoàn công nghệ tiên phong toàn cầu với dòng Galaxy, màn hình OLED và linh kiện",
    isActive: true,
  },
  {
    key: "sony",
    name: "Sony",
    slug: "sony",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Sony_logo.svg",
    description: "Thương hiệu âm thanh và hình ảnh đỉnh cao Nhật Bản với tai nghe WH/WF và máy ảnh Alpha",
    isActive: true,
  },
  {
    key: "asus",
    name: "ASUS",
    slug: "asus",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2e/ASUS_Logo.svg",
    description: "Hãng sản xuất bo mạch chủ, laptop gaming ROG và laptop Zenbook mỏng nhẹ số 1",
    isActive: true,
  },
  {
    key: "dell",
    name: "Dell",
    slug: "dell",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/48/Dell_Logo.svg",
    description: "Thương hiệu máy tính cao cấp với dòng XPS, Inspiron và màn hình UltraSharp chuẩn màu",
    isActive: true,
  },
  {
    key: "lenovo",
    name: "Lenovo",
    slug: "lenovo",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg",
    description: "Nhà sản xuất laptop ThinkPad huyền thoại và dòng laptop gaming Legion mạnh mẽ",
    isActive: true,
  },
  {
    key: "xiaomi",
    name: "Xiaomi",
    slug: "xiaomi",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg",
    description: "Hệ sinh thái công nghệ thông minh, smartphone cấu hình cao giá tốt và thiết bị IoT",
    isActive: true,
  },
  {
    key: "logitech",
    name: "Logitech",
    slug: "logitech",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/09/Logitech_logo.svg",
    description: "Thương hiệu phụ kiện chuột, bàn phím số 1 thế giới với dòng MX Master và Gaming G Pro",
    isActive: true,
  },
  {
    key: "lg",
    name: "LG",
    slug: "lg",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bf/LG_logo_%282015%29.svg",
    description: "Tập đoàn công nghệ hàng đầu với dòng màn hình OLED UltraGear và laptop siêu nhẹ LG Gram",
    isActive: true,
  },
  {
    key: "marshall",
    name: "Marshall",
    slug: "marshall",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/Marshall_Amplification_logo.svg",
    description: "Biểu tượng âm thanh Rock n Roll Anh Quốc với loa Bluetooth cổ điển và tai nghe Major",
    isActive: true,
  },
  {
    key: "htc",
    name: "HTC",
    slug: "htc",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ee/HTC_Logo.svg",
    description: "Thương hiệu di động và VR thực tế ảo Vive (Hiện tạm ngưng phân phối)",
    isActive: false, // Inactive brand for filter testing
  },
];

module.exports = brandsData;

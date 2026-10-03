/**
 * Tai nghe và loa — 28 sản phẩm trên hai danh mục lá mới tách ra từ "Âm Thanh".
 *
 * `ancSupport` là thông số BOOLEAN duy nhất của cả hệ thống, nên nhóm này là
 * chỗ duy nhất chứng minh được bộ lọc kiểu có/không hoạt động đúng. Loa để bàn
 * khai `false` kèm chữ "Không áp dụng" chứ không bỏ trống: bỏ trống đọc ra là
 * "chưa rõ", còn ở đây câu trả lời là "không".
 */

const audio = [
  // ── Tai Nghe ──────────────────────────────────────────────────────────────
  {
    key: "boseQcUltraHeadphone", name: "Tai nghe chống ồn Bose QuietComfort Ultra Headphones",
    brand: "bose", cat: "headphone", price: 10990000, sale: 9490000, stock: 18, sold: 64, views: 3840,
    published: "2026-02-08", tags: ["chong-on-chu-dong-anc", "flagship-dinh-cao", "hot-deal"],
    blurb: "Chống ồn mạnh nhất trong kho, cắt gần hết tiếng động cơ máy bay và tiếng điều hoà văn phòng.",
    specs: {
      driverSize: "35mm màng TriPort", batteryLife: [24, "24 giờ khi bật chống ồn"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ aptX Adaptive và SBC", ancSupport: [true, "Có, chống ồn thích ứng CustomTune đo lại ống tai mỗi lần đeo"],
      waterproofRating: "Không kháng nước, khuyến nghị dùng trong nhà và văn phòng",
    },
    variants: [{ label: "Đen Nhám", attrs: { Color: "Black" } }, { label: "Trắng Khói", attrs: { Color: "White Smoke" } }],
  },
  {
    key: "boseQcEarbudsUltra", name: "Tai nghe True Wireless Bose QuietComfort Ultra Earbuds",
    brand: "bose", cat: "headphone", price: 8490000, sale: 7290000, stock: 22, sold: 78, views: 3420,
    published: "2026-02-08", tags: ["chong-on-chu-dong-anc", "chong-nuoc-chuan-ip", "hot-deal"],
    blurb: "Tai nghe nhét tai có âm thanh vòm Immersive Audio mô phỏng loa đặt trước mặt.",
    specs: {
      driverSize: "9.3mm dynamic driver", batteryLife: [24, "6 giờ tai nghe + 18 giờ hộp sạc (tổng 24 giờ)"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ aptX Adaptive", ancSupport: [true, "Có, chống ồn CustomTune hiệu chỉnh theo ống tai"],
      waterproofRating: "IPX4, kháng mồ hôi và nước bắn",
    },
    variants: [{ label: "Đen Nhám", attrs: { Color: "Black" } }, { label: "Trắng Khói", attrs: { Color: "White Smoke" } }],
  },
  {
    key: "sennheiserMomentum4", name: "Tai nghe chống ồn Sennheiser Momentum 4 Wireless",
    brand: "sennheiser", cat: "headphone", price: 8990000, sale: 7490000, stock: 16, sold: 52, views: 2960,
    published: "2026-01-24", tags: ["chong-on-chu-dong-anc", "mong-nhe-pin-trau", "hot-deal"],
    blurb: "Pin 60 giờ, dài gấp đôi phần lớn tai nghe chụp tai cùng tầm giá.",
    specs: {
      driverSize: "42mm màng transducer", batteryLife: [60, "60 giờ khi bật chống ồn"],
      bluetoothVersion: "Bluetooth 5.2, hỗ trợ aptX Adaptive, AAC, SBC", ancSupport: [true, "Có, chống ồn lai thích ứng theo môi trường"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Trắng", attrs: { Color: "White" } }],
  },
  {
    key: "sennheiserMomentumTw4", name: "Tai nghe True Wireless Sennheiser Momentum True Wireless 4",
    brand: "sennheiser", cat: "headphone", price: 7490000, sale: 6490000, stock: 19, sold: 48, views: 2540,
    published: "2026-03-05", tags: ["chong-on-chu-dong-anc", "chong-nuoc-chuan-ip", "san-pham-moi"],
    blurb: "Tai nghe nhét tai hỗ trợ aptX Lossless, nghe nhạc chất lượng gần CD nếu điện thoại cũng hỗ trợ.",
    specs: {
      driverSize: "7mm TrueResponse transducer", batteryLife: [30, "7.5 giờ tai nghe + 22.5 giờ hộp sạc (tổng 30 giờ)"],
      bluetoothVersion: "Bluetooth 5.4, hỗ trợ aptX Lossless và LE Audio", ancSupport: [true, "Có, chống ồn lai thích ứng"],
      waterproofRating: "IP54, kháng bụi và nước bắn",
    },
    variants: [{ label: "Đen Than", attrs: { Color: "Graphite" } }],
  },
  {
    key: "sonyWh1000Xm4", name: "Tai nghe chống ồn Sony WH-1000XM4",
    brand: "sony", cat: "headphone", price: 6990000, sale: 5690000, stock: 24, sold: 142, views: 5240,
    published: "2026-01-08", tags: ["chong-on-chu-dong-anc", "hot-deal", "ban-chay-nhat"],
    blurb: "Đời trước của XM5, chống ồn vẫn rất tốt và gập gọn lại được để cho vào balo.",
    specs: {
      driverSize: "40mm màng LCP", batteryLife: [30, "30 giờ khi bật chống ồn"],
      bluetoothVersion: "Bluetooth 5.0, hỗ trợ LDAC, AAC, SBC", ancSupport: [true, "Có, chip QN1 với chế độ nhận biết khi nói chuyện"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Bạc", attrs: { Color: "Silver" } }],
  },
  {
    key: "sonyWfC700n", name: "Tai nghe True Wireless Sony WF-C700N",
    brand: "sony", cat: "headphone", price: 2490000, sale: 1990000, stock: 46, sold: 218, views: 6480,
    published: "2026-01-15", tags: ["chong-on-chu-dong-anc", "chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Tai nghe chống ồn rẻ nhất trong kho, dưới 2 triệu mà vẫn có ANC thật sự hoạt động.",
    specs: {
      driverSize: "5mm dynamic driver", batteryLife: [15, "7.5 giờ tai nghe + 7.5 giờ hộp sạc (tổng 15 giờ)"],
      bluetoothVersion: "Bluetooth 5.2, hỗ trợ AAC và SBC", ancSupport: [true, "Có, chống ồn kỹ thuật số cơ bản"],
      waterproofRating: "IPX4, kháng mồ hôi khi tập thể dục",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Xanh Sage", attrs: { Color: "Sage Green" } }],
  },
  {
    key: "airpods4Anc", name: "Tai nghe Apple AirPods 4 (bản có chống ồn chủ động)",
    brand: "apple", cat: "headphone", price: 4490000, sale: 3990000, stock: 34, sold: 156, views: 5860,
    published: "2026-03-10", tags: ["chong-on-chu-dong-anc", "chong-nuoc-chuan-ip", "san-pham-moi", "ban-chay-nhat"],
    blurb: "Dáng đeo hở lần đầu có chống ồn chủ động, đeo lâu không bị bí tai như loại nhét sâu.",
    specs: {
      driverSize: "Driver Apple tuỳ chỉnh độ lệch cao", batteryLife: [30, "5 giờ tai nghe + 25 giờ hộp sạc (tổng 30 giờ)"],
      bluetoothVersion: "Bluetooth 5.3, chip Apple H2", ancSupport: [true, "Có, chống ồn chủ động trên dáng đeo hở"],
      waterproofRating: "IP54, kháng bụi, mồ hôi và nước",
    },
    variants: [{ label: "Trắng", attrs: { Color: "White" } }],
  },
  {
    key: "airpodsMax", name: "Tai nghe chụp tai Apple AirPods Max",
    brand: "apple", cat: "headphone", price: 13990000, sale: 12490000, stock: 9, sold: 24, views: 3260,
    published: "2026-01-20", tags: ["chong-on-chu-dong-anc", "flagship-dinh-cao", "hot-deal"],
    blurb: "Tai nghe đắt nhất trong kho, vỏ nhôm và đệm lưới, âm thanh vòm theo chuyển động đầu.",
    specs: {
      driverSize: "40mm driver động Apple thiết kế riêng", batteryLife: [20, "20 giờ khi bật chống ồn và âm thanh không gian"],
      bluetoothVersion: "Bluetooth 5.0, chip H1 mỗi bên", ancSupport: [true, "Có, chống ồn với 6 micro hướng ra ngoài"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Xám Không Gian", attrs: { Color: "Space Gray" } }, { label: "Bạc", attrs: { Color: "Silver" } }],
  },
  {
    key: "jblTune770nc", name: "Tai nghe chống ồn JBL Tune 770NC",
    brand: "jbl", cat: "headphone", price: 2990000, sale: 2390000, stock: 38, sold: 182, views: 5420,
    published: "2026-01-26", tags: ["chong-on-chu-dong-anc", "mong-nhe-pin-trau", "hot-deal", "ban-chay-nhat"],
    blurb: "Pin 70 giờ khi tắt chống ồn, dài nhất trong nhóm tai nghe dưới 3 triệu.",
    specs: {
      driverSize: "40mm dynamic driver", batteryLife: [44, "44 giờ khi bật chống ồn, 70 giờ khi tắt"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ AAC và SBC", ancSupport: [true, "Có, chống ồn thích ứng có chế độ nghe xuyên âm"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Xanh Navy", attrs: { Color: "Blue" } }],
  },
  {
    key: "jblLivePro2", name: "Tai nghe True Wireless JBL Live Pro 2",
    brand: "jbl", cat: "headphone", price: 3290000, sale: 2590000, stock: 31, sold: 138, views: 4280,
    published: "2026-02-02", tags: ["chong-on-chu-dong-anc", "chong-nuoc-chuan-ip", "hot-deal"],
    blurb: "Chống ồn thích ứng và sáu micro đàm thoại, gọi điện ngoài đường vẫn nghe rõ giọng.",
    specs: {
      driverSize: "11mm dynamic driver", batteryLife: [40, "10 giờ tai nghe + 30 giờ hộp sạc (tổng 40 giờ)"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ AAC và SBC", ancSupport: [true, "Có, chống ồn thích ứng True Adaptive"],
      waterproofRating: "IPX5, chịu được tia nước và mưa nhỏ",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Bạc", attrs: { Color: "Silver" } }],
  },
  {
    key: "marshallMajor5", name: "Tai nghe chụp tai Marshall Major V",
    brand: "marshall", cat: "headphone", price: 3990000, sale: 3490000, stock: 21, sold: 86, views: 3140,
    published: "2026-03-01", tags: ["mong-nhe-pin-trau", "san-pham-moi", "hot-deal"],
    blurb: "Pin hơn 100 giờ, sạc không dây được và có núm điều khiển đồng kiểu ampli Marshall.",
    specs: {
      driverSize: "40mm dynamic driver tuỳ chỉnh", batteryLife: [100, "hơn 100 giờ phát nhạc liên tục"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ SBC và AAC", ancSupport: [false, "Không, chỉ cách âm thụ động bằng đệm tai"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Đen Cổ Điển", attrs: { Color: "Black" } }, { label: "Nâu Da", attrs: { Color: "Brown" } }],
  },
  {
    key: "marshallMinorIv", name: "Tai nghe True Wireless Marshall Minor IV",
    brand: "marshall", cat: "headphone", price: 3490000, sale: 2990000, stock: 26, sold: 72, views: 2680,
    published: "2026-03-01", tags: ["chong-nuoc-chuan-ip", "san-pham-moi"],
    blurb: "Dáng đeo hở kiểu cổ điển Marshall, pin 30 giờ và hộp sạc bọc giả da.",
    specs: {
      driverSize: "12mm dynamic driver", batteryLife: [30, "7 giờ tai nghe + 23 giờ hộp sạc (tổng 30 giờ)"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ SBC và AAC", ancSupport: [false, "Không, dáng đeo hở nên không có chống ồn chủ động"],
      waterproofRating: "IPX4, kháng mồ hôi và nước bắn",
    },
    variants: [{ label: "Đen Cổ Điển", attrs: { Color: "Black" } }],
  },
  {
    key: "steelseriesArctisNova7", name: "Tai nghe Gaming SteelSeries Arctis Nova 7 Wireless",
    brand: "steelseries", cat: "headphone", price: 4490000, sale: 3890000, stock: 23, sold: 94, views: 3520,
    published: "2026-02-14", tags: ["gaming-cao-cap", "hot-deal", "thiet-ke-cong-thai-hoc"],
    blurb: "Kết nối cùng lúc đầu thu 2.4GHz cho máy tính và Bluetooth cho điện thoại, nghe trộn hai nguồn.",
    specs: {
      driverSize: "40mm driver Neodymium", batteryLife: [38, "38 giờ phát liên tục"],
      bluetoothVersion: "Bluetooth 5.0 song song đầu thu USB-C 2.4GHz", ancSupport: [false, "Không, dùng đệm tai AirWeave cách âm thụ động"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Trắng", attrs: { Color: "White" } }],
  },
  {
    key: "razerBarracudaX", name: "Tai nghe Gaming Razer Barracuda X 2022",
    brand: "razer", cat: "headphone", price: 2790000, sale: 2290000, stock: 29, sold: 116, views: 3860,
    published: "2026-01-31", tags: ["gaming-cao-cap", "hot-deal"],
    blurb: "Tai nghe gaming nhẹ 250g dùng được cho cả máy tính, Switch và điện thoại qua USB-C.",
    specs: {
      driverSize: "40mm driver TriForce", batteryLife: [50, "50 giờ phát liên tục"],
      bluetoothVersion: "Bluetooth 5.2 song song đầu thu USB-C 2.4GHz", ancSupport: [false, "Không, chỉ cách âm thụ động"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }],
  },
  {
    key: "samsungBuds2Pro", name: "Tai nghe True Wireless Samsung Galaxy Buds2 Pro",
    brand: "samsung", cat: "headphone", price: 4990000, sale: 3690000, stock: 27, sold: 124, views: 4640,
    published: "2026-01-22", tags: ["chong-on-chu-dong-anc", "chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Nhỏ gọn và nhẹ 5.5g mỗi bên, hỗ trợ âm thanh 24bit nếu dùng cùng điện thoại Galaxy.",
    specs: {
      driverSize: "Driver kép 10mm woofer + 5.3mm tweeter", batteryLife: [29, "5 giờ tai nghe + 24 giờ hộp sạc (tổng 29 giờ có ANC)"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ Samsung Seamless Codec 24bit", ancSupport: [true, "Có, chống ồn với 3 micro và cảm biến giọng nói"],
      waterproofRating: "IPX7, ngâm nước ngọt 1m trong 30 phút",
    },
    variants: [{ label: "Tím Bora", attrs: { Color: "Bora Purple" } }, { label: "Trắng", attrs: { Color: "White" } }],
  },
  {
    key: "xiaomiBuds5", name: "Tai nghe True Wireless Xiaomi Buds 5",
    brand: "xiaomi", cat: "headphone", price: 2190000, sale: 1790000, stock: 42, sold: 196, views: 5480,
    published: "2026-02-27", tags: ["chong-on-chu-dong-anc", "chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Tai nghe dưới 2 triệu có chống ồn 46dB, đủ cắt tiếng ồn xe buýt và quán cà phê.",
    specs: {
      driverSize: "11mm dynamic driver phủ titan", batteryLife: [39, "7 giờ tai nghe + 32 giờ hộp sạc (tổng 39 giờ)"],
      bluetoothVersion: "Bluetooth 5.4, hỗ trợ LDAC, AAC và SBC", ancSupport: [true, "Có, chống ồn chủ động tối đa 46dB"],
      waterproofRating: "IP54, kháng bụi và nước bắn",
    },
    variants: [{ label: "Trắng", attrs: { Color: "White" } }, { label: "Đen", attrs: { Color: "Black" } }],
  },
  {
    key: "logitechG733", name: "Tai nghe Gaming Logitech G733 Lightspeed",
    brand: "logitech", cat: "headphone", price: 3490000, sale: 2890000, stock: 25, sold: 88, views: 3040,
    published: "2026-02-05", tags: ["gaming-cao-cap", "thiet-ke-cong-thai-hoc", "hot-deal"],
    blurb: "Đai đầu co giãn thay được và nặng 278g, đeo nhiều giờ không đè lên đỉnh đầu.",
    specs: {
      driverSize: "40mm driver PRO-G", batteryLife: [29, "29 giờ khi tắt đèn RGB"],
      bluetoothVersion: "Không có Bluetooth, dùng đầu thu Lightspeed 2.4GHz", ancSupport: [false, "Không, chỉ cách âm thụ động"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Trắng", attrs: { Color: "White" } }],
  },
  {
    key: "sennheiserHd560s", name: "Tai nghe có dây Sennheiser HD 560S",
    brand: "sennheiser", cat: "headphone", price: 4290000, sale: 3690000, stock: 14, sold: 42, views: 2180,
    published: "2026-02-18", tags: ["hot-deal"],
    blurb: "Tai nghe có dây dáng mở cho nghe nhạc tại bàn, âm trường rộng và trung thực nhất trong kho.",
    specs: {
      driverSize: "38mm màng transducer dáng mở", batteryLife: [0, "Không dùng pin, kết nối bằng dây 3.5mm"],
      bluetoothVersion: "Không có kết nối không dây, dây rời 3m jack 6.3mm kèm đầu chuyển 3.5mm",
      ancSupport: [false, "Không, thiết kế dáng mở cố ý cho âm lọt ra ngoài"],
      waterproofRating: "Không kháng nước",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }],
  },

  // ── Loa & Soundbar ────────────────────────────────────────────────────────
  {
    key: "jblFlip6", name: "Loa Bluetooth di động JBL Flip 6",
    brand: "jbl", cat: "speaker", price: 2790000, sale: 2290000, stock: 44, sold: 234, views: 6840,
    published: "2026-01-10", tags: ["chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Loa xách tay bán chạy nhất, chống nước IP67 nên mang ra bể bơi hay đi cắm trại đều được.",
    specs: {
      driverSize: "Loa toàn dải 44x80mm + 2 màng thụ động", batteryLife: [12, "12 giờ phát liên tục"],
      bluetoothVersion: "Bluetooth 5.1, ghép đôi 2 loa hoặc ghép nhóm PartyBoost",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "IP67, chống bụi hoàn toàn và ngâm nước 1m trong 30 phút",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Xanh Dương", attrs: { Color: "Blue" } }, { label: "Đỏ", attrs: { Color: "Red" } }],
  },
  {
    key: "jblCharge5", name: "Loa Bluetooth di động JBL Charge 5",
    brand: "jbl", cat: "speaker", price: 4290000, sale: 3490000, stock: 32, sold: 168, views: 5240,
    published: "2026-01-10", tags: ["chong-nuoc-chuan-ip", "mong-nhe-pin-trau", "hot-deal", "ban-chay-nhat"],
    blurb: "Pin 20 giờ và có cổng USB-A để sạc ngược cho điện thoại khi đi chơi xa.",
    specs: {
      driverSize: "Loa toàn dải 52x90mm + tweeter 20mm + 2 màng thụ động", batteryLife: [20, "20 giờ phát liên tục"],
      bluetoothVersion: "Bluetooth 5.1, hỗ trợ PartyBoost ghép nhiều loa",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "IP67, chống bụi hoàn toàn và ngâm nước 1m trong 30 phút",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Xanh Teal", attrs: { Color: "Teal" } }],
  },
  {
    key: "jblGo4", name: "Loa Bluetooth mini JBL Go 4",
    brand: "jbl", cat: "speaker", price: 1090000, sale: 890000, stock: 68, sold: 342, views: 8420,
    published: "2026-02-20", tags: ["chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Loa rẻ nhất trong kho, bỏ vừa túi quần và có móc treo vào balo.",
    specs: {
      driverSize: "Loa toàn dải 43x47mm", batteryLife: [7, "7 giờ phát liên tục, thêm 2 giờ ở chế độ Playtime Boost"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ Auracast ghép nhiều loa",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "IP67, chống bụi hoàn toàn và ngâm nước 1m trong 30 phút",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Xanh Dương", attrs: { Color: "Blue" } }],
  },
  {
    key: "jblBoombox3", name: "Loa Bluetooth công suất lớn JBL Boombox 3",
    brand: "jbl", cat: "speaker", price: 12990000, sale: 10990000, stock: 8, sold: 32, views: 2840,
    published: "2026-02-04", tags: ["chong-nuoc-chuan-ip", "flagship-dinh-cao", "hot-deal"],
    blurb: "Loa to nhất trong kho với 180W và pin 24 giờ, dùng cho tiệc ngoài trời hoặc sân bãi.",
    specs: {
      driverSize: "Woofer 179mm + 2 loa trung 79mm + 2 tweeter 20mm", batteryLife: [24, "24 giờ phát liên tục"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ PartyBoost",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "IP67, chống bụi hoàn toàn và ngâm nước 1m trong 30 phút",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }],
  },
  {
    key: "boseSoundlinkFlex", name: "Loa Bluetooth di động Bose SoundLink Flex",
    brand: "bose", cat: "speaker", price: 3990000, sale: 3390000, stock: 26, sold: 108, views: 3620,
    published: "2026-01-28", tags: ["chong-nuoc-chuan-ip", "hot-deal"],
    blurb: "Loa tự nhận biết đang nằm ngang hay treo dọc để chỉnh lại âm cho phù hợp vị trí.",
    specs: {
      driverSize: "Loa toàn dải tuỳ chỉnh + 2 màng thụ động", batteryLife: [12, "12 giờ phát liên tục"],
      bluetoothVersion: "Bluetooth 4.2, ghép đôi hai loa thành stereo",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "IP67, nổi được trên mặt nước",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Xanh Stone", attrs: { Color: "Stone Blue" } }],
  },
  {
    key: "marshallEmberton3", name: "Loa Bluetooth di động Marshall Emberton III",
    brand: "marshall", cat: "speaker", price: 4490000, sale: 3890000, stock: 20, sold: 74, views: 2960,
    published: "2026-03-02", tags: ["chong-nuoc-chuan-ip", "san-pham-moi", "hot-deal"],
    blurb: "Kiểu dáng ampli Marshall thu nhỏ, pin 32 giờ và sạc 20 phút dùng được 6 tiếng.",
    specs: {
      driverSize: "2 loa toàn dải 2 inch + 2 màng thụ động", batteryLife: [32, "32 giờ phát liên tục"],
      bluetoothVersion: "Bluetooth 5.3, hỗ trợ LE Audio và Auracast",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "IP67, chống bụi hoàn toàn và ngâm nước 1m trong 30 phút",
    },
    variants: [{ label: "Đen Đồng", attrs: { Color: "Black and Brass" } }, { label: "Kem", attrs: { Color: "Cream" } }],
  },
  {
    key: "edifierR1280db", name: "Loa để bàn Edifier R1280DB 2.0 (42W)",
    brand: "edifier", cat: "speaker", price: 2790000, sale: 2390000, stock: 30, sold: 128, views: 4180,
    published: "2026-01-16", tags: ["van-phong-hoc-tap", "hot-deal", "ban-chay-nhat"],
    blurb: "Cặp loa kệ sách cho góc làm việc, có núm chỉnh bass treble riêng ở sườn loa phải.",
    specs: {
      driverSize: "Woofer 4 inch + tweeter lụa 13mm mỗi bên", batteryLife: [0, "Không dùng pin, cắm nguồn điện trực tiếp"],
      bluetoothVersion: "Bluetooth 5.0, kèm 2 ngõ RCA và 1 ngõ quang",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "Sử dụng cố định trong nhà",
    },
    variants: [{ label: "Vân Gỗ Nâu", attrs: { Color: "Brown" } }, { label: "Đen", attrs: { Color: "Black" } }],
  },
  {
    key: "edifierS3000pro", name: "Loa để bàn Edifier S3000Pro 2.0 (256W)",
    brand: "edifier", cat: "speaker", price: 12490000, sale: 10990000, stock: 7, sold: 18, views: 2240,
    published: "2026-02-22", tags: ["flagship-dinh-cao", "hot-deal"],
    blurb: "Cặp loa 256W có màng tweeter kim cương và nhận nhạc không dây chất lượng cao qua LDAC.",
    specs: {
      driverSize: "Woofer nhôm 6.5 inch + tweeter kim cương ribbon mỗi bên", batteryLife: [0, "Không dùng pin, cắm nguồn điện trực tiếp"],
      bluetoothVersion: "Bluetooth 5.0 hỗ trợ LDAC, kèm ngõ quang, đồng trục, RCA và XLR cân bằng",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "Sử dụng cố định trong nhà",
    },
    variants: [{ label: "Vân Gỗ Đen", attrs: { Color: "Black Wood" } }],
  },
  {
    key: "samsungSoundbarB650", name: "Loa thanh Samsung Soundbar HW-B650 3.1 kênh (430W)",
    brand: "samsung", cat: "speaker", price: 6490000, sale: 5290000, stock: 13, sold: 44, views: 2680,
    published: "2026-02-12", tags: ["hot-deal"],
    blurb: "Loa thanh kèm loa siêu trầm rời cho phòng khách, có chế độ tự tăng rõ lời thoại phim.",
    specs: {
      driverSize: "3.1 kênh với loa trung tâm riêng + subwoofer không dây 6.5 inch", batteryLife: [0, "Không dùng pin, cắm nguồn điện trực tiếp"],
      bluetoothVersion: "Bluetooth 5.2, kèm HDMI eARC và ngõ quang",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "Sử dụng cố định trong nhà",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }],
  },
  {
    key: "lgSoundbarS60q", name: "Loa thanh LG Soundbar S60Q 2.1 kênh (300W)",
    brand: "lg", cat: "speaker", price: 4990000, sale: 3990000, stock: 16, sold: 52, views: 2420,
    published: "2026-02-12", tags: ["hot-deal"],
    blurb: "Loa thanh giá mềm hỗ trợ DTS Virtual:X, ghép cùng TV LG thì điều khiển chung một remote.",
    specs: {
      driverSize: "2.1 kênh + subwoofer không dây 6 inch", batteryLife: [0, "Không dùng pin, cắm nguồn điện trực tiếp"],
      bluetoothVersion: "Bluetooth 5.0, kèm HDMI ARC, ngõ quang và USB",
      ancSupport: [false, "Không áp dụng cho loa"], waterproofRating: "Sử dụng cố định trong nhà",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }],
  },
];

module.exports = audio;

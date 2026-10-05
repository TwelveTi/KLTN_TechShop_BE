/**
 * Đồng hồ thông minh — 12 mẫu.
 *
 * `batteryLife` khai bằng GIỜ chứ không phải ngày, để cùng đơn vị với định nghĩa
 * đã có ở `specs.data.js`. Một chiếc Garmin 16 ngày ghi là 384 giờ, nhờ vậy nó
 * vẫn so sánh trực tiếp được với Apple Watch 18 giờ trên cùng một trục.
 */

const wearables = [
  {
    key: "appleWatchS9", name: "Đồng hồ thông minh Apple Watch Series 9 GPS 45mm",
    brand: "apple", cat: "smartwatch", price: 11990000, sale: 10490000, stock: 24, sold: 98, views: 4860,
    published: "2026-01-14", tags: ["chong-nuoc-chuan-ip", "ban-chay-nhat", "hot-deal"],
    blurb: "Đồng hồ bán chạy nhất nhóm, có thao tác chạm hai ngón để nhận cuộc gọi khi tay đang bận.",
    specs: {
      caseSize: [45, "45mm khung nhôm"], screenType: "LTPO OLED luôn hiển thị, sáng tối đa 2000 nits",
      batteryLife: [18, "18 giờ dùng thường, 36 giờ ở chế độ tiết kiệm pin"],
      waterResistance: "50m (5 ATM), bơi hồ và tắm biển được",
      healthFeatures: "Nhịp tim, điện tâm đồ ECG, nồng độ oxy máu SpO2, nhiệt độ cổ tay, phát hiện té ngã và tai nạn",
    },
    variants: [{ label: "45mm GPS - Đen Midnight", attrs: { Color: "Midnight", Size: "45mm", Connectivity: "GPS" } },
      { label: "41mm GPS - Bạc", attrs: { Color: "Starlight", Size: "41mm", Connectivity: "GPS" }, delta: -1000000 }],
  },
  {
    key: "appleWatchSe2", name: "Đồng hồ thông minh Apple Watch SE 2023 GPS 40mm",
    brand: "apple", cat: "smartwatch", price: 6490000, sale: 5690000, stock: 32, sold: 146, views: 5480,
    published: "2026-01-14", tags: ["chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Apple Watch rẻ nhất, bỏ màn luôn hiển thị và cảm biến ECG nhưng giữ đủ tính năng thể thao.",
    specs: {
      caseSize: [40, "40mm khung nhôm"], screenType: "Retina OLED, sáng tối đa 1000 nits",
      batteryLife: [18, "18 giờ dùng thường"],
      waterResistance: "50m (5 ATM), bơi hồ được",
      healthFeatures: "Nhịp tim, phát hiện té ngã và tai nạn, theo dõi giấc ngủ",
    },
    variants: [{ label: "40mm GPS - Đen Midnight", attrs: { Color: "Midnight", Size: "40mm", Connectivity: "GPS" } },
      { label: "44mm GPS - Bạc", attrs: { Color: "Silver", Size: "44mm", Connectivity: "GPS" }, delta: 900000 }],
  },
  {
    key: "galaxyWatch7", name: "Đồng hồ thông minh Samsung Galaxy Watch7 44mm Bluetooth",
    brand: "samsung", cat: "smartwatch", price: 8490000, sale: 7290000, stock: 22, sold: 84, views: 3920,
    published: "2026-03-08", tags: ["chong-nuoc-chuan-ip", "san-pham-moi", "hot-deal"],
    blurb: "Cảm biến BioActive đo cả chỉ số chống oxy hoá, ghép với điện thoại Galaxy thì mở khoá được thêm tính năng.",
    specs: {
      caseSize: [44, "44mm khung nhôm"], screenType: "Super AMOLED luôn hiển thị, sáng tối đa 2000 nits",
      batteryLife: [40, "40 giờ khi tắt màn luôn hiển thị"],
      waterResistance: "50m (5 ATM) và đạt chuẩn quân đội MIL-STD-810H",
      healthFeatures: "Nhịp tim, ECG, SpO2, thành phần cơ thể BIA, chỉ số AGEs, theo dõi giấc ngủ nâng cao",
    },
    variants: [{ label: "44mm Bluetooth - Xanh", attrs: { Color: "Green", Size: "44mm", Connectivity: "Bluetooth" } },
      { label: "40mm Bluetooth - Kem", attrs: { Color: "Cream", Size: "40mm", Connectivity: "Bluetooth" }, delta: -800000 }],
  },
  {
    key: "galaxyWatchFe", name: "Đồng hồ thông minh Samsung Galaxy Watch FE 40mm",
    brand: "samsung", cat: "smartwatch", price: 4990000, sale: 4290000, stock: 34, sold: 128, views: 4240,
    published: "2026-03-08", tags: ["chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Bản Fan Edition dưới 5 triệu, vẫn đủ cảm biến nhịp tim, ECG và đo giấc ngủ.",
    specs: {
      caseSize: [40, "40mm khung nhôm"], screenType: "Super AMOLED, sáng tối đa 1000 nits",
      batteryLife: [40, "40 giờ khi tắt màn luôn hiển thị"],
      waterResistance: "50m (5 ATM) và đạt chuẩn quân đội MIL-STD-810H",
      healthFeatures: "Nhịp tim, ECG, SpO2, theo dõi giấc ngủ và cảnh báo ngã",
    },
    variants: [{ label: "40mm - Đen", attrs: { Color: "Black", Size: "40mm", Connectivity: "Bluetooth" } },
      { label: "40mm - Bạc", attrs: { Color: "Silver", Size: "40mm", Connectivity: "Bluetooth" } }],
  },
  {
    key: "garminForerunner265", name: "Đồng hồ thể thao Garmin Forerunner 265 46mm",
    brand: "garmin", cat: "smartwatch", price: 12990000, sale: 11490000, stock: 14, sold: 42, views: 2840,
    published: "2026-02-16", tags: ["chong-nuoc-chuan-ip", "hot-deal"],
    blurb: "Đồng hồ chạy bộ có GPS hai băng tần, bắt vị trí chính xác cả khi chạy giữa các toà nhà cao.",
    specs: {
      caseSize: [46, "46mm khung polymer sợi gia cường"], screenType: "AMOLED cảm ứng, có chế độ luôn hiển thị",
      batteryLife: [312, "13 ngày chế độ đồng hồ (312 giờ), 20 giờ khi bật GPS liên tục"],
      waterResistance: "50m (5 ATM), bơi hồ và bơi biển",
      healthFeatures: "Nhịp tim, SpO2, biến thiên nhịp tim HRV, chỉ số Training Readiness và VO2 Max",
    },
    variants: [{ label: "46mm - Đen", attrs: { Color: "Black", Size: "46mm" } }],
  },
  {
    key: "garminInstinct2", name: "Đồng hồ thể thao Garmin Instinct 2 45mm",
    brand: "garmin", cat: "smartwatch", price: 8490000, sale: 6990000, stock: 18, sold: 56, views: 2620,
    published: "2026-01-30", tags: ["chong-nuoc-chuan-ip", "mong-nhe-pin-trau", "hot-deal"],
    blurb: "Pin dài nhất trong kho — hơn 600 giờ ở chế độ đồng hồ, bản nền mặt trời còn lâu hơn nữa.",
    specs: {
      caseSize: [45, "45mm khung polymer đạt chuẩn quân đội MIL-STD-810"], screenType: "MIP đơn sắc luôn hiển thị, đọc rõ dưới nắng gắt",
      batteryLife: [672, "28 ngày chế độ đồng hồ (672 giờ), 30 giờ khi bật GPS"],
      waterResistance: "100m (10 ATM), lặn ống thở được",
      healthFeatures: "Nhịp tim, SpO2, theo dõi giấc ngủ, chỉ số căng thẳng và Body Battery",
    },
    variants: [{ label: "45mm - Xám Graphite", attrs: { Color: "Graphite", Size: "45mm" } },
      { label: "45mm - Xanh Rêu", attrs: { Color: "Moss", Size: "45mm" } }],
  },
  {
    key: "huaweiWatchGt5", name: "Đồng hồ thông minh Huawei Watch GT 5 46mm",
    brand: "huawei", cat: "smartwatch", price: 6490000, sale: 5490000, stock: 26, sold: 92, views: 3480,
    published: "2026-03-17", tags: ["chong-nuoc-chuan-ip", "mong-nhe-pin-trau", "san-pham-moi", "hot-deal"],
    blurb: "Pin hai tuần và dùng được với cả Android lẫn iPhone, hợp cho ai đổi điện thoại thường xuyên.",
    specs: {
      caseSize: [46, "46mm khung thép không gỉ"], screenType: "AMOLED cảm ứng 466x466, có chế độ luôn hiển thị",
      batteryLife: [336, "14 ngày dùng thường (336 giờ), 7 ngày khi bật hết cảm biến"],
      waterResistance: "50m (5 ATM), có chế độ bơi hồ và bơi biển",
      healthFeatures: "Nhịp tim TruSeen 5.5, SpO2, theo dõi giấc ngủ TruSleep, đo căng thẳng và chu kỳ kinh nguyệt",
    },
    variants: [{ label: "46mm - Đen", attrs: { Color: "Black", Size: "46mm" } },
      { label: "41mm - Vàng", attrs: { Color: "Gold", Size: "41mm" }, delta: -500000 }],
  },
  {
    key: "huaweiWatchFit3", name: "Vòng đeo thông minh Huawei Watch Fit 3",
    brand: "huawei", cat: "smartwatch", price: 2990000, sale: 2490000, stock: 46, sold: 186, views: 5620,
    published: "2026-02-26", tags: ["chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Đồng hồ rẻ nhất trong kho, nặng 26g và pin 10 ngày, hợp đeo ngủ để theo dõi giấc ngủ.",
    specs: {
      caseSize: [43, "43mm khung nhôm siêu nhẹ 26g"], screenType: "AMOLED 1.82 inch, sáng tối đa 1500 nits",
      batteryLife: [240, "10 ngày dùng thường (240 giờ)"],
      waterResistance: "50m (5 ATM)",
      healthFeatures: "Nhịp tim, SpO2, theo dõi giấc ngủ và đo mức căng thẳng",
    },
    variants: [{ label: "Xanh Mint", attrs: { Color: "Mint Green" } }, { label: "Xám", attrs: { Color: "Gray" } }],
  },
  {
    key: "xiaomiWatchS3", name: "Đồng hồ thông minh Xiaomi Watch S3 47mm",
    brand: "xiaomi", cat: "smartwatch", price: 3490000, sale: 2890000, stock: 38, sold: 142, views: 4380,
    published: "2026-02-01", tags: ["chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat"],
    blurb: "Vành bezel tháo ra thay được để đổi kiểu dáng, pin 15 ngày ở chế độ cơ bản.",
    specs: {
      caseSize: [47, "47mm khung thép không gỉ, bezel thay được"], screenType: "AMOLED 1.43 inch, sáng tối đa 600 nits",
      batteryLife: [360, "15 ngày chế độ cơ bản (360 giờ), 5 ngày khi bật hết tính năng"],
      waterResistance: "50m (5 ATM)",
      healthFeatures: "Nhịp tim, SpO2, theo dõi giấc ngủ và đo mức căng thẳng",
    },
    variants: [{ label: "47mm - Bạc", attrs: { Color: "Silver", Size: "47mm" } }, { label: "47mm - Đen", attrs: { Color: "Black", Size: "47mm" } }],
  },
  {
    key: "xiaomiSmartBand9", name: "Vòng đeo thông minh Xiaomi Smart Band 9",
    brand: "xiaomi", cat: "smartwatch", price: 1090000, sale: 890000, stock: 72, sold: 386, views: 9240,
    published: "2026-03-19", tags: ["chong-nuoc-chuan-ip", "hot-deal", "ban-chay-nhat", "san-pham-moi"],
    blurb: "Vòng tay dưới 1 triệu, nhẹ 15.8g và pin 21 ngày, hợp đeo tập gym hoặc chạy bộ.",
    specs: {
      caseSize: [46, "46mm thân nhựa siêu nhẹ 15.8g"], screenType: "AMOLED 1.62 inch, sáng tối đa 1200 nits",
      batteryLife: [504, "21 ngày dùng thường (504 giờ)"],
      waterResistance: "50m (5 ATM)",
      healthFeatures: "Nhịp tim, SpO2, theo dõi giấc ngủ và ghi lại 150 chế độ tập",
    },
    variants: [{ label: "Đen", attrs: { Color: "Black" } }, { label: "Trắng Sứ", attrs: { Color: "Porcelain" } }],
  },
  {
    key: "appleWatchUltra2Ti", name: "Đồng hồ thông minh Apple Watch Ultra 2 49mm Titan (GPS + Cellular)",
    brand: "apple", cat: "smartwatch", price: 23990000, sale: 21990000, stock: 8, sold: 18, views: 3240,
    published: "2026-01-18", tags: ["flagship-dinh-cao", "chong-nuoc-chuan-ip", "hot-deal"],
    blurb: "Vỏ titan và màn sáng 3000 nits, có còi báo động 86dB dùng khi leo núi hoặc lặn.",
    specs: {
      caseSize: [49, "49mm khung titan cấp hàng không"], screenType: "LTPO OLED luôn hiển thị, sáng tối đa 3000 nits",
      batteryLife: [36, "36 giờ dùng thường, 72 giờ ở chế độ tiết kiệm pin"],
      waterResistance: "100m (10 ATM), đạt chuẩn EN13319 cho lặn tới 40m",
      healthFeatures: "Nhịp tim, ECG, SpO2, nhiệt độ cổ tay, GPS hai băng tần, còi báo động 86dB",
    },
    variants: [{ label: "49mm Titan - Dây Ocean Xanh", attrs: { Color: "Titanium", Size: "49mm", Connectivity: "GPS + Cellular" } }],
  },
  {
    key: "garminVenu3", name: "Đồng hồ thông minh Garmin Venu 3 45mm",
    brand: "garmin", cat: "smartwatch", price: 11490000, sale: 9990000, stock: 12, sold: 34, views: 2480,
    published: "2026-02-24", tags: ["chong-nuoc-chuan-ip", "mong-nhe-pin-trau", "hot-deal"],
    blurb: "Có loa và micro để nghe gọi qua đồng hồ, kèm phân tích giấc ngủ và huấn luyện ngủ trưa.",
    specs: {
      caseSize: [45, "45mm viền nhôm"], screenType: "AMOLED 1.4 inch cảm ứng, có chế độ luôn hiển thị",
      batteryLife: [336, "14 ngày chế độ đồng hồ (336 giờ), 26 giờ khi bật GPS"],
      waterResistance: "50m (5 ATM)",
      healthFeatures: "Nhịp tim, SpO2, HRV, Body Battery, điểm giấc ngủ và huấn luyện thở",
    },
    variants: [{ label: "45mm - Đen Slate", attrs: { Color: "Slate", Size: "45mm" } }],
  },
];

module.exports = wearables;

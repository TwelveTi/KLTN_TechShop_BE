/**
 * Seed data for Specification Definitions by Category
 */

const specDefinitionsData = [
  // Laptop category specifications
  { categoryKey: "laptop", key: "cpu", name: "Bộ vi xử lý (CPU)", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 1 },
  { categoryKey: "laptop", key: "ram", name: "Dung lượng RAM", dataType: "STRING", unit: "GB", isFilterable: true, isComparable: true, sortOrder: 2 },
  { categoryKey: "laptop", key: "storage", name: "Ổ cứng (SSD)", dataType: "STRING", unit: "GB/TB", isFilterable: true, isComparable: true, sortOrder: 3 },
  { categoryKey: "laptop", key: "gpu", name: "Card đồ họa (GPU)", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 4 },
  { categoryKey: "laptop", key: "screen", name: "Màn hình", dataType: "STRING", unit: "inch", isFilterable: true, isComparable: true, sortOrder: 5 },
  { categoryKey: "laptop", key: "weight", name: "Trọng lượng", dataType: "STRING", unit: "kg", isFilterable: false, isComparable: true, sortOrder: 6 },
  { categoryKey: "laptop", key: "battery", name: "Dung lượng Pin", dataType: "STRING", unit: "Wh", isFilterable: false, isComparable: false, sortOrder: 7 },
  { categoryKey: "laptop", key: "os", name: "Hệ điều hành", dataType: "STRING", unit: null, isFilterable: true, isComparable: false, sortOrder: 8 },

  // Smartphone & Tablet specifications
  { categoryKey: "smartphoneTablet", key: "screen", name: "Màn hình hiển thị", dataType: "STRING", unit: "inch", isFilterable: true, isComparable: true, sortOrder: 1 },
  { categoryKey: "smartphoneTablet", key: "chipset", name: "Vi xử lý (Chipset)", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 2 },
  { categoryKey: "smartphoneTablet", key: "ram", name: "Bộ nhớ RAM", dataType: "STRING", unit: "GB", isFilterable: true, isComparable: true, sortOrder: 3 },
  { categoryKey: "smartphoneTablet", key: "storage", name: "Bộ nhớ trong (ROM)", dataType: "STRING", unit: "GB/TB", isFilterable: true, isComparable: true, sortOrder: 4 },
  { categoryKey: "smartphoneTablet", key: "cameraRear", name: "Camera sau", dataType: "STRING", unit: "MP", isFilterable: false, isComparable: true, sortOrder: 5 },
  { categoryKey: "smartphoneTablet", key: "cameraFront", name: "Camera trước", dataType: "STRING", unit: "MP", isFilterable: false, isComparable: false, sortOrder: 6 },
  { categoryKey: "smartphoneTablet", key: "battery", name: "Dung lượng pin & Sạc", dataType: "STRING", unit: "mAh", isFilterable: false, isComparable: true, sortOrder: 7 },
  { categoryKey: "smartphoneTablet", key: "os", name: "Hệ điều hành", dataType: "STRING", unit: null, isFilterable: true, isComparable: false, sortOrder: 8 },

  // Audio specifications
  { categoryKey: "audio", key: "driverSize", name: "Kích thước màng loa", dataType: "STRING", unit: "mm", isFilterable: false, isComparable: false, sortOrder: 1 },
  { categoryKey: "audio", key: "batteryLife", name: "Thời lượng pin", dataType: "STRING", unit: "giờ", isFilterable: true, isComparable: true, sortOrder: 2 },
  { categoryKey: "audio", key: "bluetoothVersion", name: "Chuẩn Bluetooth", dataType: "STRING", unit: null, isFilterable: true, isComparable: false, sortOrder: 3 },
  { categoryKey: "audio", key: "ancSupport", name: "Chống ồn chủ động (ANC)", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 4 },
  { categoryKey: "audio", key: "waterproofRating", name: "Chuẩn kháng nước", dataType: "STRING", unit: "IP", isFilterable: true, isComparable: true, sortOrder: 5 },

  // Smartwatch specifications
  { categoryKey: "smartwatch", key: "caseSize", name: "Kích thước khung viền", dataType: "STRING", unit: "mm", isFilterable: true, isComparable: true, sortOrder: 1 },
  { categoryKey: "smartwatch", key: "screenType", name: "Loại màn hình", dataType: "STRING", unit: null, isFilterable: false, isComparable: true, sortOrder: 2 },
  { categoryKey: "smartwatch", key: "batteryLife", name: "Thời lượng sử dụng pin", dataType: "STRING", unit: "ngày", isFilterable: true, isComparable: true, sortOrder: 3 },
  { categoryKey: "smartwatch", key: "waterResistance", name: "Khả năng chống nước", dataType: "STRING", unit: "ATM/m", isFilterable: true, isComparable: true, sortOrder: 4 },
  { categoryKey: "smartwatch", key: "healthFeatures", name: "Cảm biến & Sức khỏe", dataType: "STRING", unit: null, isFilterable: false, isComparable: false, sortOrder: 5 },

  // Accessories & Monitor specifications
  { categoryKey: "accessories", key: "panelType", name: "Tấm nền / Loại switch", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 1 },
  { categoryKey: "accessories", key: "resolution", name: "Độ phân giải / DPI", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 2 },
  { categoryKey: "accessories", key: "refreshRate", name: "Tần số quét", dataType: "STRING", unit: "Hz", isFilterable: true, isComparable: true, sortOrder: 3 },
  { categoryKey: "accessories", key: "connectivity", name: "Cổng kết nối", dataType: "STRING", unit: null, isFilterable: true, isComparable: false, sortOrder: 4 },
];

module.exports = specDefinitionsData;

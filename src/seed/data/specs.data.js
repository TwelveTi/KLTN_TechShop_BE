/**
 * Seed data for Specification Definitions by Category
 *
 * `dataType: "NUMBER"` is declared only for keys that are a single measurable
 * quantity on one axis, and `unit` names that axis. Storage is normalised to GB
 * (so 1TB is stored as 1024 and compares against 512), laptop battery is Wh
 * while phone battery is mAh — different categories, different definitions, so
 * the two units never end up on the same axis.
 *
 * Keys left as STRING are deliberate, not overlooked: `cpu` / `gpu` / `chipset`
 * are model names, `waterResistance` mixes metres with ATM, `resolution` mixes
 * mouse DPI with panel resolution, and `driverSize` is absent in mm for half the
 * audio catalogue. A number there would measure nothing.
 *
 * Every NUMBER row in products.data.js carries an explicit `valueNumber` beside
 * its `valueText`. Parsing prose for the figure is not attempted — see
 * src/utils/specValue.js.
 */

const specDefinitionsData = [
  // Laptop category specifications
  { categoryKey: "laptop", key: "cpu", name: "Bộ vi xử lý (CPU)", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 1 },
  { categoryKey: "laptop", key: "ram", name: "Dung lượng RAM", dataType: "NUMBER", unit: "GB", isFilterable: true, isComparable: true, sortOrder: 2 },
  { categoryKey: "laptop", key: "storage", name: "Ổ cứng (SSD)", dataType: "NUMBER", unit: "GB", isFilterable: true, isComparable: true, sortOrder: 3 },
  { categoryKey: "laptop", key: "gpu", name: "Card đồ họa (GPU)", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 4 },
  { categoryKey: "laptop", key: "screen", name: "Màn hình", dataType: "NUMBER", unit: "inch", isFilterable: true, isComparable: true, sortOrder: 5 },
  { categoryKey: "laptop", key: "weight", name: "Trọng lượng", dataType: "NUMBER", unit: "kg", isFilterable: false, isComparable: true, sortOrder: 6 },
  { categoryKey: "laptop", key: "battery", name: "Dung lượng Pin", dataType: "NUMBER", unit: "Wh", isFilterable: false, isComparable: false, sortOrder: 7 },
  { categoryKey: "laptop", key: "os", name: "Hệ điều hành", dataType: "STRING", unit: null, isFilterable: true, isComparable: false, sortOrder: 8 },

  // Smartphone & Tablet specifications
  { categoryKey: "smartphoneTablet", key: "screen", name: "Màn hình hiển thị", dataType: "NUMBER", unit: "inch", isFilterable: true, isComparable: true, sortOrder: 1 },
  { categoryKey: "smartphoneTablet", key: "chipset", name: "Vi xử lý (Chipset)", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 2 },
  { categoryKey: "smartphoneTablet", key: "ram", name: "Bộ nhớ RAM", dataType: "NUMBER", unit: "GB", isFilterable: true, isComparable: true, sortOrder: 3 },
  { categoryKey: "smartphoneTablet", key: "storage", name: "Bộ nhớ trong (ROM)", dataType: "NUMBER", unit: "GB", isFilterable: true, isComparable: true, sortOrder: 4 },
  { categoryKey: "smartphoneTablet", key: "cameraRear", name: "Camera sau", dataType: "STRING", unit: "MP", isFilterable: false, isComparable: true, sortOrder: 5 },
  { categoryKey: "smartphoneTablet", key: "cameraFront", name: "Camera trước", dataType: "STRING", unit: "MP", isFilterable: false, isComparable: false, sortOrder: 6 },
  { categoryKey: "smartphoneTablet", key: "battery", name: "Dung lượng pin & Sạc", dataType: "NUMBER", unit: "mAh", isFilterable: false, isComparable: true, sortOrder: 7 },
  { categoryKey: "smartphoneTablet", key: "os", name: "Hệ điều hành", dataType: "STRING", unit: null, isFilterable: true, isComparable: false, sortOrder: 8 },

  // Audio specifications
  { categoryKey: "audio", key: "driverSize", name: "Kích thước màng loa", dataType: "STRING", unit: "mm", isFilterable: false, isComparable: false, sortOrder: 1 },
  { categoryKey: "audio", key: "batteryLife", name: "Thời lượng pin", dataType: "NUMBER", unit: "giờ", isFilterable: true, isComparable: true, sortOrder: 2 },
  { categoryKey: "audio", key: "bluetoothVersion", name: "Chuẩn Bluetooth", dataType: "STRING", unit: null, isFilterable: true, isComparable: false, sortOrder: 3 },
  { categoryKey: "audio", key: "ancSupport", name: "Chống ồn chủ động (ANC)", dataType: "BOOLEAN", unit: null, isFilterable: true, isComparable: true, sortOrder: 4 },
  { categoryKey: "audio", key: "waterproofRating", name: "Chuẩn kháng nước", dataType: "STRING", unit: "IP", isFilterable: true, isComparable: true, sortOrder: 5 },

  // Smartwatch specifications
  { categoryKey: "smartwatch", key: "caseSize", name: "Kích thước khung viền", dataType: "NUMBER", unit: "mm", isFilterable: true, isComparable: true, sortOrder: 1 },
  { categoryKey: "smartwatch", key: "screenType", name: "Loại màn hình", dataType: "STRING", unit: null, isFilterable: false, isComparable: true, sortOrder: 2 },
  { categoryKey: "smartwatch", key: "batteryLife", name: "Thời lượng sử dụng pin", dataType: "NUMBER", unit: "giờ", isFilterable: true, isComparable: true, sortOrder: 3 },
  { categoryKey: "smartwatch", key: "waterResistance", name: "Khả năng chống nước", dataType: "STRING", unit: "ATM/m", isFilterable: true, isComparable: true, sortOrder: 4 },
  { categoryKey: "smartwatch", key: "healthFeatures", name: "Cảm biến & Sức khỏe", dataType: "STRING", unit: null, isFilterable: false, isComparable: false, sortOrder: 5 },

  // Accessories & Monitor specifications
  { categoryKey: "accessories", key: "panelType", name: "Tấm nền / Loại switch", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 1 },
  { categoryKey: "accessories", key: "resolution", name: "Độ phân giải / DPI", dataType: "STRING", unit: null, isFilterable: true, isComparable: true, sortOrder: 2 },
  { categoryKey: "accessories", key: "refreshRate", name: "Tần số quét", dataType: "NUMBER", unit: "Hz", isFilterable: true, isComparable: true, sortOrder: 3 },
  { categoryKey: "accessories", key: "connectivity", name: "Cổng kết nối", dataType: "STRING", unit: null, isFilterable: true, isComparable: false, sortOrder: 4 },
];

module.exports = specDefinitionsData;

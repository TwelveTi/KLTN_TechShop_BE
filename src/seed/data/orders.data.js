/**
 * Seed data for Orders, OrderItems, OrderStatusHistories, and Payments
 * Spanning over the past 30 days to populate the Admin Revenue Dashboard
 */

const ordersData = [
  // Order 1 - Delivered & Paid (High Value Laptop)
  {
    orderCode: "ORD-20260715-001",
    userKey: "customer1",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "VNPAY",
    createdAt: new Date("2026-07-15T09:15:00Z"),
    paidAt: new Date("2026-07-15T09:20:00Z"),
    shippingFee: 0,
    discountAmount: 500000,
    note: "Giao giờ hành chính, gọi trước 15 phút.",
    items: [
      { productKey: "macbookPro14M3", variantSku: "MBP14-M3PRO-512-SPACEBLACK", quantity: 1, unitPrice: 46990000 },
      { productKey: "logitechMxMaster3S", variantSku: "MXM3S-GRAPHITE", quantity: 1, unitPrice: 1990000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Đơn hàng được khởi tạo thành công", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Thanh toán thành công qua cổng VNPAY", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "PROCESSING", note: "Kho hàng TechShop tiếp nhận và đóng gói sản phẩm", offsetMinutes: 60 },
      { fromStatus: "PROCESSING", toStatus: "SHIPPING", note: "Bàn giao cho đơn vị vận chuyển Viettel Post", offsetMinutes: 360 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Khách hàng đã nhận kiện hàng nguyên vẹn", offsetMinutes: 2880 },
    ],
  },

  // Order 2 - Delivered & Paid (Smartphone Flagship)
  {
    orderCode: "ORD-20260718-002",
    userKey: "customer2",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "MOMO",
    createdAt: new Date("2026-07-18T14:30:00Z"),
    paidAt: new Date("2026-07-18T14:35:00Z"),
    shippingFee: 0,
    discountAmount: 0,
    note: "Giao tận tay người nhận.",
    items: [
      { productKey: "iphone15ProMax", variantSku: "IP15PM-256-NATURAL", quantity: 1, unitPrice: 29990000 },
      { productKey: "airpodsPro2", variantSku: "APP2-USBC-WHITE", quantity: 1, unitPrice: 5390000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Đơn hàng được tạo", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Thanh toán MoMo thành công", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "PROCESSING", note: "Đang kiểm tra và xuất kho", offsetMinutes: 120 },
      { fromStatus: "PROCESSING", toStatus: "SHIPPING", note: "Đang trung chuyển qua bưu cục", offsetMinutes: 600 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Giao hàng thành công", offsetMinutes: 2160 },
    ],
  },

  // Order 3 - Delivered & Paid (Galaxy S24 Ultra & Watch)
  {
    orderCode: "ORD-20260722-003",
    userKey: "customer3",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "VNPAY",
    createdAt: new Date("2026-07-22T10:00:00Z"),
    paidAt: new Date("2026-07-22T10:05:00Z"),
    shippingFee: 0,
    discountAmount: 1000000,
    items: [
      { productKey: "galaxyS24Ultra", variantSku: "S24U-12-256-GRAY", quantity: 1, unitPrice: 28990000 },
      { productKey: "galaxyWatch6Classic", variantSku: "GW6C-47-BLACK", quantity: 1, unitPrice: 6490000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Tạo đơn hàng", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "VNPAY thanh toán thành công", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "PROCESSING", note: "Đóng gói hàng", offsetMinutes: 90 },
      { fromStatus: "PROCESSING", toStatus: "SHIPPING", note: "Đang giao hàng", offsetMinutes: 400 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Giao hàng thành công", offsetMinutes: 1800 },
    ],
  },

  // Order 4 - Delivered & Paid (MacBook Air + Accessories)
  {
    orderCode: "ORD-20260725-004",
    userKey: "customer4",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "COD",
    createdAt: new Date("2026-07-25T16:20:00Z"),
    paidAt: new Date("2026-07-27T11:00:00Z"),
    shippingFee: 30000,
    discountAmount: 200000,
    items: [
      { productKey: "macbookAir13M2", variantSku: "MBA13-M2-256-MIDNIGHT", quantity: 1, unitPrice: 23490000 },
      { productKey: "lowStockSample1", variantSku: "ANKER-100W-BLK", quantity: 1, unitPrice: 1390000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Đơn hàng COD được tạo", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PROCESSING", note: "Nhân viên xác nhận đơn hàng qua điện thoại", offsetMinutes: 30 },
      { fromStatus: "PROCESSING", toStatus: "SHIPPING", note: "Giao cho shipper", offsetMinutes: 300 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Khách nhận hàng và thanh toán tiền mặt cho shipper", offsetMinutes: 2500 },
    ],
  },

  // Order 5 - Delivered & Paid (Gaming Monitor + Peripherals)
  {
    orderCode: "ORD-20260728-005",
    userKey: "customer5",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "VNPAY",
    createdAt: new Date("2026-07-28T11:15:00Z"),
    paidAt: new Date("2026-07-28T11:20:00Z"),
    shippingFee: 50000,
    discountAmount: 0,
    items: [
      { productKey: "lgUltraGearOled27", variantSku: "LG-27GR95QE-B", quantity: 1, unitPrice: 17990000 },
      { productKey: "logitechMxKeysS", variantSku: "MXKEYS-S-GRAPHITE", quantity: 1, unitPrice: 2490000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Tạo đơn", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Đã thanh toán online", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "SHIPPING", note: "Xuất xưởng giao nhanh", offsetMinutes: 180 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Đã giao thành công", offsetMinutes: 1440 },
    ],
  },

  // Order 6 - Delivered & Paid (Audio Equipment)
  {
    orderCode: "ORD-20260801-006",
    userKey: "customer6",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "MOMO",
    createdAt: new Date("2026-08-01T13:40:00Z"),
    paidAt: new Date("2026-08-01T13:45:00Z"),
    shippingFee: 0,
    discountAmount: 300000,
    items: [
      { productKey: "marshallStanmore3", variantSku: "MARSHALL-STAN3-BLK", quantity: 1, unitPrice: 8890000 },
      { productKey: "sonyWh1000Xm5", variantSku: "WH1000XM5-BLACK", quantity: 1, unitPrice: 6990000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Khởi tạo đơn hàng", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Thanh toán thành công", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "SHIPPING", note: "Đang vận chuyển liên tỉnh", offsetMinutes: 200 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Đã ký nhận", offsetMinutes: 2800 },
    ],
  },

  // Order 7 - Delivered & Paid (Apple Watch Ultra 2)
  {
    orderCode: "ORD-20260803-007",
    userKey: "customer7",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "VNPAY",
    createdAt: new Date("2026-08-03T08:30:00Z"),
    paidAt: new Date("2026-08-03T08:35:00Z"),
    shippingFee: 0,
    discountAmount: 500000,
    items: [
      { productKey: "appleWatchUltra2", variantSku: "AW-ULTRA2-ALPINE-ORANGE", quantity: 1, unitPrice: 19490000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Đơn hàng khởi tạo", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Thanh toán thành công", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "SHIPPING", note: "Đang giao hàng hỏa tốc", offsetMinutes: 60 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Khách đã nhận hàng", offsetMinutes: 360 },
    ],
  },

  // Order 8 - Delivered & Paid (Gaming Laptop Legion)
  {
    orderCode: "ORD-20260805-008",
    userKey: "customer8",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "VNPAY",
    createdAt: new Date("2026-08-05T15:00:00Z"),
    paidAt: new Date("2026-08-05T15:05:00Z"),
    shippingFee: 0,
    discountAmount: 1000000,
    items: [
      { productKey: "lenovoLegion5Pro", variantSku: "LEN-LEGION-PRO5-4060", quantity: 1, unitPrice: 38990000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Đơn hàng khởi tạo", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Thanh toán thành công", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "SHIPPING", note: "Bàn giao đơn vị vận chuyển", offsetMinutes: 240 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Giao thành công", offsetMinutes: 2000 },
    ],
  },

  // Order 9 - Delivered & Paid (Dell UltraSharp + Accessories)
  {
    orderCode: "ORD-20260806-009",
    userKey: "customer9",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "COD",
    createdAt: new Date("2026-08-06T10:10:00Z"),
    paidAt: new Date("2026-08-08T09:30:00Z"),
    shippingFee: 40000,
    discountAmount: 0,
    items: [
      { productKey: "dellUltraSharpU2724D", variantSku: "DELL-U2724D-SILVER", quantity: 1, unitPrice: 10490000 },
      { productKey: "logitechMxMaster3S", variantSku: "MXM3S-GRAPHITE", quantity: 1, unitPrice: 1990000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Khởi tạo COD", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PROCESSING", note: "Xác nhận đơn", offsetMinutes: 30 },
      { fromStatus: "PROCESSING", toStatus: "SHIPPING", note: "Đang giao", offsetMinutes: 300 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Giao thành công và thu tiền", offsetMinutes: 2800 },
    ],
  },

  // Order 10 - Delivered & Paid (iPad Pro + AirPods)
  {
    orderCode: "ORD-20260807-010",
    userKey: "customer10",
    status: "DELIVERED",
    paymentStatus: "PAID",
    paymentMethod: "VNPAY",
    createdAt: new Date("2026-08-07T12:00:00Z"),
    paidAt: new Date("2026-08-07T12:05:00Z"),
    shippingFee: 0,
    discountAmount: 500000,
    items: [
      { productKey: "ipadPro129M2", variantSku: "IPAD-PRO129-M2-128-GRAY", quantity: 1, unitPrice: 28490000 },
      { productKey: "airpodsPro2", variantSku: "APP2-USBC-WHITE", quantity: 1, unitPrice: 5390000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Tạo đơn", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Thanh toán thành công", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "SHIPPING", note: "Đang giao hàng", offsetMinutes: 120 },
      { fromStatus: "SHIPPING", toStatus: "DELIVERED", note: "Giao hàng thành công", offsetMinutes: 1440 },
    ],
  },

  // Order 11 - Shipping status (In Transit)
  {
    orderCode: "ORD-20260809-011",
    userKey: "customer1",
    status: "SHIPPING",
    paymentStatus: "PAID",
    paymentMethod: "VNPAY",
    createdAt: new Date("2026-08-09T09:00:00Z"),
    paidAt: new Date("2026-08-09T09:05:00Z"),
    shippingFee: 0,
    discountAmount: 0,
    note: "Giao hàng cẩn thận đồ điện tử dễ vỡ.",
    items: [
      { productKey: "asusZenbook14Oled", variantSku: "ASUS-ZB14-BLUE", quantity: 1, unitPrice: 25990000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Tạo đơn hàng", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Đã thanh toán VNPAY", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "PROCESSING", note: "Đóng gói niêm phong", offsetMinutes: 60 },
      { fromStatus: "PROCESSING", toStatus: "SHIPPING", note: "Đang trên đường giao đến người nhận", offsetMinutes: 300 },
    ],
  },

  // Order 12 - Shipping status (COD in transit)
  {
    orderCode: "ORD-20260809-012",
    userKey: "customer2",
    status: "SHIPPING",
    paymentStatus: "UNPAID",
    paymentMethod: "COD",
    createdAt: new Date("2026-08-09T14:20:00Z"),
    paidAt: null,
    shippingFee: 30000,
    discountAmount: 0,
    items: [
      { productKey: "sonyWf1000Xm5", variantSku: "WF1000XM5-BLACK", quantity: 1, unitPrice: 5790000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Đơn hàng COD", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PROCESSING", note: "Xác thực đơn hàng", offsetMinutes: 20 },
      { fromStatus: "PROCESSING", toStatus: "SHIPPING", note: "Đang chuyển phát nhanh", offsetMinutes: 180 },
    ],
  },

  // Order 13 - Processing status (Paid, Warehouse packing)
  {
    orderCode: "ORD-20260810-013",
    userKey: "customer3",
    status: "PROCESSING",
    paymentStatus: "PAID",
    paymentMethod: "MOMO",
    createdAt: new Date("2026-08-10T11:00:00Z"),
    paidAt: new Date("2026-08-10T11:05:00Z"),
    shippingFee: 0,
    discountAmount: 0,
    items: [
      { productKey: "xiaomi14Pro", variantSku: "MI14PRO-16-512-BLACK", quantity: 1, unitPrice: 19990000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Khởi tạo đơn hàng", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Thanh toán MoMo thành công", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "PROCESSING", note: "Kho TechShop đang chuẩn bị hàng hóa", offsetMinutes: 40 },
    ],
  },

  // Order 14 - Pending status (Awaiting Payment / Order confirmation)
  {
    orderCode: "ORD-20260811-014",
    userKey: "customer4",
    status: "PENDING",
    paymentStatus: "UNPAID",
    paymentMethod: "COD",
    createdAt: new Date("2026-08-11T07:30:00Z"),
    paidAt: null,
    shippingFee: 30000,
    discountAmount: 0,
    items: [
      { productKey: "dellInspiron14", variantSku: "DELL-INS14-SILVER", quantity: 1, unitPrice: 17490000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Đơn hàng vừa được đặt trên website", offsetMinutes: 0 },
    ],
  },

  // Order 15 - Cancelled status (Customer changed mind)
  {
    orderCode: "ORD-20260802-015",
    userKey: "customer5",
    status: "CANCELLED",
    paymentStatus: "UNPAID",
    paymentMethod: "COD",
    createdAt: new Date("2026-08-02T10:00:00Z"),
    cancelledAt: new Date("2026-08-02T11:30:00Z"),
    shippingFee: 0,
    discountAmount: 0,
    note: "Khách hàng đổi ý muốn đổi sang màu khác.",
    items: [
      { productKey: "iphone15ProMax", variantSku: "IP15PM-256-BLUE", quantity: 1, unitPrice: 29990000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Đơn hàng được tạo", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "CANCELLED", note: "Khách hàng hủy đơn qua hệ thống", offsetMinutes: 90 },
    ],
  },

  // Order 16 - Refunded status (Customer returned product)
  {
    orderCode: "ORD-20260720-016",
    userKey: "customer6",
    status: "REFUNDED",
    paymentStatus: "REFUNDED",
    paymentMethod: "VNPAY",
    createdAt: new Date("2026-07-20T08:00:00Z"),
    paidAt: new Date("2026-07-20T08:05:00Z"),
    cancelledAt: new Date("2026-07-22T14:00:00Z"),
    shippingFee: 0,
    discountAmount: 0,
    note: "Sản phẩm bị lỗi kỹ thuật, đã hoàn tiền 100% qua tài khoản ngân hàng.",
    items: [
      { productKey: "marshallStanmore3", variantSku: "MARSHALL-STAN3-CRM", quantity: 1, unitPrice: 8890000 },
    ],
    history: [
      { fromStatus: null, toStatus: "PENDING", note: "Tạo đơn", offsetMinutes: 0 },
      { fromStatus: "PENDING", toStatus: "PAID", note: "Thanh toán thành công", offsetMinutes: 5 },
      { fromStatus: "PAID", toStatus: "REFUNDED", note: "Đã xử lý hoàn tiền toàn phần cho khách hàng", offsetMinutes: 3200 },
    ],
  },
];

module.exports = ordersData;

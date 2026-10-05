/**
 * Voucher mẫu cho demo checkout. Mỗi mã minh hoạ một luật của discountService:
 * trần giảm của mã %, đơn tối thiểu, giới hạn lượt dùng, mã hết hạn, mã tạm dừng.
 *
 * Ngày ghi theo số ngày tính từ lúc seed, để mã còn hạn tới kỳ bảo vệ tháng 12.
 */
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days) => new Date(Date.now() + days * DAY);

module.exports = [
  {
    code: "WELCOME10",
    name: "Chào bạn mới, giảm 10%",
    description: "Giảm 10% tối đa 500.000đ cho đơn từ 1 triệu, mỗi tài khoản dùng một lần.",
    discountType: "PERCENT",
    value: 10,
    maxDiscountAmount: 500000,
    minOrderValue: 1000000,
    usageLimit: null,
    usageLimitPerUser: 1,
    startsAt: daysFromNow(-1),
    endsAt: daysFromNow(180),
    status: "ACTIVE",
  },
  {
    code: "TECH500K",
    name: "Giảm thẳng 500.000đ",
    description: "Giảm 500.000đ cho đơn từ 10 triệu, toàn shop có 100 lượt.",
    discountType: "FIXED",
    value: 500000,
    maxDiscountAmount: null,
    minOrderValue: 10000000,
    usageLimit: 100,
    usageLimitPerUser: null,
    startsAt: daysFromNow(-1),
    endsAt: daysFromNow(180),
    status: "ACTIVE",
  },
  {
    code: "FLASH20",
    name: "Flash sale 20%",
    description: "Giảm 20% tối đa 2 triệu cho đơn từ 20 triệu, chỉ 10 lượt, mỗi tài khoản một lần.",
    discountType: "PERCENT",
    value: 20,
    maxDiscountAmount: 2000000,
    minOrderValue: 20000000,
    usageLimit: 10,
    usageLimitPerUser: 1,
    startsAt: daysFromNow(-1),
    endsAt: daysFromNow(180),
    status: "ACTIVE",
  },
  {
    code: "SUMMER15",
    name: "Hè 2026, đã hết hạn",
    description: "Mã đã hết hạn, dùng để thử thông báo từ chối ở checkout.",
    discountType: "PERCENT",
    value: 15,
    maxDiscountAmount: 1000000,
    minOrderValue: 0,
    usageLimit: null,
    usageLimitPerUser: null,
    startsAt: daysFromNow(-120),
    endsAt: daysFromNow(-30),
    status: "EXPIRED",
  },
  {
    code: "PAUSED5",
    name: "Giảm 5%, đang tạm dừng",
    description: "Mã tạm dừng, dùng để thử thông báo từ chối ở checkout.",
    discountType: "PERCENT",
    value: 5,
    maxDiscountAmount: 300000,
    minOrderValue: 0,
    usageLimit: null,
    usageLimitPerUser: null,
    startsAt: daysFromNow(-1),
    endsAt: daysFromNow(180),
    status: "PAUSED",
  },
];

const AppError = require("../utils/AppError");
const discountRepository = require("../repositories/discountRepository");
const pricing = require("../utils/pricing");

const DISCOUNT_STATUSES = ["ACTIVE", "PAUSED", "EXPIRED"];

// Voucher codes.
//
// One function — `evaluate()` — decides whether a code applies and how much it
// takes off. Both the checkout preview and the authoritative apply-at-order-time
// path go through it, so the amount a shopper is quoted is computed by the same
// rules that charge them. (Same reasoning as utils/pricing being shared between
// the cart and order creation.)
class DiscountService {
  normalizeCode(code) {
    return String(code || "").trim().toUpperCase();
  }

  // Pure: given a discount row and a subtotal, how much comes off.
  // Never more than the subtotal — a voucher may take an order to zero, never
  // below it, and must never eat into the shipping fee.
  computeAmount(discount, subtotal) {
    const value = pricing.toNumber(discount.value);
    let amount;

    if (discount.discountType === "PERCENT") {
      amount = (subtotal * value) / 100;

      const cap = discount.maxDiscountAmount === null ? null : pricing.toNumber(discount.maxDiscountAmount);
      if (cap !== null && cap > 0 && amount > cap) {
        amount = cap;
      }
    } else {
      amount = value;
    }

    return pricing.roundMoney(Math.max(0, Math.min(amount, subtotal)));
  }

  // Every reason a code can be refused, in one place. `now` is injected so the
  // window check is testable.
  assertUsable(discount, { subtotal, activeUsesByUser, now = new Date() }) {
    if (!discount) {
      throw new AppError("Discount code not found", 404);
    }

    if (discount.status !== "ACTIVE") {
      throw new AppError("This discount code is not active", 409);
    }

    if (now < new Date(discount.startsAt)) {
      throw new AppError("This discount code is not active yet", 409);
    }

    if (now > new Date(discount.endsAt)) {
      throw new AppError("This discount code has expired", 409);
    }

    const minOrderValue = pricing.toNumber(discount.minOrderValue);
    if (subtotal < minOrderValue) {
      throw new AppError(
        `This code requires an order of at least ${Math.round(minOrderValue).toLocaleString("vi-VN")} d`,
        409,
      );
    }

    if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
      throw new AppError("This discount code has been fully redeemed", 409);
    }

    if (discount.usageLimitPerUser !== null && activeUsesByUser >= discount.usageLimitPerUser) {
      throw new AppError("You have already used this discount code", 409);
    }
  }

  /**
   * Resolve a code for a given user and subtotal.
   *
   * `transaction` + `lock` are passed by order creation so the row is held for
   * the life of that transaction; the preview path calls without them.
   */
  async evaluate(code, { userId, subtotal, transaction = null, lock = false, now = new Date() }) {
    const normalized = this.normalizeCode(code);

    if (!normalized) {
      throw new AppError("Discount code is required", 400);
    }

    const discount = await discountRepository.findByCode(normalized, { transaction, lock });

    if (!discount) {
      throw new AppError("Discount code not found", 404);
    }

    const activeUsesByUser =
      discount.usageLimitPerUser === null
        ? 0
        : await discountRepository.countActiveUsagesByUser(discount.id, userId, { transaction });

    this.assertUsable(discount, { subtotal, activeUsesByUser, now });

    return { discount, discountAmount: this.computeAmount(discount, subtotal) };
  }

  // Checkout preview. Deliberately does NOT reserve anything: the code could
  // still be exhausted by someone else before the order is placed, exactly like
  // stock. Order creation stays the only source of truth.
  async previewForUser(userId, code, subtotal) {
    const amount = pricing.roundMoney(subtotal);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("A positive order subtotal is required", 400);
    }

    const { discount, discountAmount } = await this.evaluate(code, { userId, subtotal: amount });

    return {
      code: discount.code,
      name: discount.name,
      discountType: discount.discountType,
      value: pricing.toNumber(discount.value),
      subtotal: amount,
      discountAmount,
      payable: pricing.roundMoney(amount - discountAmount),
    };
  }

  /**
   * Apply a code inside the order-creation transaction.
   *
   * Called by orderService with its own transaction so the voucher row lock,
   * the usage row and the order all commit or roll back together.
   */
  async applyToOrder({ code, userId, subtotal, transaction }) {
    const { discount, discountAmount } = await this.evaluate(code, {
      userId,
      subtotal,
      transaction,
      lock: true,
    });

    return {
      discount,
      discountAmount,
      // Deferred because the order id does not exist yet at validation time.
      commit: async (orderId) => {
        await discountRepository.createUsage(
          { discountId: discount.id, userId, orderId, discountAmount },
          { transaction },
        );
        await discountRepository.incrementUsedCount(discount, 1, { transaction });
      },
    };
  }

  // Cancelling an order hands the redemption back, the same way stock is
  // returned. Without this a cancelled order silently burns the shopper's code.
  async releaseForOrder(orderId, transaction) {
    const usages = await discountRepository.findActiveUsagesByOrder(orderId, { transaction });

    for (const usage of usages) {
      // Locked because usedCount is the contended counter, same as at redemption.
      const discount = await discountRepository.findById(usage.discountId, { transaction, lock: true });

      await discountRepository.updateUsage(usage, { releasedAt: new Date() }, { transaction });

      if (discount && discount.usedCount > 0) {
        await discountRepository.decrementUsedCount(discount, 1, { transaction });
      }
    }

    return usages.length;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  buildPagination(query) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);

    return { page, limit, offset: (page - 1) * limit };
  }

  async getAll(query = {}) {
    const { page, limit, offset } = this.buildPagination(query);
    const where = {};

    if (query.status && DISCOUNT_STATUSES.includes(query.status)) {
      where.status = query.status;
    }

    const { rows, count } = await discountRepository.findAndCountAll({ where, limit, offset });

    return {
      items: rows,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
    };
  }

  assertWindow(startsAt, endsAt) {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new AppError("endsAt must be after startsAt", 400);
    }
  }

  assertShape(payload) {
    if (payload.discountType === "PERCENT" && pricing.toNumber(payload.value) > 100) {
      throw new AppError("A percentage discount cannot exceed 100", 400);
    }
  }

  async create(payload) {
    const code = this.normalizeCode(payload.code);
    const existing = await discountRepository.findByCode(code);

    if (existing) {
      throw new AppError("A discount with this code already exists", 409);
    }

    this.assertWindow(payload.startsAt, payload.endsAt);
    this.assertShape(payload);

    return discountRepository.create({
      code,
      name: payload.name,
      description: payload.description || null,
      discountType: payload.discountType,
      value: payload.value,
      maxDiscountAmount: payload.maxDiscountAmount ?? null,
      minOrderValue: payload.minOrderValue ?? 0,
      usageLimit: payload.usageLimit ?? null,
      usageLimitPerUser: payload.usageLimitPerUser ?? null,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      status: payload.status || "ACTIVE",
    });
  }

  async update(id, payload) {
    const discount = await discountRepository.findById(id);

    if (!discount) {
      throw new AppError("Discount not found", 404);
    }

    const changes = {};

    if (payload.code !== undefined) {
      const code = this.normalizeCode(payload.code);
      const clash = await discountRepository.findByCode(code);

      if (clash && clash.id !== discount.id) {
        throw new AppError("A discount with this code already exists", 409);
      }

      changes.code = code;
    }

    [
      "name",
      "description",
      "discountType",
      "value",
      "maxDiscountAmount",
      "minOrderValue",
      "usageLimit",
      "usageLimitPerUser",
      "startsAt",
      "endsAt",
      "status",
    ].forEach((field) => {
      if (payload[field] !== undefined) {
        changes[field] = payload[field];
      }
    });

    const startsAt = changes.startsAt ?? discount.startsAt;
    const endsAt = changes.endsAt ?? discount.endsAt;
    this.assertWindow(startsAt, endsAt);
    this.assertShape({
      discountType: changes.discountType ?? discount.discountType,
      value: changes.value ?? discount.value,
    });

    // Lowering the cap below what has already been redeemed would make
    // `usedCount >= usageLimit` permanently true in a confusing way; refuse it
    // rather than silently disabling the code.
    if (changes.usageLimit !== undefined && changes.usageLimit !== null && changes.usageLimit < discount.usedCount) {
      throw new AppError(`usageLimit cannot be below the ${discount.usedCount} redemption(s) already made`, 409);
    }

    await discountRepository.update(discount, changes);

    return discountRepository.findById(discount.id);
  }

  async remove(id) {
    const discount = await discountRepository.findById(id);

    if (!discount) {
      throw new AppError("Discount not found", 404);
    }

    const used = await discountRepository.countUsages(discount.id);

    if (used > 0) {
      // Orders reference this row for their discount history. Pause it instead
      // so the past stays readable.
      throw new AppError(
        `This code has been used by ${used} order(s) and cannot be deleted. Set its status to PAUSED instead.`,
        409,
      );
    }

    await discountRepository.destroy(discount);

    return { id: discount.id };
  }
}

module.exports = new DiscountService();

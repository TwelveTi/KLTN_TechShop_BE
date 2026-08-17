const AppError = require("../utils/AppError");
const paymentRepository = require("../repositories/paymentRepository");
const vnpayConfig = require("../configs/vnpayConfig");
const vnpay = require("../utils/vnpay");
const pricing = require("../utils/pricing");
const logger = require("../utils/logger");

// Statuses an order may still be paid from. Anything else is either already
// settled or no longer payable.
const PAYABLE_ORDER_STATUSES = ["PENDING"];

class PaymentService {
  assertEnabled() {
    if (!vnpayConfig.ENABLED) {
      throw new AppError("Online payment is not configured on this server", 503);
    }
  }

  // vnp_TxnRef must be unique per attempt, not per order: retrying a failed
  // payment on the same order needs a reference the gateway has not seen.
  buildTransactionRef(orderCode, attempt) {
    const base = String(orderCode).replace(/[^a-zA-Z0-9]/g, "");
    return `${base}${String(attempt).padStart(2, "0")}`;
  }

  // Everything here runs under a row lock on the order, so a customer hammering
  // the pay button cannot start several gateway transactions at once, and
  // cannot be handed a payment URL for an order that is being marked paid by an
  // in-flight return/IPN.
  async createVnpayUrl(userId, orderId, { ipAddress, locale } = {}) {
    this.assertEnabled();

    // Ownership is checked before the lock so another user's order id cannot be
    // used to hold a lock on it.
    const owned = await paymentRepository.findOrderByIdForUser(orderId, userId);

    if (!owned) {
      throw new AppError("Order not found", 404);
    }

    const transaction = await paymentRepository.beginTransaction();

    try {
      const order = await paymentRepository.findOrderById(orderId, { transaction, lock: true });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      if (order.paymentStatus === "PAID") {
        throw new AppError("Order has already been paid", 409);
      }

      if (!PAYABLE_ORDER_STATUSES.includes(order.status)) {
        throw new AppError(`A ${order.status} order can no longer be paid`, 409);
      }

      const amount = pricing.roundMoney(order.totalPrice);

      if (amount <= 0) {
        throw new AppError("Order total must be greater than zero", 409);
      }

      const result = await this.resolveAttempt(order, amount, transaction);

      await transaction.commit();

      return this.buildUrlForAttempt(order, amount, result, { ipAddress, locale });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Re-use the open attempt when there is one, otherwise start a new one. Both
  // decisions are made under the order lock taken by the caller.
  async resolveAttempt(order, amount, transaction) {
    const now = new Date();
    const notBefore = new Date(now.getTime() - vnpayConfig.EXPIRE_MINUTES * 60 * 1000);

    const reusable = await paymentRepository.findReusablePayment(order.id, "VNPAY", notBefore, {
      transaction,
    });

    if (reusable) {
      // Same gateway transaction, same expiry window as the URL handed out the
      // first time: repeated clicks lead the customer to one payment, not five.
      return {
        transactionCode: reusable.transactionCode,
        createdAt: reusable.createdAt,
        reused: true,
      };
    }

    const attempt = (await paymentRepository.countPaymentsForOrder(order.id, "VNPAY", { transaction })) + 1;
    const transactionCode = this.buildTransactionRef(order.orderCode, attempt);

    await paymentRepository.createPayment(
      {
        orderId: order.id,
        paymentMethod: "VNPAY",
        amount,
        status: "PENDING",
        transactionCode,
      },
      { transaction },
    );

    return { transactionCode, createdAt: now, reused: false };
  }

  buildUrlForAttempt(order, amount, attempt, { ipAddress, locale } = {}) {
    const { transactionCode, createdAt } = attempt;
    const now = new Date(createdAt);
    const expiresAt = new Date(now.getTime() + vnpayConfig.EXPIRE_MINUTES * 60 * 1000);

    const params = {
      vnp_Version: vnpayConfig.VERSION,
      vnp_Command: vnpayConfig.COMMAND,
      vnp_TmnCode: vnpayConfig.TMN_CODE,
      vnp_Amount: Math.round(amount * vnpayConfig.AMOUNT_MULTIPLIER),
      vnp_CurrCode: vnpayConfig.CURR_CODE,
      vnp_TxnRef: transactionCode,
      vnp_OrderInfo: vnpay.sanitizeOrderInfo(`Thanh toan don hang ${order.orderCode}`),
      vnp_OrderType: vnpayConfig.ORDER_TYPE,
      vnp_Locale: locale === "en" ? "en" : vnpayConfig.LOCALE,
      // Always the server's own endpoint, never a client-supplied URL: the
      // return has to be signature-checked here before the browser is sent on,
      // and honouring a caller-chosen address would be an open redirect.
      vnp_ReturnUrl: vnpayConfig.RETURN_URL,
      vnp_IpAddr: vnpay.normalizeIp(ipAddress),
      vnp_CreateDate: vnpay.formatDate(now),
      vnp_ExpireDate: vnpay.formatDate(expiresAt),
    };

    return {
      paymentUrl: vnpay.buildPaymentUrl(params),
      orderCode: order.orderCode,
      transactionCode,
      expiresAt,
      // True when this click re-used an attempt that was already open.
      reused: attempt.reused,
    };
  }

  // Shared by the browser return and the server-to-server IPN. Both carry the
  // same signed payload, and both are safe to run twice: the second call finds
  // the payment already settled and changes nothing.
  async settleVnpayResult(query) {
    if (!vnpayConfig.ENABLED) {
      return { ok: false, reason: "not_configured", ipn: vnpayConfig.IPN_RESPONSE.UNKNOWN_ERROR };
    }

    if (!vnpay.verifySignature(query)) {
      return { ok: false, reason: "invalid_signature", ipn: vnpayConfig.IPN_RESPONSE.INVALID_SIGNATURE };
    }

    const transactionCode = String(query.vnp_TxnRef || "");

    if (!transactionCode) {
      return { ok: false, reason: "missing_reference", ipn: vnpayConfig.IPN_RESPONSE.ORDER_NOT_FOUND };
    }

    const transaction = await paymentRepository.beginTransaction();

    try {
      const payment = await paymentRepository.findPaymentByTransactionCode(transactionCode, {
        transaction,
        lock: true,
      });

      if (!payment) {
        await transaction.rollback();
        return { ok: false, reason: "payment_not_found", ipn: vnpayConfig.IPN_RESPONSE.ORDER_NOT_FOUND };
      }

      const order = await paymentRepository.findOrderById(payment.orderId, { transaction, lock: true });

      if (!order) {
        await transaction.rollback();
        return { ok: false, reason: "order_not_found", ipn: vnpayConfig.IPN_RESPONSE.ORDER_NOT_FOUND };
      }

      // The amount is signed, so a mismatch means the order changed underneath
      // the payment rather than that someone tampered with it. Either way it
      // must not be accepted as settlement.
      const expectedAmount = Math.round(pricing.roundMoney(order.totalPrice) * vnpayConfig.AMOUNT_MULTIPLIER);

      if (Number(query.vnp_Amount) !== expectedAmount) {
        await transaction.rollback();
        return {
          ok: false,
          reason: "amount_mismatch",
          order,
          ipn: vnpayConfig.IPN_RESPONSE.INVALID_AMOUNT,
        };
      }

      // Replay: the browser return and the IPN both arrive for a successful
      // payment, and the customer may refresh the return page.
      if (payment.status !== "PENDING") {
        await transaction.rollback();
        return {
          ok: payment.status === "SUCCESS",
          reason: "already_settled",
          order,
          payment,
          ipn: vnpayConfig.IPN_RESPONSE.ALREADY_CONFIRMED,
        };
      }

      const succeeded =
        String(query.vnp_ResponseCode) === vnpayConfig.RESPONSE_CODE.SUCCESS &&
        String(query.vnp_TransactionStatus) === vnpayConfig.RESPONSE_CODE.SUCCESS;

      if (!succeeded) {
        await this.applyFailure(order, payment, query, transaction);
        await transaction.commit();

        return {
          ok: false,
          reason: `gateway_${query.vnp_ResponseCode}`,
          order,
          payment,
          ipn: vnpayConfig.IPN_RESPONSE.SUCCESS,
        };
      }

      // A different attempt on this order already succeeded. The customer has
      // genuinely been charged twice — VNPay took both — so this one is
      // recorded and flagged for refund, but the order's totals, timestamps
      // and sold counts must NOT be applied a second time.
      const alreadySettled = await paymentRepository.findSettledPaymentForOrder(order.id, payment.id, {
        transaction,
      });

      if (alreadySettled) {
        await this.applyDuplicateSuccess(order, payment, alreadySettled, query, transaction);
        await transaction.commit();

        logger.error("Duplicate successful VNPay payment on an order that was already paid", {
          orderId: order.id,
          orderCode: order.orderCode,
          settledTransactionCode: alreadySettled.transactionCode,
          duplicateTransactionCode: payment.transactionCode,
          vnpTransactionNo: query.vnp_TransactionNo,
        });

        return {
          ok: true,
          reason: "duplicate_payment",
          order,
          payment,
          ipn: vnpayConfig.IPN_RESPONSE.ALREADY_CONFIRMED,
        };
      }

      await this.applySuccess(order, payment, query, transaction);

      await transaction.commit();

      return {
        ok: true,
        reason: "paid",
        order,
        payment,
        ipn: vnpayConfig.IPN_RESPONSE.SUCCESS,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async applySuccess(order, payment, query, transaction) {
    const paidAt = new Date();

    await paymentRepository.updatePayment(
      payment,
      { status: "SUCCESS", paidAt, providerPayload: query },
      { transaction },
    );

    const fromStatus = order.status;

    await paymentRepository.updateOrder(
      order,
      { status: "PAID", paymentStatus: "PAID", paidAt },
      { transaction },
    );

    await paymentRepository.createStatusHistory(
      {
        orderId: order.id,
        fromStatus,
        toStatus: "PAID",
        note: `VNPay transaction ${query.vnp_TransactionNo || payment.transactionCode}`,
        changedBy: null,
      },
      { transaction },
    );

    // soldCount drives the "best sellers" figures, so it only moves on money
    // actually received — not when the order was placed.
    const detailed = await paymentRepository.findOrderByIdWithItems(order.id, { transaction });

    for (const item of detailed.items || []) {
      if (!item.productId) {
        continue;
      }

      const product = await paymentRepository.findProductForUpdate(item.productId, { transaction });

      if (product) {
        await paymentRepository.incrementProductSoldCount(product, item.quantity, { transaction });
      }
    }
  }

  // Money that arrived for an order that was already paid. Recorded as a real
  // SUCCESS (it is real money) but deliberately inert on the order itself, and
  // written into the status history so the admin console shows a refund is owed.
  async applyDuplicateSuccess(order, payment, alreadySettled, query, transaction) {
    await paymentRepository.updatePayment(
      payment,
      {
        status: "SUCCESS",
        paidAt: new Date(),
        providerPayload: { ...query, duplicateOf: alreadySettled.transactionCode, refundRequired: true },
      },
      { transaction },
    );

    await paymentRepository.createStatusHistory(
      {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        note:
          `DUPLICATE PAYMENT - refund required. VNPay transaction ` +
          `${query.vnp_TransactionNo || payment.transactionCode} was paid after ` +
          `${alreadySettled.transactionCode} had already settled this order.`,
        changedBy: null,
      },
      { transaction },
    );
  }

  // A failed or cancelled attempt does NOT release the reserved stock and does
  // not cancel the order: the customer can start another attempt, or switch to
  // COD. Stock comes back when the order itself is cancelled.
  async applyFailure(order, payment, query, transaction) {
    const cancelledByUser = String(query.vnp_ResponseCode) === vnpayConfig.RESPONSE_CODE.CANCELLED;

    await paymentRepository.updatePayment(
      payment,
      {
        status: cancelledByUser ? "CANCELLED" : "FAILED",
        providerPayload: query,
      },
      { transaction },
    );

    await paymentRepository.updateOrder(order, { paymentStatus: "FAILED" }, { transaction });
  }

  // Where the browser is sent once the result is settled.
  buildRedirectUrl(result) {
    const base = result.ok
      ? vnpayConfig.FRONTEND_RESULT_URL.SUCCESS
      : vnpayConfig.FRONTEND_RESULT_URL.FAILED;

    const params = new URLSearchParams();

    if (result.order?.orderCode) {
      params.set("orderCode", result.order.orderCode);
    }

    if (result.order?.id) {
      params.set("orderId", result.order.id);
    }

    if (!result.ok && result.reason) {
      params.set("reason", result.reason);
    }

    const query = params.toString();

    return query ? `${base}?${query}` : base;
  }
}

module.exports = new PaymentService();

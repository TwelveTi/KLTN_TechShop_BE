const paymentService = require("../services/paymentService");
const vnpayConfig = require("../configs/vnpayConfig");
const APIResponse = require("../utils/ApiResponse");
const logger = require("../utils/logger");

class PaymentController {
  async createVnpayUrl(req, res) {
    const result = await paymentService.createVnpayUrl(req.user.id, req.body.orderId, {
      ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || req.ip,
      locale: req.body.locale,
    });

    return APIResponse.success(res, "Payment URL created successfully", result);
  }

  // Browser redirect target. VNPay sends the customer here after the payment
  // page; the signature is verified before anything is trusted, then the
  // customer is forwarded to the frontend result page.
  async vnpayReturn(req, res) {
    let result;

    try {
      result = await paymentService.settleVnpayResult(req.query);
    } catch (error) {
      // Never leave the customer on a blank error page — log it and send them
      // to the failure screen, where the order is still visible and retryable.
      logger.error("Failed to settle the VNPay return", {
        error: logger.serializeError(error),
        txnRef: req.query?.vnp_TxnRef,
      });
      result = { ok: false, reason: "internal_error" };
    }

    return res.redirect(paymentService.buildRedirectUrl(result));
  }

  // Server-to-server confirmation. VNPay keeps retrying until it receives a
  // 200 with RspCode "00", so the response body is part of the contract and
  // must not be wrapped in the usual APIResponse envelope.
  async vnpayIpn(req, res) {
    try {
      const result = await paymentService.settleVnpayResult(req.query);

      return res.status(200).json(result.ipn);
    } catch (error) {
      logger.error("Failed to settle the VNPay IPN", {
        error: logger.serializeError(error),
        txnRef: req.query?.vnp_TxnRef,
      });

      // Answer with the retryable "unknown error" code so VNPay calls again
      // once the underlying problem (usually the database) is back.
      return res.status(200).json(vnpayConfig.IPN_RESPONSE.UNKNOWN_ERROR);
    }
  }
}

module.exports = new PaymentController();

class APIResponse {
  static success(res, message = "Success", data = null, code = 200) {
    return res.status(code).json({
      code,
      message,
      data,
    });
  }

  static error(res, message = "Error", code = 500, meta = {}) {
    return res.status(code).json({
      code,
      message,
      ...meta,
    });
  }
}

module.exports = APIResponse;

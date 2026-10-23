const logger = require("../utils/logger");
const uploadService = require("../services/uploadService");

// Dọn ảnh admin vừa tải lên khi lệnh tạo sản phẩm bị từ chối, để không sót ảnh mồ côi trên Cloudinary.
// Chỉ chạy khi request đã được xác thực là ADMIN: trước đây người lạ gửi publicId bất kỳ là xoá được ảnh.
async function cleanupRejectedProductCreate(req, reason) {
  if (req.method !== "POST" || req.originalUrl !== "/api/v1/admin/products") {
    return;
  }

  if (req.user?.role !== "ADMIN") {
    return;
  }

  const publicIds = Array.isArray(req.body?.images)
    ? req.body.images.map((image) => image?.publicId).filter(uploadService.isProductImagePublicId)
    : [];

  if (!publicIds.length) {
    return;
  }

  logger.warn("Cleaning up uploaded images after rejected product create", {
    requestId: req.requestId,
    reason,
    publicIds,
  });

  await uploadService.deleteMany(publicIds, { requestId: req.requestId });
}

module.exports = { cleanupRejectedProductCreate };

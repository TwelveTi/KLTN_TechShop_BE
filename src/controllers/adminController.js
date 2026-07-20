const adminService = require("../services/adminService");
const adminAnalyticsService = require("../services/adminAnalyticsService");
const uploadService = require("../services/uploadService");
const APIResponse = require("../utils/ApiResponse");
const logger = require("../utils/logger");

class AdminController {
  async getAllUsers(req, res) {
    const result = await adminService.getAllUsers(req.query);
    return APIResponse.success(res, "Get users successfully", result);
  }

  async getUserById(req, res) {
    const user = await adminService.getUserById(req.params.id);
    return APIResponse.success(res, "Get user successfully", user);
  }

  async createUser(req, res) {
    const user = await adminService.createUser(req.body);
    return APIResponse.success(res, "User created successfully", user, 201);
  }

  async updateUser(req, res) {
    const user = await adminService.updateUser(req.params.id, req.body);
    return APIResponse.success(res, "User updated successfully", user);
  }

  async deleteUser(req, res) {
    const result = await adminService.deleteUser(req.params.id);
    return APIResponse.success(res, result.message);
  }

  async getAllCategories(req, res) {
    const categories = await adminService.getAllCategories();
    return APIResponse.success(res, "Get categories successfully", categories);
  }

  async createCategory(req, res) {
    const category = await adminService.createCategory(req.body);
    return APIResponse.success(res, "Category created successfully", category, 201);
  }

  async updateCategory(req, res) {
    const category = await adminService.updateCategory(req.params.id, req.body);
    return APIResponse.success(res, "Category updated successfully", category);
  }

  async deleteCategory(req, res) {
    const result = await adminService.deleteCategory(req.params.id);
    return APIResponse.success(res, result.message);
  }

  async getAllBrands(req, res) {
    const brands = await adminService.getAllBrands();
    return APIResponse.success(res, "Get brands successfully", brands);
  }

  async createBrand(req, res) {
    const brand = await adminService.createBrand(req.body);
    return APIResponse.success(res, "Brand created successfully", brand, 201);
  }

  async updateBrand(req, res) {
    const brand = await adminService.updateBrand(req.params.id, req.body);
    return APIResponse.success(res, "Brand updated successfully", brand);
  }

  async deleteBrand(req, res) {
    const result = await adminService.deleteBrand(req.params.id);
    return APIResponse.success(res, result.message);
  }

  async uploadProductImages(req, res) {
    const rollbackPublicIds = uploadService.parsePublicIds(req.body.rollbackPublicIds);

    logger.info("Product image upload request received", {
      requestId: req.requestId,
      fileCount: req.files?.length || 0,
      rollbackCount: rollbackPublicIds.length,
      files: (req.files || []).map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      })),
    });

    const images = await uploadService.uploadProductImages(req.files, rollbackPublicIds, {
      requestId: req.requestId,
    });

    logger.info("Product image upload request completed", {
      requestId: req.requestId,
      imageCount: images.length,
      publicIds: images.map((image) => image.publicId),
    });

    return APIResponse.success(res, "Images uploaded successfully", images, 201);
  }

  async deleteUploadedImage(req, res) {
    await uploadService.deleteOne(req.body.publicId);
    return APIResponse.success(res, "Image deleted successfully");
  }

  async getRevenueSummary(req, res) {
    const result = await adminAnalyticsService.getRevenueSummary(req.query);
    return APIResponse.success(res, "Get revenue summary successfully", result);
  }

  async getDailyRevenue(req, res) {
    const result = await adminAnalyticsService.getDailyRevenue(req.query);
    return APIResponse.success(res, "Get daily revenue successfully", result);
  }

  async getMonthlyRevenue(req, res) {
    const result = await adminAnalyticsService.getMonthlyRevenue(req.query);
    return APIResponse.success(res, "Get monthly revenue successfully", result);
  }

  async getTopProducts(req, res) {
    const result = await adminAnalyticsService.getTopProducts(req.query);
    return APIResponse.success(res, "Get top products successfully", result);
  }

  async getRevenueByCategory(req, res) {
    const result = await adminAnalyticsService.getRevenueByCategory(req.query);
    return APIResponse.success(res, "Get revenue by category successfully", result);
  }

  async getRevenueByBrand(req, res) {
    const result = await adminAnalyticsService.getRevenueByBrand(req.query);
    return APIResponse.success(res, "Get revenue by brand successfully", result);
  }
}

module.exports = new AdminController();

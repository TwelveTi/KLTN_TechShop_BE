const productService = require("../services/productService");
const uploadService = require("../services/uploadService");
const APIResponse = require("../utils/ApiResponse");

class ProductController {
  async getAllProducts(req, res) {
    const result = await productService.getAllProducts(
      { ...req.query, onlyActive: true },
      { userId: req.user?.id || null, sessionId: req.sessionKey || null },
    );
    return APIResponse.success(res, "Get products successfully", result);
  }

  async getProductById(req, res) {
    const product = await productService.getProductById(req.params.id, {
      onlyActive: true,
      viewer: { userId: req.user?.id || null, sessionId: req.sessionKey || null },
    });
    return APIResponse.success(res, "Get product successfully", product);
  }

  async getAllProductsForAdmin(req, res) {
    const result = await productService.getAllProducts(req.query);
    return APIResponse.success(res, "Get products successfully", result);
  }

  async getProductByIdForAdmin(req, res) {
    const product = await productService.getProductById(req.params.id);
    return APIResponse.success(res, "Get product successfully", product);
  }

  async createProduct(req, res) {
    const product = await productService.createProduct(req.body);
    return APIResponse.success(res, "Product created successfully", product, 201);
  }

  async updateProduct(req, res) {
    const product = await productService.updateProduct(req.params.id, req.body, uploadService);
    return APIResponse.success(res, "Product updated successfully", product);
  }

  async deleteProduct(req, res) {
    const result = await productService.deleteProduct(req.params.id, uploadService);
    return APIResponse.success(res, result.message);
  }

  // ── Biến thể (admin) ──────────────────────────────────────────────────────

  async createVariant(req, res) {
    const variant = await productService.createVariant(req.params.id, req.body);
    return APIResponse.success(res, "Variant created successfully", variant, 201);
  }

  async updateVariant(req, res) {
    const variant = await productService.updateVariant(req.params.id, req.params.variantId, req.body);
    return APIResponse.success(res, "Variant updated successfully", variant);
  }

  async deleteVariant(req, res) {
    const result = await productService.deleteVariant(req.params.id, req.params.variantId);
    return APIResponse.success(res, result.message);
  }

  // ── Specification definitions (admin) ─────────────────────────────────────

  async getSpecificationDefinitions(req, res) {
    const definitions = await productService.getDefinitionsByCategory(req.params.categoryId);
    return APIResponse.success(res, "Get specification definitions successfully", definitions);
  }

  async createSpecificationDefinition(req, res) {
    const definition = await productService.createSpecificationDefinition(req.params.categoryId, req.body);
    return APIResponse.success(res, "Specification definition created successfully", definition, 201);
  }

  async updateSpecificationDefinition(req, res) {
    const definition = await productService.updateSpecificationDefinition(req.params.id, req.body);
    return APIResponse.success(res, "Specification definition updated successfully", definition);
  }

  async deleteSpecificationDefinition(req, res) {
    await productService.deleteSpecificationDefinition(req.params.id);
    return APIResponse.success(res, "Specification definition deleted successfully");
  }
}

module.exports = new ProductController();

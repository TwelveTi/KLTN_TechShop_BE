const catalogService = require("../services/catalogService");
const APIResponse = require("../utils/ApiResponse");

class CatalogController {
  async getCategories(req, res) {
    const tree = req.query.tree === "true" || req.query.tree === "1";
    const result = await catalogService.getCategories({ tree });

    return APIResponse.success(res, "Get categories successfully", result);
  }

  async getCategoryBySlug(req, res) {
    const category = await catalogService.getCategoryBySlug(req.params.slug);

    return APIResponse.success(res, "Get category successfully", category);
  }

  async getBrands(req, res) {
    const result = await catalogService.getBrands();

    return APIResponse.success(res, "Get brands successfully", result);
  }

  async getBrandBySlug(req, res) {
    const brand = await catalogService.getBrandBySlug(req.params.slug);

    return APIResponse.success(res, "Get brand successfully", brand);
  }
}

module.exports = new CatalogController();

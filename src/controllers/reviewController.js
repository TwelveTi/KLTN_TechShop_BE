const reviewService = require("../services/reviewService");
const APIResponse = require("../utils/ApiResponse");

class ReviewController {
  async getProductReviews(req, res) {
    const result = await reviewService.getProductReviews(req.params.productId, req.query);

    return APIResponse.success(res, "Get product reviews successfully", result);
  }

  async getProductReviewSummary(req, res) {
    const summary = await reviewService.getProductReviewSummary(req.params.productId);

    return APIResponse.success(res, "Get product review summary successfully", summary);
  }

  async createReview(req, res) {
    const review = await reviewService.createReview(req.user.id, req.params.productId, {
      rating: req.body.rating,
      title: req.body.title,
      content: req.body.content,
    });

    return APIResponse.success(res, "Review created successfully", review, 201);
  }

  async updateReview(req, res) {
    const review = await reviewService.updateReview(req.user.id, req.params.reviewId, {
      rating: req.body.rating,
      title: req.body.title,
      content: req.body.content,
    });

    return APIResponse.success(res, "Review updated successfully", review);
  }

  async deleteReview(req, res) {
    const result = await reviewService.deleteReview(req.user.id, req.params.reviewId);

    return APIResponse.success(res, result.message);
  }
}

module.exports = new ReviewController();

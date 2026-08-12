const AppError = require("../utils/AppError");
const reviewRepository = require("../repositories/reviewRepository");

// Which review status is visible to the public and counts toward a product's
// rating. Centralized so a future moderation workflow can, for example, create
// reviews as PENDING and approve them, without touching the read/aggregation
// logic below.
const PUBLIC_STATUS = "APPROVED";

// Status assigned to a newly created review. Reviews are auto-published today
// (reactive moderation via the HIDDEN status); flipping this to "PENDING" is
// all that is needed to require pre-moderation later.
const CREATE_STATUS = "APPROVED";

class ReviewService {
  buildPagination(query) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  // A product can be reviewed / have its reviews read only when it is publicly
  // available (ACTIVE). Mirrors the public product-detail visibility rule.
  async assertReviewableProduct(productId, transaction) {
    const product = await reviewRepository.findActiveProductById(productId, { transaction });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    return product;
  }

  formatReview(review) {
    const user = review.user || null;

    return {
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      title: review.title,
      content: review.content,
      // Verified purchase is proven solely by a linked order item. Orders do
      // not exist yet, so this is always false until that link is populated.
      verifiedPurchase: Boolean(review.orderItemId),
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: user
        ? {
          id: user.id,
          name: user.fullName,
          avatarUrl: user.avatarUrl || null,
        }
        : null,
    };
  }

  async getProductReviews(productId, query = {}) {
    await this.assertReviewableProduct(productId);

    const { page, limit, offset } = this.buildPagination(query);

    const { rows, count } = await reviewRepository.findAndCountByProductStatus(productId, PUBLIC_STATUS, {
      limit,
      offset,
    });

    return {
      items: rows.map((review) => this.formatReview(review)),
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  // Rating summary computed entirely in the database (GROUP BY rating returns at
  // most 5 rows), never by loading individual reviews into memory.
  async getProductReviewSummary(productId) {
    await this.assertReviewableProduct(productId);

    const grouped = await reviewRepository.getRatingDistribution(productId, PUBLIC_STATUS);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalReviews = 0;
    let weightedSum = 0;

    for (const row of grouped) {
      const rating = Number(row.rating);
      const ratingCount = Number(row.count);
      if (distribution[rating] !== undefined) {
        distribution[rating] = ratingCount;
      }
      totalReviews += ratingCount;
      weightedSum += rating * ratingCount;
    }

    const averageRating = totalReviews > 0
      ? Number((weightedSum / totalReviews).toFixed(2))
      : 0;

    return { averageRating, totalReviews, distribution };
  }

  // Recompute and persist the denormalized product rating fields from the
  // reviews table (same formula as the seeder). Keeps the Product API — used by
  // product listing/detail — consistent without per-request N+1 aggregation.
  async syncProductRating(productId, transaction) {
    const result = await reviewRepository.getRatingAggregate(productId, PUBLIC_STATUS, { transaction });

    const reviewCount = Number(result?.count) || 0;
    const averageRating = reviewCount > 0 ? Number(Number(result.avg).toFixed(2)) : 0;

    await reviewRepository.updateProductRating(productId, { averageRating, reviewCount }, { transaction });
  }

  async findOwnedReview(reviewId, userId, transaction) {
    const review = await reviewRepository.findById(reviewId, { transaction });

    if (!review) {
      throw new AppError("Review not found", 404);
    }

    // Ownership check: a user may only touch their own review.
    if (review.userId !== userId) {
      throw new AppError("You can only modify your own review", 403);
    }

    return review;
  }

  async createReview(userId, productId, data) {
    const transaction = await reviewRepository.beginTransaction();

    try {
      // productId comes from the route, userId from the auth context — never
      // from the request body.
      await this.assertReviewableProduct(productId, transaction);

      // One active review per user per product (order_item_id is NULL for now,
      // so the DB unique index cannot enforce this; do it at the app level).
      const existing = await reviewRepository.findExisting(userId, productId, { transaction });

      if (existing) {
        throw new AppError("You have already reviewed this product", 409);
      }

      const review = await reviewRepository.create(
        {
          userId,
          productId,
          orderItemId: null,
          rating: data.rating,
          title: data.title ?? null,
          content: data.content ?? null,
          status: CREATE_STATUS,
          reviewedAt: new Date(),
        },
        { transaction },
      );

      await this.syncProductRating(productId, transaction);

      await transaction.commit();

      const created = await reviewRepository.findByIdWithUser(review.id);

      return this.formatReview(created);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateReview(userId, reviewId, data) {
    const transaction = await reviewRepository.beginTransaction();

    try {
      const review = await this.findOwnedReview(reviewId, userId, transaction);

      // Only rating/title/content may change. productId, userId, orderItemId,
      // status and verified-purchase state are never client-editable.
      const updates = {};
      if (data.rating !== undefined) updates.rating = data.rating;
      if (data.title !== undefined) updates.title = data.title;
      if (data.content !== undefined) updates.content = data.content;

      await reviewRepository.update(review, updates, { transaction });

      // Rating may have changed; keep the product aggregate in sync.
      await this.syncProductRating(review.productId, transaction);

      await transaction.commit();

      const updated = await reviewRepository.findByIdWithUser(review.id);

      return this.formatReview(updated);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteReview(userId, reviewId) {
    const transaction = await reviewRepository.beginTransaction();

    try {
      const review = await this.findOwnedReview(reviewId, userId, transaction);
      const { productId } = review;

      // Soft delete (paranoid) — consistent with other user-generated content.
      await reviewRepository.destroy(review, { transaction });

      await this.syncProductRating(productId, transaction);

      await transaction.commit();

      return { message: "Review deleted successfully" };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new ReviewService();

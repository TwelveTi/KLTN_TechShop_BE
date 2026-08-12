const db = require("../../models");
const reviewsData = require("../data/reviews.data");

/**
 * Seeds Reviews and synchronizes Product average ratings & review counts
 */
async function seedReviews(userMap, productMap, orderItemMap, transaction) {
  console.log("  Seeding Reviews and synchronizing product rating metrics...");

  let reviewCount = 0;

  for (const item of reviewsData) {
    const user = userMap.get(item.userKey);
    const product = productMap.get(item.productKey);

    if (!user || !product) continue;

    await db.Review.create(
      {
        userId: user.id,
        productId: product.id,
        orderItemId: null,
        rating: item.rating,
        title: item.title || null,
        content: item.content || null,
        status: item.status || "APPROVED",
        reviewedAt: item.reviewedAt || new Date(),
      },
      { transaction },
    );
    reviewCount++;
  }

  // Synchronize average rating and review counts on all products
  for (const [key, product] of productMap.entries()) {
    const approvedReviews = await db.Review.findAll({
      where: { productId: product.id, status: "APPROVED" },
      attributes: ["rating"],
      transaction,
    });

    if (approvedReviews.length > 0) {
      const sum = approvedReviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = Number((sum / approvedReviews.length).toFixed(2));
      await product.update(
        {
          averageRating: avg,
          reviewCount: approvedReviews.length,
        },
        { transaction },
      );
    }
  }

  console.log(`    Created ${reviewCount} Reviews and synchronized Product ratings.`);
}

module.exports = { seedReviews };

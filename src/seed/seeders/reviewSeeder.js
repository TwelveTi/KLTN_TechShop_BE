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

  // Synchronize average rating and review counts on all products.
  //
  // Written UNCONDITIONALLY, including the zero case. Guarding this with
  // `if (approvedReviews.length > 0)` was the bug behind "một nửa catalogue có
  // số đánh giá bịa": a product with no reviews kept whatever `reviewCount` the
  // seed data happened to declare, so the detail page advertised "4.6 ★ (18
  // đánh giá)" over an empty review tab. Recomputing every product means these
  // two columns can never drift from the rows in `reviews` again — a product
  // added later without reviews reads 0 and 0.00, which is the truth.
  //
  // Only APPROVED counts. PENDING (awaiting moderation) and HIDDEN (removed for
  // policy) rows exist in the table but are not public, so they must not move
  // the public average either.
  for (const product of productMap.values()) {
    const approvedReviews = await db.Review.findAll({
      where: { productId: product.id, status: "APPROVED" },
      attributes: ["rating"],
      transaction,
    });

    const sum = approvedReviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = approvedReviews.length > 0 ? Number((sum / approvedReviews.length).toFixed(2)) : 0;

    await product.update(
      {
        averageRating: avg,
        reviewCount: approvedReviews.length,
      },
      { transaction },
    );
  }

  console.log(`    Created ${reviewCount} Reviews and synchronized Product ratings.`);
}

module.exports = { seedReviews };

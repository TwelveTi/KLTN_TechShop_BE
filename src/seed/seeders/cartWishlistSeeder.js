const db = require("../../models");

/**
 * Seeds CartItems and WishlistItems for customer users
 */
async function seedCartAndWishlist(userMap, productMap, variantMap, transaction) {
  console.log("  Seeding Cart Items and Wishlist Items...");

  let cartItemCount = 0;
  let wishlistItemCount = 0;

  // Items for Customer 1 (Power User Cart)
  const user1 = userMap.get("customer1");
  if (user1) {
    const cart1 = await db.Cart.findOne({ where: { userId: user1.id }, transaction });
    const wishlist1 = await db.Wishlist.findOne({ where: { userId: user1.id }, transaction });

    // Cart items for customer 1
    const p1 = productMap.get("macbookAir13M2");
    const v1 = variantMap.get("MBA13-M2-256-MIDNIGHT");
    if (cart1 && p1) {
      await db.CartItem.create(
        {
          cartId: cart1.id,
          productId: p1.id,
          variantId: v1?.id || null,
          quantity: 1,
        },
        { transaction },
      );
      cartItemCount++;
    }

    const p2 = productMap.get("airpodsPro2");
    const v2 = variantMap.get("APP2-USBC-WHITE");
    if (cart1 && p2) {
      await db.CartItem.create(
        {
          cartId: cart1.id,
          productId: p2.id,
          variantId: v2?.id || null,
          quantity: 2,
        },
        { transaction },
      );
      cartItemCount++;
    }

    // Wishlist items for customer 1
    const w1 = productMap.get("appleWatchUltra2");
    const wv1 = variantMap.get("AW-ULTRA2-ALPINE-ORANGE");
    if (wishlist1 && w1) {
      await db.WishlistItem.create(
        {
          wishlistId: wishlist1.id,
          productId: w1.id,
          variantId: wv1?.id || null,
        },
        { transaction },
      );
      wishlistItemCount++;
    }
  }

  // Items for Customer 2 (Gamer Cart)
  const user2 = userMap.get("customer2");
  if (user2) {
    const cart2 = await db.Cart.findOne({ where: { userId: user2.id }, transaction });
    const wishlist2 = await db.Wishlist.findOne({ where: { userId: user2.id }, transaction });

    const pGaming = productMap.get("rogZephyrusG16");
    const vGaming = variantMap.get("ROG-G16-U9-RTX4070-GREY");
    if (cart2 && pGaming) {
      await db.CartItem.create(
        {
          cartId: cart2.id,
          productId: pGaming.id,
          variantId: vGaming?.id || null,
          quantity: 1,
        },
        { transaction },
      );
      cartItemCount++;
    }

    const pMonitor = productMap.get("lgUltraGearOled27");
    const vMonitor = variantMap.get("LG-27GR95QE-B");
    if (wishlist2 && pMonitor) {
      await db.WishlistItem.create(
        {
          wishlistId: wishlist2.id,
          productId: pMonitor.id,
          variantId: vMonitor?.id || null,
        },
        { transaction },
      );
      wishlistItemCount++;
    }
  }

  // Items for Customer 3 (Office & Peripherals)
  const user3 = userMap.get("customer3");
  if (user3) {
    const cart3 = await db.Cart.findOne({ where: { userId: user3.id }, transaction });
    const pMouse = productMap.get("logitechMxMaster3S");
    const vMouse = variantMap.get("MXM3S-GRAPHITE");
    if (cart3 && pMouse) {
      await db.CartItem.create(
        {
          cartId: cart3.id,
          productId: pMouse.id,
          variantId: vMouse?.id || null,
          quantity: 1,
        },
        { transaction },
      );
      cartItemCount++;
    }

    const pKeys = productMap.get("logitechMxKeysS");
    const vKeys = variantMap.get("MXKEYS-S-GRAPHITE");
    if (cart3 && pKeys) {
      await db.CartItem.create(
        {
          cartId: cart3.id,
          productId: pKeys.id,
          variantId: vKeys?.id || null,
          quantity: 1,
        },
        { transaction },
      );
      cartItemCount++;
    }
  }

  console.log(`    Created ${cartItemCount} CartItems and ${wishlistItemCount} WishlistItems.`);
}

module.exports = { seedCartAndWishlist };

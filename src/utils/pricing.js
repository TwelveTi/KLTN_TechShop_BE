// Shared price / stock / image resolution for anything that turns a product
// (and an optional variant) into money: the cart today, order creation next.
// Both MUST agree — a cart that shows one price and an order that charges
// another is a bug the customer sees — so the rules live here once instead of
// being duplicated per service.

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100;

// A variant may define its own price/salePrice; when it does not, it inherits
// the parent product's values. A sale price only applies when it is a valid
// positive value below the base price.
const resolveUnitPrice = (product, variant) => {
  let basePrice;
  let salePrice;

  if (variant) {
    basePrice = variant.price != null ? toNumber(variant.price) : toNumber(product.basePrice);
    if (variant.salePrice != null) {
      salePrice = toNumber(variant.salePrice);
    } else if (variant.price != null) {
      // Variant defines its own price but no sale: do not inherit product sale.
      salePrice = null;
    } else {
      salePrice = product.salePrice != null ? toNumber(product.salePrice) : null;
    }
  } else {
    basePrice = toNumber(product.basePrice);
    salePrice = product.salePrice != null ? toNumber(product.salePrice) : null;
  }

  const hasValidSale = salePrice != null && salePrice > 0 && salePrice < basePrice;
  const unitPrice = hasValidSale ? salePrice : basePrice;

  return {
    basePrice: roundMoney(basePrice),
    salePrice: hasValidSale ? roundMoney(salePrice) : null,
    unitPrice: roundMoney(unitPrice),
  };
};

// Stock lives on the variant when there is one, otherwise on the product. The
// two counters are independent, so whichever one is read here is also the one
// that must be decremented at checkout.
const resolveStock = (product, variant) => (variant ? variant.stockQuantity : product.stockQuantity);

// Pick the best image for a line: prefer a variant image, then the product's
// primary image, then the lowest sortOrder, then any image.
const resolveImageUrl = (product, variant) => {
  const pickPrimary = (images) => {
    if (!Array.isArray(images) || images.length === 0) {
      return null;
    }
    const sorted = [...images].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
    return sorted[0]?.imageUrl || null;
  };

  if (variant) {
    const variantImage = pickPrimary(variant.images);
    if (variantImage) {
      return variantImage;
    }
  }

  return pickPrimary(product?.images);
};

module.exports = {
  toNumber,
  roundMoney,
  resolveUnitPrice,
  resolveStock,
  resolveImageUrl,
};

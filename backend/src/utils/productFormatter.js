const canViewCosts = (role) => ["superadmin", "admin"].includes(role);

const formatVariant = (variant) => ({
  id: variant._id,
  size: variant.size,
  color: variant.color,
  sku: variant.sku,
  stock: variant.stock,
  price: variant.price,
  isActive: variant.isActive,
});

exports.formatProductPublic = (product) => {
  const doc = product.toObject ? product.toObject() : product;
  const effectivePrice = product.getEffectivePrice
    ? product.getEffectivePrice()
    : doc.salePrice;

  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    shortDescription: doc.shortDescription,
    fullDescription: doc.fullDescription,
    category: doc.category,
    weaveType: doc.weaveType,
    style: doc.style,
    material: doc.material,
    variants: doc.variants?.map(formatVariant) || [],
    salePrice: doc.salePrice,
    effectivePrice,
    discountPercent: doc.discountPercent,
    onPromotion: doc.onPromotion,
    promotionEndsAt: doc.promotionEndsAt,
    images: doc.images,
    mainImage: doc.mainImage,
    seoTitle: doc.seoTitle,
    seoDescription: doc.seoDescription,
    isFeatured: doc.isFeatured,
    isNew: doc.isNew,
    allowsCustomization: doc.allowsCustomization,
    customizationOptions: doc.customizationOptions,
    totalStock: product.getTotalStock ? product.getTotalStock() : 0,
    inStock: product.isInStock ? product.isInStock() : false,
    createdAt: doc.createdAt,
  };
};

exports.formatProductAdmin = (product, role) => {
  const publicData = exports.formatProductPublic(product);
  const doc = product.toObject ? product.toObject({ getters: true }) : product;

  if (canViewCosts(role)) {
    publicData.internalCost = doc.internalCost ?? product.internalCost;
    publicData.margin =
      publicData.effectivePrice && publicData.internalCost
        ? publicData.effectivePrice - publicData.internalCost
        : null;
  }

  publicData.isActive = doc.isActive;
  publicData.viewsCount = doc.viewsCount;
  publicData.salesCount = doc.salesCount;

  return publicData;
};

exports.stripCosts = (productData) => {
  const { internalCost, margin, ...rest } = productData;
  return rest;
};

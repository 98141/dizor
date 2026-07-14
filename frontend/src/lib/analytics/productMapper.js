import { toSafeNumber, toSafeString } from "./sanitize";

function removeEmpty(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
}

function variantLabel(sizeName, colorName) {
  return [sizeName, colorName].filter(Boolean).join(" / ") || undefined;
}

// product: shape de ProductoClient/ProductCard (product.id, name, slug,
// category?.name, weaveType?.name, effectivePrice, variants[]).
// extra.variant: variante seleccionada/representativa (para sku/precio real).
export function mapProductToItem(product, extra = {}) {
  if (!product) return null;
  const { variant, index, itemListId, itemListName, quantity } = extra;

  // Preferir SKU de variante (estable, real); si no existe, usar el id del
  // producto. Nunca el nombre como identificador cuando hay id/sku reales.
  const itemId = variant?.sku || product.id;
  const price = toSafeNumber(variant?.price ?? product.effectivePrice ?? product.salePrice);

  return removeEmpty({
    item_id: toSafeString(itemId),
    item_name: toSafeString(product.name),
    item_brand: "Dizor",
    item_category: toSafeString(product.category?.name),
    item_category2: toSafeString(product.weaveType?.name),
    item_variant: toSafeString(variantLabel(variant?.size?.name, variant?.color?.name)),
    item_list_id: toSafeString(itemListId),
    item_list_name: toSafeString(itemListName),
    price,
    quantity: toSafeNumber(quantity) ?? 1,
    index: toSafeNumber(index),
  });
}

// cartItem: shape de CartContext (productId, variantId, sku, productName,
// sizeName, colorName, unitPrice, quantity) — ya sin datos del comprador.
export function mapCartItemToItem(cartItem, extra = {}) {
  if (!cartItem) return null;
  const itemId = cartItem.sku || cartItem.productId;

  return removeEmpty({
    item_id: toSafeString(itemId),
    item_name: toSafeString(cartItem.productName),
    item_brand: "Dizor",
    item_variant: toSafeString(variantLabel(cartItem.sizeName, cartItem.colorName)),
    price: toSafeNumber(cartItem.unitPrice),
    quantity: toSafeNumber(cartItem.quantity) ?? 1,
    ...extra,
  });
}

// orderItem: shape reducido devuelto por trackOrder() del backend
// ({ productName, quantity, lineTotal } — sin id/sku, es un DTO público
// limitado). Fallback usado solo si no hay snapshot de carrito disponible
// para el evento purchase (ver checkout/page.js y pedido/confirmacion).
export function mapOrderItemToItem(orderItem, index) {
  if (!orderItem) return null;
  const quantity = toSafeNumber(orderItem.quantity) || 1;
  const lineTotal = toSafeNumber(orderItem.lineTotal);
  const price = lineTotal != null ? Math.round((lineTotal / quantity) * 100) / 100 : undefined;
  const fallbackId = orderItem.productName
    ? orderItem.productName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    : undefined;

  return removeEmpty({
    item_id: toSafeString(fallbackId),
    item_name: toSafeString(orderItem.productName),
    item_brand: "Dizor",
    price,
    quantity,
    index: toSafeNumber(index),
  });
}

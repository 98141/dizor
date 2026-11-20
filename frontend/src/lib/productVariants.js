/**
 * Lógica pura de variantes de la PDP (talla × color × stock).
 * Sin React: se prueba con datos reales del catálogo.
 *
 * Reglas:
 * - Solo cuentan las variantes activas.
 * - Nunca se autoselecciona una variante agotada.
 * - Al cambiar de talla se conserva el color si la combinación sigue
 *   disponible; si no, se avisa y (solo si queda un único color con
 *   stock) se selecciona ese color.
 */

const idOf = (ref) => {
  if (ref == null) return null;
  if (typeof ref === "object") return ref._id != null ? String(ref._id) : null;
  return String(ref);
};

export const variantSizeId = (v) => idOf(v?.size);
export const variantColorId = (v) => idOf(v?.color);

export const activeVariants = (product) =>
  (product?.variants || []).filter((v) => v && v.isActive);

const inStock = (v) => (Number(v?.stock) || 0) > 0;

const uniqueRefs = (variants, pick) => {
  const map = new Map();
  for (const v of variants) {
    const ref = pick(v);
    const id = idOf(ref);
    if (id && !map.has(id)) {
      map.set(id, typeof ref === "object" ? ref : { _id: id, name: id });
    }
  }
  return [...map.values()];
};

/** Tallas activas, con su disponibilidad (alguna variante con stock). */
export function getSizeOptions(product) {
  const vs = activeVariants(product);
  return uniqueRefs(vs, (v) => v.size).map((size) => {
    const id = idOf(size);
    return {
      id,
      name: size.name || "",
      available: vs.some((v) => variantSizeId(v) === id && inStock(v)),
    };
  });
}

/**
 * Colores activos para la talla dada (o todos si no hay talla), con
 * disponibilidad real de la combinación.
 */
export function getColorOptions(product, sizeId) {
  const vs = activeVariants(product).filter(
    (v) => !sizeId || variantSizeId(v) === String(sizeId)
  );
  return uniqueRefs(vs, (v) => v.color).map((color) => {
    const id = idOf(color);
    return {
      id,
      name: color.name || "",
      hexCode: color.hexCode || "",
      available: vs.some((v) => variantColorId(v) === id && inStock(v)),
    };
  });
}

/** Producto con un solo valor de talla: se muestra como dato, no selector. */
export function hasSingleSize(product) {
  return getSizeOptions(product).length === 1;
}

export function findVariant(product, sizeId, colorId) {
  const sizes = getSizeOptions(product);
  const needsSize = sizes.length > 0;
  const needsColor = getColorOptions(product, sizeId).length > 0;
  if (needsSize && !sizeId) return null;
  if (needsColor && !colorId) return null;
  return (
    activeVariants(product).find(
      (v) =>
        (!needsSize || variantSizeId(v) === String(sizeId)) &&
        (!needsColor || variantColorId(v) === String(colorId))
    ) || null
  );
}

/**
 * Selección inicial: primera variante activa con stock. Si no hay stock
 * en ninguna, no se selecciona nada (salvo la talla única, que es dato).
 */
export function initialSelection(product) {
  const first = activeVariants(product).find(inStock);
  if (first) {
    return { sizeId: variantSizeId(first), colorId: variantColorId(first) };
  }
  const sizes = getSizeOptions(product);
  return { sizeId: sizes.length === 1 ? sizes[0].id : null, colorId: null };
}

/**
 * Cambio de talla. Devuelve la nueva selección y un aviso (o null).
 * `colorName` se usa solo para redactar el aviso.
 */
export function selectSize(product, sizeId, currentColorId) {
  const colors = getColorOptions(product, sizeId);
  const sizeName =
    getSizeOptions(product).find((s) => s.id === String(sizeId))?.name || "";

  if (colors.length === 0) {
    return { sizeId: String(sizeId), colorId: null, notice: null };
  }

  // El color anterior puede no existir en la nueva talla: su nombre se
  // busca entre todos los colores del producto para poder avisar.
  const current = currentColorId
    ? colors.find((c) => c.id === String(currentColorId)) ||
      getColorOptions(product, null).find((c) => c.id === String(currentColorId)) ||
      null
    : null;

  if (current?.available && colors.some((c) => c.id === current.id)) {
    return { sizeId: String(sizeId), colorId: current.id, notice: null };
  }

  const availableColors = colors.filter((c) => c.available);

  if (availableColors.length === 1) {
    const only = availableColors[0];
    return {
      sizeId: String(sizeId),
      colorId: only.id,
      notice:
        current && current.id !== only.id
          ? `${current.name} no está disponible en talla ${sizeName}. Seleccionamos ${only.name}, el único color disponible en esa talla.`
          : null,
    };
  }

  if (availableColors.length === 0) {
    return {
      sizeId: String(sizeId),
      colorId: null,
      notice: `La talla ${sizeName} no tiene unidades disponibles en este momento.`,
    };
  }

  return {
    sizeId: String(sizeId),
    colorId: null,
    notice: current
      ? `${current.name} no está disponible en talla ${sizeName}. Elige uno de los colores disponibles.`
      : null,
  };
}

/**
 * Colores “especiales” (surtido, multicolor…): su hex en la base es
 * decorativo y no representa el producto; se muestran como texto con una
 * muestra multicolor.
 */
export function isMixedColor(color) {
  const name = String(color?.name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return /\b(surtid[oa]s?|multicolor\w*|variad[oa]s?)\b/.test(name);
}

/**
 * Precio de la variante: el propio si lo tiene (mismo criterio que
 * backend/services/cartService: `variant.price != null`); si no, el
 * efectivo del producto. La promoción solo se muestra sobre el efectivo,
 * para no tachar un precio que no corresponde a la variante.
 */
export function variantPricing(product, variant) {
  const ownPrice = variant?.price != null ? variant.price : null;
  const hasPromo =
    !ownPrice &&
    product.onPromotion &&
    product.discountPercent > 0 &&
    product.effectivePrice < product.salePrice;
  return {
    price: ownPrice ?? product.effectivePrice,
    oldPrice: hasPromo ? product.salePrice : null,
    discountPercent: hasPromo ? product.discountPercent : null,
  };
}

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatCOP } from "@/lib/formatCurrency";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/imagePlaceholder";
import { trackSelectItem } from "@/lib/analytics/events";
import { mapProductToItem } from "@/lib/analytics/productMapper";

const MAX_SWATCHES = 4;

function getUniqueColors(variants = []) {
  const seen = new Set();
  const colors = [];
  for (const v of variants) {
    if (!v.isActive) continue;
    const c = v.color;
    if (!c?._id) continue;
    const id = String(c._id);
    if (!seen.has(id)) {
      seen.add(id);
      colors.push(c);
    }
  }
  return colors;
}

function getSecondaryImage(product) {
  const main = product?.mainImage;
  const list = Array.isArray(product?.images) ? product.images : [];
  const secondary = list.find((img) => img?.url && img.url !== main);
  return secondary?.url || null;
}

/**
 * Badges — máx. 2. Prioridad: Agotado > Nuevo > Destacado; Oferta si cabe.
 */
function buildBadges(product, hasPromo) {
  const badges = [];
  if (!product.inStock) {
    badges.push({ key: "out", label: "Agotado", className: "product-card__badge--out" });
    return badges;
  }
  if (product.isNew) {
    badges.push({ key: "new", label: "Nuevo", className: "product-card__badge--new" });
  } else if (product.isFeatured) {
    badges.push({
      key: "featured",
      label: "Destacado",
      className: "product-card__badge--featured",
    });
  }
  if (hasPromo && badges.length < 2) {
    badges.push({
      key: "promo",
      label: `−${product.discountPercent}%`,
      className: "product-card__badge--promo",
    });
  }
  return badges;
}

/**
 * ProductCard — base compartida Home / Catálogo / relacionados.
 * presentation: "default" | "editorial"
 */
export default function ProductCard({
  product,
  priority = false,
  itemListId,
  itemListName,
  index,
  presentation = "default",
  sizes: sizesProp,
}) {
  const [loadSecondary, setLoadSecondary] = useState(false);

  const hasPromo =
    product.onPromotion &&
    product.discountPercent > 0 &&
    product.effectivePrice < product.salePrice;

  const productHref = product.slug
    ? `/producto/${encodeURIComponent(product.slug)}`
    : `/producto/${product.id}`;

  const uniqueColors = getUniqueColors(product.variants);
  const visibleColors = uniqueColors.slice(0, MAX_SWATCHES);
  const extraColors = uniqueColors.length - visibleColors.length;
  const secondaryUrl = getSecondaryImage(product);
  const badges = buildBadges(product, hasPromo);
  const isEditorial = presentation === "editorial";

  const imageSizes =
    sizesProp ||
    (isEditorial
      ? "(max-width: 767px) 78vw, (max-width: 1023px) 45vw, 280px"
      : "(max-width: 767px) 50vw, (max-width: 1023px) 40vw, 280px");

  const primarySrc = product.mainImage || "/icon-512.png";
  const primaryAlt = product.images?.[0]?.alt || product.name || "Producto Dizor";

  const handleSelect = () => {
    trackSelectItem({
      items: [
        mapProductToItem(product, { itemListId, itemListName, index }),
      ].filter(Boolean),
      itemListId,
      itemListName,
    });
  };

  const enableSecondary = () => {
    if (secondaryUrl) setLoadSecondary(true);
  };

  const metaParts = [
    product.weaveType?.name,
    !isEditorial && product.style?.name ? product.style.name : null,
  ].filter(Boolean);

  return (
    <article
      className={[
        "product-card",
        !product.inStock ? "product-card--out" : "",
        isEditorial ? "product-card--editorial" : "",
        secondaryUrl ? "product-card--has-secondary" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={enableSecondary}
      onFocusCapture={enableSecondary}
    >
      <Link
        href={productHref}
        className="product-card__image-wrap"
        onClick={handleSelect}
        aria-label={product.name}
      >
        <Image
          src={primarySrc}
          alt={primaryAlt}
          fill
          className="product-card__image product-card__image--primary"
          sizes={imageSizes}
          priority={priority}
          placeholder="blur"
          blurDataURL={SHIMMER_BLUR_DATA_URL}
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
        {secondaryUrl && loadSecondary ? (
          <Image
            src={secondaryUrl}
            alt=""
            fill
            className="product-card__image product-card__image--secondary"
            sizes={imageSizes}
            aria-hidden="true"
            style={{ objectFit: "cover", objectPosition: "center" }}
          />
        ) : null}
        {badges.length > 0 ? (
          <div className="product-card__badges">
            {badges.map((b) => (
              <span
                key={b.key}
                className={`product-card__badge ${b.className}`}
              >
                {b.label}
              </span>
            ))}
          </div>
        ) : null}
      </Link>

      <div className="product-card__body">
        {metaParts.length > 0 ? (
          <p className="product-card__meta">{metaParts.join(" · ")}</p>
        ) : null}

        <h2 className="product-card__title">
          <Link href={productHref} onClick={handleSelect}>
            {product.name}
          </Link>
        </h2>

        {visibleColors.length > 0 ? (
          <div
            className="product-card__colors"
            aria-label="Colores disponibles"
          >
            {visibleColors.map((color) =>
              color.hexCode ? (
                <span
                  key={String(color._id)}
                  className="product-card__color-dot"
                  style={{ backgroundColor: color.hexCode }}
                  title={color.name}
                  aria-label={color.name}
                />
              ) : (
                <span
                  key={String(color._id)}
                  className="product-card__color-dot product-card__color-dot--text"
                  title={color.name}
                >
                  {color.name?.charAt(0).toUpperCase()}
                </span>
              )
            )}
            {extraColors > 0 ? (
              <span className="product-card__color-more">+{extraColors}</span>
            ) : null}
          </div>
        ) : null}

        <div className="product-card__price">
          <span className="product-card__price-current">
            {formatCOP(product.effectivePrice)}
          </span>
          {hasPromo ? (
            <span className="product-card__price-old">
              {formatCOP(product.salePrice)}
            </span>
          ) : null}
        </div>

        <span className="product-card__cta" aria-hidden="true">
          Ver pieza
        </span>
      </div>
    </article>
  );
}

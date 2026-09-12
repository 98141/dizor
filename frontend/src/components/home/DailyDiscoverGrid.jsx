"use client";

import Link from "next/link";
import Image from "next/image";
import { formatCOP } from "@/lib/formatCurrency";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/imagePlaceholder";
import { trackSelectItem } from "@/lib/analytics/events";
import { mapProductToItem } from "@/lib/analytics/productMapper";

const MAX_SWATCHES = 5;

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

export default function DailyDiscoverGrid({
  products = [],
  listId = "home_daily",
  listName = "Descubre hoy",
}) {
  const items = products.filter(Boolean).slice(0, 5);
  if (!items.length) return null;

  const handleSelect = (product, index) => {
    trackSelectItem({
      items: [
        mapProductToItem(product, {
          itemListId: listId,
          itemListName: listName,
          index,
        }),
      ].filter(Boolean),
      itemListId: listId,
      itemListName: listName,
    });
  };

  const count = items.length;

  return (
    <div
      className={`home-discover__grid home-discover__grid--n${count}`}
      data-count={count}
    >
      {items.map((product, index) => {
        const href = product.slug
          ? `/producto/${encodeURIComponent(product.slug)}`
          : `/producto/${product.id}`;
        const featured = index === 0;
        const hasPromo =
          product.onPromotion &&
          product.discountPercent > 0 &&
          product.effectivePrice < product.salePrice;
        const uniqueColors = getUniqueColors(product.variants);
        const visibleColors = uniqueColors.slice(0, MAX_SWATCHES);
        const extraColors = uniqueColors.length - visibleColors.length;

        return (
          <article
            key={product.id || product.slug || index}
            className={`home-discover__card${featured ? " home-discover__card--featured" : ""}${
              !product.inStock ? " home-discover__card--out" : ""
            }`}
          >
            <Link
              href={href}
              className="home-discover__media"
              onClick={() => handleSelect(product, index)}
            >
              <Image
                src={product.mainImage}
                alt={product.images?.[0]?.alt || product.name}
                fill
                sizes={
                  featured
                    ? "(max-width: 767px) 100vw, 50vw"
                    : "(max-width: 767px) 50vw, 25vw"
                }
                className="home-discover__image"
                placeholder="blur"
                blurDataURL={SHIMMER_BLUR_DATA_URL}
              />
              {!product.inStock ? (
                <span
                  className="home-discover__badge home-discover__badge--out"
                  aria-hidden="true"
                >
                  Agotado
                </span>
              ) : product.isNew ? (
                <span className="home-discover__badge" aria-hidden="true">
                  Nuevo
                </span>
              ) : null}
            </Link>
            <div className="home-discover__meta">
              <div className="home-discover__copy">
                <Link
                  href={href}
                  className="home-discover__name"
                  onClick={() => handleSelect(product, index)}
                >
                  {product.name}
                </Link>
                {visibleColors.length > 0 && (
                  <div
                    className="home-discover__colors"
                    aria-label="Colores disponibles"
                  >
                    {visibleColors.map((color) =>
                      color.hexCode ? (
                        <span
                          key={String(color._id)}
                          className="home-discover__color-dot"
                          style={{ backgroundColor: color.hexCode }}
                          title={color.name}
                          role="img"
                          aria-label={color.name}
                        />
                      ) : (
                        <span
                          key={String(color._id)}
                          className="home-discover__color-dot home-discover__color-dot--text"
                          title={color.name}
                        >
                          {color.name?.charAt(0).toUpperCase()}
                        </span>
                      )
                    )}
                    {extraColors > 0 && (
                      <span className="home-discover__color-more">
                        +{extraColors}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="home-discover__price">
                <span className="home-discover__price-current">
                  {formatCOP(product.effectivePrice)}
                </span>
                {hasPromo && (
                  <span className="home-discover__price-old">
                    {formatCOP(product.salePrice)}
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

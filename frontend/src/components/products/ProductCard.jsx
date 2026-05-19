import Link from "next/link";
import Image from "next/image";
import { formatCOP } from "@/lib/formatCurrency";

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

export default function ProductCard({ product }) {
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

  return (
    <article className={`product-card${!product.inStock ? " product-card--out" : ""}`}>
      <Link href={productHref} className="product-card__image-wrap">
        <Image
          src={product.mainImage}
          alt={product.images?.[0]?.alt || product.name}
          width={400}
          height={500}
          className="product-card__image"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="product-card__badges">
          {!product.inStock && (
            <span className="product-card__badge product-card__badge--out">
              Agotado
            </span>
          )}
          {product.isNew && product.inStock && (
            <span className="product-card__badge product-card__badge--new">
              Nuevo
            </span>
          )}
          {hasPromo && (
            <span className="product-card__badge product-card__badge--promo">
              -{product.discountPercent}%
            </span>
          )}
        </div>
      </Link>

      <div className="product-card__body">
        <p className="product-card__meta">
          {product.weaveType?.name}
          {product.style?.name ? ` · ${product.style.name}` : ""}
        </p>

        <h2 className="product-card__title">
          <Link href={productHref}>{product.name}</Link>
        </h2>

        {visibleColors.length > 0 && (
          <div className="product-card__colors" aria-label="Colores disponibles">
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
            {extraColors > 0 && (
              <span className="product-card__color-more">+{extraColors}</span>
            )}
          </div>
        )}

        <div className="product-card__price">
          <span className="product-card__price-current">
            {formatCOP(product.effectivePrice)}
          </span>
          {hasPromo && (
            <span className="product-card__price-old">
              {formatCOP(product.salePrice)}
            </span>
          )}
        </div>

        {!product.inStock && (
          <p className="product-card__stock product-card__stock--out">
            Sin stock
          </p>
        )}
      </div>
    </article>
  );
}

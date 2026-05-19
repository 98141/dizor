import Link from "next/link";
import Image from "next/image";
import { formatCOP } from "@/lib/formatCurrency";

export default function ProductCard({ product }) {
  const hasPromo =
    product.onPromotion &&
    product.discountPercent > 0 &&
    product.effectivePrice < product.salePrice;

  const productHref = product.slug
    ? `/producto/${encodeURIComponent(product.slug)}`
    : `/producto/${product.id}`;

  return (
    <article className="product-card">
      <Link
        href={productHref}
        className="product-card__image-wrap"
      >
        <Image
          src={product.mainImage}
          alt={product.images?.[0]?.alt || product.name}
          width={400}
          height={500}
          className="product-card__image"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="product-card__badges">
          {product.isNew && (
            <span className="product-card__badge">Nuevo</span>
          )}
          {hasPromo && (
            <span className="product-card__badge product-card__badge--promo">
              -{product.discountPercent}%
            </span>
          )}
          {product.isFeatured && (
            <span className="product-card__badge">Destacado</span>
          )}
        </div>
      </Link>

      <div className="product-card__body">
        <p className="product-card__meta">
          {product.weaveType?.name} · {product.style?.name}
        </p>
        <h2 className="product-card__title">
          <Link href={productHref}>
            {product.name}
          </Link>
        </h2>
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
        <p
          className={`product-card__stock${!product.inStock ? " product-card__stock--out" : ""}`}
        >
          {product.inStock ? "Disponible" : "Agotado"}
        </p>
      </div>
    </article>
  );
}

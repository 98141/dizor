"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatCOP } from "@/lib/formatCurrency";
import { trackAddToCart, trackViewItem } from "@/lib/analytics/events";
import { mapProductToItem } from "@/lib/analytics/productMapper";
import SizeGuide from "@/components/products/SizeGuide";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/imagePlaceholder";

const LOW_STOCK_THRESHOLD = 5;

function isHatCategory(category) {
  const haystack = [category?.slug, category?.name]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return haystack.includes("sombrero");
}

function findFirstAvailableVariant(product) {
  return product.variants?.find((v) => v.isActive && v.stock > 0) || null;
}

function StockAlert({ stock }) {
  if (!stock || stock > LOW_STOCK_THRESHOLD) return null;
  return (
    <p className="product-detail__stock-alert">
      {stock === 1
        ? "Última unidad disponible"
        : `Últimas ${stock} unidades`}
    </p>
  );
}

// Recibe `product` ya resuelto por el Server Component (page.js) — sin
// fetch propio, sin estado de carga inicial: el contenido llega listo en
// el HTML servido por el servidor.
export default function ProductoClient({ product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState(
    () => {
      const first = findFirstAvailableVariant(product);
      return first ? first.size?._id || first.size : null;
    }
  );
  const [selectedColor, setSelectedColor] = useState(
    () => {
      const first = findFirstAvailableVariant(product);
      return first ? first.color?._id || first.color : null;
    }
  );
  const [quantity, setQuantity] = useState(1);
  const [addedMsg, setAddedMsg] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const sizeGuideRef = useRef(null);
  const imagesLengthRef = useRef(0);

  const closeLightbox = () => setLightboxOpen(false);

  // Dispara view_item una sola vez por producto visto (depende de
  // product.id, no de la variante seleccionada — cambiar talla/color no
  // debe repetir este evento).
  useEffect(() => {
    trackViewItem({
      items: [mapProductToItem(product)].filter(Boolean),
      value: product.effectivePrice,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    setQuantity(1);
  }, [selectedSize, selectedColor]);

  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = "hidden";
    const handle = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight")
        setActiveImage((i) =>
          i === imagesLengthRef.current - 1 ? 0 : i + 1
        );
      if (e.key === "ArrowLeft")
        setActiveImage((i) =>
          i === 0 ? imagesLengthRef.current - 1 : i - 1
        );
    };
    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  const selectedVariant = useMemo(() => {
    if (!product?.variants) return null;
    return product.variants.find((v) => {
      const sizeId = v.size?._id || v.size;
      const colorId = v.color?._id || v.color;
      return (
        String(sizeId) === String(selectedSize) &&
        String(colorId) === String(selectedColor) &&
        v.isActive
      );
    });
  }, [product, selectedSize, selectedColor]);

  const availableSizes = useMemo(() => {
    if (!product?.variants) return [];
    const map = new Map();
    product.variants.forEach((v) => {
      if (!v.isActive) return;
      const size = v.size;
      if (size?._id) map.set(String(size._id), size);
    });
    return [...map.values()];
  }, [product]);

  const availableColors = useMemo(() => {
    if (!product?.variants) return [];
    const map = new Map();
    product.variants.forEach((v) => {
      if (!v.isActive) return;
      const sizeId = v.size?._id || v.size;
      if (selectedSize && String(sizeId) !== String(selectedSize)) return;
      const color = v.color;
      if (color?._id) map.set(String(color._id), color);
    });
    return [...map.values()];
  }, [product, selectedSize]);

  const hasPromo =
    product.onPromotion &&
    product.discountPercent > 0 &&
    product.effectivePrice < product.salePrice;

  const images = product.images?.length
    ? product.images
    : [{ url: product.mainImage, alt: product.name }];
  imagesLengthRef.current = images.length;

  const variantPrice = selectedVariant?.price || product.effectivePrice;
  const maxQty = selectedVariant?.stock || 1;

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.mainImage,
      sizeName: selectedVariant.size?.name || "",
      colorName: selectedVariant.color?.name || "",
      sku: selectedVariant.sku,
      unitPrice: variantPrice,
      maxStock: selectedVariant.stock,
    });

    trackAddToCart({
      items: [
        mapProductToItem(product, { variant: selectedVariant, quantity }),
      ].filter(Boolean),
      value: variantPrice * quantity,
    });

    setAddedMsg("Producto agregado al carrito");
    setTimeout(() => setAddedMsg(""), 3000);
  };

  const isOutOfStock = !selectedVariant || selectedVariant.stock < 1;
  const showSizeGuide = isHatCategory(product.category);

  return (
    <>
      <div className="product-detail__grid">
        {/* ─── GALERÍA ─── */}
        <div className="product-detail__gallery">
          <div
            className="product-detail__main-image product-detail__main-image--clickable"
            onClick={() => setLightboxOpen(true)}
            role="button"
            tabIndex={0}
            aria-label="Ver imagen ampliada"
            onKeyDown={(e) => e.key === "Enter" && setLightboxOpen(true)}
          >
            <Image
              src={images[activeImage]?.url || product.mainImage}
              alt={images[activeImage]?.alt || product.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              style={{ objectFit: "cover" }}
              priority
              placeholder="blur"
              blurDataURL={SHIMMER_BLUR_DATA_URL}
            />
          </div>
          {images.length > 1 && (
            <div className="product-detail__thumbs">
              {images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  className={`product-detail__thumb${activeImage === i ? " product-detail__thumb--active" : ""}`}
                  onClick={() => setActiveImage(i)}
                >
                  <Image
                    src={img.url}
                    alt={img.alt || product.name}
                    width={72}
                    height={72}
                    style={{ objectFit: "cover" }}
                    placeholder="blur"
                    blurDataURL={SHIMMER_BLUR_DATA_URL}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── INFO ─── */}
        <div className="product-detail__info">
          <p className="product-detail__breadcrumb">
            <Link href="/catalogo">Catálogo</Link>
            {product.category?.name ? ` / ${product.category.name}` : ""} /{" "}
            {product.name}
          </p>

          <h1 className="product-detail__title">{product.name}</h1>

          <div className="product-detail__price-row">
            <span className="product-detail__price">
              {formatCOP(variantPrice)}
            </span>
            {hasPromo && (
              <span className="product-detail__price-old">
                {formatCOP(product.salePrice)}
              </span>
            )}
            {hasPromo && (
              <span className="product-detail__discount-badge">
                -{product.discountPercent}%
              </span>
            )}
          </div>

          {product.shortDescription ? (
            <p className="product-detail__short-desc">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="product-detail__attrs">
            {product.weaveType?.name && (
              <div className="product-detail__attr">
                <span className="product-detail__attr-label">Tejido</span>
                <span>{product.weaveType.name}</span>
              </div>
            )}
            {product.style?.name && (
              <div className="product-detail__attr">
                <span className="product-detail__attr-label">Horma</span>
                <span>{product.style.name}</span>
              </div>
            )}
            {product.material && (
              <div className="product-detail__attr">
                <span className="product-detail__attr-label">Material</span>
                <span>{product.material}</span>
              </div>
            )}
          </div>

          {/* ─── VARIANTES ─── */}
          <div className="product-detail__variants">
            {/* Talla */}
            <div className="product-detail__variant-group">
              <div className="product-detail__variant-header">
                <label>
                  Talla
                  {selectedSize && (
                    <span className="product-detail__selected-label">
                      {" "}—{" "}
                      {availableSizes.find(
                        (s) => String(s._id) === String(selectedSize)
                      )?.name}
                    </span>
                  )}
                </label>
                {showSizeGuide ? (
                  <button
                    type="button"
                    className={`product-detail__size-guide${sizeGuideOpen ? " product-detail__size-guide--open" : ""}`}
                    onClick={() => {
                      setSizeGuideOpen((open) => {
                        const next = !open;
                        if (next) {
                          requestAnimationFrame(() => {
                            sizeGuideRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "nearest",
                            });
                          });
                        }
                        return next;
                      });
                    }}
                    aria-expanded={sizeGuideOpen}
                    aria-controls="product-size-guide"
                  >
                    Guía de tallas
                  </button>
                ) : null}
              </div>
              <div className="product-detail__variant-options">
                {availableSizes.map((size) => {
                  const hasStock = product.variants?.some(
                    (v) =>
                      v.isActive &&
                      String(v.size?._id || v.size) === String(size._id) &&
                      v.stock > 0
                  );
                  return (
                    <button
                      key={size._id}
                      type="button"
                      className={`product-detail__variant-btn${String(selectedSize) === String(size._id) ? " product-detail__variant-btn--active" : ""}${!hasStock ? " product-detail__variant-btn--unavailable" : ""}`}
                      onClick={() => {
                        setSelectedSize(size._id);
                        setSelectedColor(null);
                      }}
                      title={!hasStock ? "Sin stock en esta talla" : size.name}
                    >
                      {size.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color */}
            {availableColors.length > 0 && (
              <div className="product-detail__variant-group">
                <label>
                  Color
                  {selectedColor && (
                    <span className="product-detail__selected-label">
                      {" "}—{" "}
                      {availableColors.find(
                        (c) => String(c._id) === String(selectedColor)
                      )?.name}
                    </span>
                  )}
                </label>
                <div className="product-detail__variant-options">
                  {availableColors.map((color) =>
                    color.hexCode ? (
                      <button
                        key={color._id}
                        type="button"
                        title={color.name}
                        aria-label={color.name}
                        className={`product-detail__color-swatch${String(selectedColor) === String(color._id) ? " product-detail__color-swatch--active" : ""}`}
                        style={{ backgroundColor: color.hexCode }}
                        onClick={() => setSelectedColor(color._id)}
                      />
                    ) : (
                      <button
                        key={color._id}
                        type="button"
                        className={`product-detail__variant-btn${String(selectedColor) === String(color._id) ? " product-detail__variant-btn--active" : ""}`}
                        onClick={() => setSelectedColor(color._id)}
                      >
                        {color.name}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── STOCK ALERT ─── */}
          <StockAlert stock={selectedVariant?.stock} />

          {/* ─── CANTIDAD ─── */}
          {!isOutOfStock && (
            <div className="product-detail__qty-row">
              <span className="product-detail__qty-label">Cantidad</span>
              <div className="product-detail__qty">
                <button
                  type="button"
                  className="product-detail__qty-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Reducir cantidad"
                >
                  −
                </button>
                <span className="product-detail__qty-value">{quantity}</span>
                <button
                  type="button"
                  className="product-detail__qty-btn"
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  aria-label="Aumentar cantidad"
                >
                  +
                </button>
              </div>
              {selectedVariant?.sku && (
                <span className="product-detail__sku">
                  SKU: {selectedVariant.sku}
                </span>
              )}
            </div>
          )}

          {/* ─── ACCIONES ─── */}
          <div className="product-detail__actions">
            <button
              type="button"
              className="product-detail__add-btn"
              disabled={isOutOfStock}
              onClick={handleAddToCart}
            >
              {isOutOfStock
                ? selectedVariant
                  ? "Sin stock"
                  : "Selecciona talla y color"
                : "Agregar al carrito"}
            </button>

            {product.allowsCustomization && (
              <Link
                href={`/personalizar?producto=${encodeURIComponent(product.slug)}`}
                className="product-detail__custom-btn"
              >
                Solicitar personalización
              </Link>
            )}
          </div>

          {addedMsg && (
            <p className="product-detail__added-msg">
              {addedMsg}{" "}
              <button
                type="button"
                className="product-detail__go-cart"
                onClick={() => router.push("/carrito")}
              >
                Ver carrito
              </button>
            </p>
          )}
        </div>
      </div>

      {showSizeGuide && sizeGuideOpen && (
        <div id="product-size-guide" ref={sizeGuideRef}>
          <SizeGuide
            variant="panel"
            onClose={() => setSizeGuideOpen(false)}
          />
        </div>
      )}

      {/* ─── LIGHTBOX ─── */}
      {lightboxOpen && (
        <div
          className="lightbox-backdrop"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
        >
          <button
            className="lightbox-close"
            onClick={closeLightbox}
            aria-label="Cerrar"
          >
            ✕
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[activeImage]?.url}
            alt={images[activeImage]?.alt || product.name}
            className="lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <>
              <button
                className="lightbox-nav lightbox-nav--prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1));
                }}
                aria-label="Imagen anterior"
              >
                ‹
              </button>
              <button
                className="lightbox-nav lightbox-nav--next"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage((i) =>
                    i === images.length - 1 ? 0 : i + 1
                  );
                }}
                aria-label="Imagen siguiente"
              >
                ›
              </button>
              <p className="lightbox-counter">
                {activeImage + 1} / {images.length}
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}

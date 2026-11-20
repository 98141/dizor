"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatCOP } from "@/lib/formatCurrency";
import { trackAddToCart, trackViewItem } from "@/lib/analytics/events";
import { mapProductToItem } from "@/lib/analytics/productMapper";
import SizeGuide from "@/components/products/SizeGuide";
import FavoriteButton from "@/components/products/FavoriteButton";
import ProductGallery from "@/components/products/ProductGallery";
import MobileBuyBar from "@/components/products/MobileBuyBar";
import {
  findVariant,
  getColorOptions,
  getSizeOptions,
  initialSelection,
  isMixedColor,
  selectSize,
  variantPricing,
} from "@/lib/productVariants";
import {
  resetWhatsAppContext,
  setWhatsAppContext,
} from "@/lib/whatsappContext";

const LOW_STOCK_THRESHOLD = 5;

function isHatCategory(category) {
  const haystack = [category?.slug, category?.name]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return haystack.includes("sombrero");
}

function StockAlert({ stock }) {
  if (!stock || stock > LOW_STOCK_THRESHOLD) return null;
  return (
    <p className="product-detail__stock-alert">
      {stock === 1 ? "Última unidad disponible" : `Últimas ${stock} unidades`}
    </p>
  );
}

// Recibe `product` ya resuelto por el Server Component (page.js) — sin
// fetch propio, sin estado de carga inicial: el contenido llega listo en
// el HTML servido por el servidor.
export default function ProductoClient({ product, description = null }) {
  const { addItem, items: cartItems, hydrated: cartHydrated } = useCart();
  const [selection, setSelection] = useState(() => initialSelection(product));
  const [variantNotice, setVariantNotice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cartStatus, setCartStatus] = useState(null); // { kind, text }
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const sizeGuideRef = useRef(null);
  const addBtnRef = useRef(null);

  const { sizeId: selectedSize, colorId: selectedColor } = selection;

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

  // WhatsApp: consulta con el nombre real del producto mientras se ve la PDP.
  useEffect(() => {
    setWhatsAppContext({
      message: `Hola! Tengo una pregunta sobre el producto: ${product.name}.`,
    });
    return () => resetWhatsAppContext();
  }, [product.name]);

  // WhatsApp cede la esquina inferior mientras el botón de compra pasa por
  // ella (en móvil el botón ocupa todo el ancho y quedaba tapado).
  // Medición por scroll (rAF) y no IntersectionObserver: la "zona" es una
  // franja fija del viewport, que IO no expresa sin un elemento propio.
  useEffect(() => {
    const btn = addBtnRef.current;
    if (!btn) return;
    const mq = window.matchMedia("(max-width: 767px)");
    let raf = 0;
    const check = () => {
      raf = 0;
      if (!mq.matches) {
        setWhatsAppContext({ yieldTo: null });
        return;
      }
      const r = btn.getBoundingClientRect();
      const vh = window.innerHeight;
      // El botón flotante ocupa ~[vh-70, vh-20] (50 px, bottom 20): se cede
      // con margen mientras el botón de compra cruza esa franja.
      const overlaps = r.bottom > vh - 84 && r.top < vh - 12;
      setWhatsAppContext({ yieldTo: overlaps ? "pdp-cta" : null });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      setWhatsAppContext({ yieldTo: null });
    };
  }, []);

  const sizeOptions = useMemo(() => getSizeOptions(product), [product]);
  const singleSize = sizeOptions.length === 1 ? sizeOptions[0] : null;
  const colorOptions = useMemo(
    () => getColorOptions(product, selectedSize),
    [product, selectedSize]
  );
  const selectedVariant = useMemo(
    () => findVariant(product, selectedSize, selectedColor),
    [product, selectedSize, selectedColor]
  );
  const selectedColorName = colorOptions.find((c) => c.id === selectedColor)?.name;
  const selectedSizeName = sizeOptions.find((s) => s.id === selectedSize)?.name;

  const pricing = variantPricing(product, selectedVariant);
  const stock = selectedVariant?.stock || 0;
  const inCartQty = cartHydrated
    ? cartItems.find(
        (i) =>
          i.productId === product.id &&
          String(i.variantId) === String(selectedVariant?.id)
      )?.quantity || 0
    : 0;
  const remaining = Math.max(0, stock - inCartQty);
  const maxQty = Math.max(1, remaining);
  const isOutOfStock = !!selectedVariant && stock < 1;
  const needsSelection = !selectedVariant;
  const productHasStock = sizeOptions.some((s) => s.available) ||
    (sizeOptions.length === 0 && colorOptions.some((c) => c.available));
  const allInCart = !!selectedVariant && stock > 0 && remaining < 1;

  const changeVariant = (next, notice = "") => {
    setSelection({ sizeId: next.sizeId, colorId: next.colorId });
    setVariantNotice(notice || "");
    setQuantity(1);
    setCartStatus(null);
  };

  const handleSize = (size) => {
    if (!size.available || size.id === selectedSize) return;
    const next = selectSize(product, size.id, selectedColor);
    changeVariant(next, next.notice);
  };

  const handleColor = (color) => {
    if (!color.available || color.id === selectedColor) return;
    changeVariant({ sizeId: selectedSize, colorId: color.id });
  };

  const handleAddToCart = () => {
    if (!selectedVariant || isOutOfStock) return;
    if (remaining < 1) {
      setCartStatus({
        kind: "error",
        text: `Ya tienes en el carrito las ${stock} unidades disponibles de esta variante.`,
      });
      return;
    }
    const qty = Math.min(quantity, remaining);

    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity: qty,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.mainImage,
      sizeName: selectedVariant.size?.name || "",
      colorName: selectedVariant.color?.name || "",
      sku: selectedVariant.sku,
      unitPrice: pricing.price,
      maxStock: selectedVariant.stock,
    });

    trackAddToCart({
      items: [
        mapProductToItem(product, { variant: selectedVariant, quantity: qty }),
      ].filter(Boolean),
      value: pricing.price * qty,
    });

    setQuantity(1);
    setCartStatus({
      kind: "success",
      text:
        qty === 1
          ? "Producto agregado al carrito."
          : `${qty} unidades agregadas al carrito.`,
    });
  };

  const showSizeGuide = isHatCategory(product.category);

  let ctaLabel = "Agregar al carrito";
  if (!productHasStock) ctaLabel = "Agotado";
  else if (isOutOfStock) ctaLabel = "Agotado en esta combinación";
  else if (needsSelection)
    ctaLabel = !selectedSize && sizeOptions.length > 1 ? "Elige una talla" : "Elige un color";
  const ctaDisabled = needsSelection || isOutOfStock || !productHasStock;

  // Barra móvil: mismas acciones; si falta elegir, lleva a los selectores.
  const missingSize = !selectedSize && sizeOptions.length > 1;
  const barCtaLabel = !productHasStock || isOutOfStock
    ? "Agotado"
    : needsSelection
      ? missingSize ? "Elegir talla" : "Elegir color"
      : "Agregar";
  const barSummary = [selectedColorName, selectedSizeName].filter(Boolean).join(" · ");
  const goToSelectors = () => {
    const box = document.getElementById("pdp-variantes");
    if (!box) return;
    box.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    const group = box.querySelector(
      missingSize ? ".product-detail__variant-group--size" : ".product-detail__variant-group:not(.product-detail__variant-group--size)"
    );
    group?.querySelector("button:not([aria-disabled='true'])")?.focus({ preventScroll: true });
  };

  const sizeGuideButton = showSizeGuide ? (
    <button
      type="button"
      className={`product-detail__size-guide${sizeGuideOpen ? " product-detail__size-guide--open" : ""}`}
      onClick={() => {
        setSizeGuideOpen((open) => {
          const next = !open;
          if (next) {
            requestAnimationFrame(() => {
              sizeGuideRef.current?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
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
  ) : null;

  return (
    <>
      <div className="product-detail__grid">
        {/* ─── GALERÍA ─── */}
        <ProductGallery product={product} />

        {/* ─── INFO ─── */}
        <div className="product-detail__info">
          <nav className="product-detail__breadcrumb" aria-label="Ruta de navegación">
            <ol>
              <li>
                <Link href="/catalogo">Catálogo</Link>
              </li>
              {product.category?.name ? <li>{product.category.name}</li> : null}
              <li aria-current="page">{product.name}</li>
            </ol>
          </nav>

          <div className="product-detail__title-row">
            <h1 className="product-detail__title">{product.name}</h1>
            <FavoriteButton
              product={product}
              className="product-detail__favorite"
              size={22}
            />
          </div>

          <div className="product-detail__price-row">
            <span className="product-detail__price">
              {pricing.oldPrice ? <span className="sr-only">Precio actual: </span> : null}
              {formatCOP(pricing.price)}
            </span>
            {pricing.oldPrice ? (
              <span className="product-detail__price-old">
                <span className="sr-only">Precio anterior: </span>
                {formatCOP(pricing.oldPrice)}
              </span>
            ) : null}
            {pricing.discountPercent ? (
              <span className="product-detail__discount-badge">
                <span className="sr-only">Descuento de </span>-{pricing.discountPercent}%
              </span>
            ) : null}
          </div>

          {product.shortDescription ? (
            <p className="product-detail__short-desc">{product.shortDescription}</p>
          ) : null}

          {(product.weaveType?.name || product.style?.name || product.material || singleSize) && (
            <dl className="product-detail__attrs">
              {product.weaveType?.name && (
                <div className="product-detail__attr">
                  <dt className="product-detail__attr-label">Tejido</dt>
                  <dd>{product.weaveType.name}</dd>
                </div>
              )}
              {product.style?.name && (
                <div className="product-detail__attr">
                  <dt className="product-detail__attr-label">Horma</dt>
                  <dd>{product.style.name}</dd>
                </div>
              )}
              {product.material && (
                <div className="product-detail__attr">
                  <dt className="product-detail__attr-label">Material</dt>
                  <dd>{product.material}</dd>
                </div>
              )}
              {singleSize && (
                <div className="product-detail__attr">
                  <dt className="product-detail__attr-label">Talla</dt>
                  <dd>
                    {singleSize.name}
                    {sizeGuideButton ? <> · {sizeGuideButton}</> : null}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* ─── VARIANTES ─── */}
          <div className="product-detail__variants" id="pdp-variantes">
            {sizeOptions.length > 1 && (
              <fieldset className="product-detail__variant-group product-detail__variant-group--size">
                <legend className="product-detail__legend">
                  Talla
                  {selectedSizeName ? (
                    <span className="product-detail__selected-label"> — {selectedSizeName}</span>
                  ) : null}
                </legend>
                {sizeGuideButton}
                <div className="product-detail__variant-options">
                  {sizeOptions.map((size) => {
                    const active = size.id === selectedSize;
                    return (
                      <button
                        key={size.id}
                        type="button"
                        className={`product-detail__variant-btn${active ? " product-detail__variant-btn--active" : ""}${!size.available ? " product-detail__variant-btn--unavailable" : ""}`}
                        aria-pressed={active}
                        aria-disabled={!size.available || undefined}
                        onClick={() => handleSize(size)}
                      >
                        {size.name}
                        {!size.available ? <span className="sr-only"> (agotada)</span> : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {colorOptions.length > 0 && (
              <fieldset className="product-detail__variant-group">
                <legend className="product-detail__legend">
                  Color
                  {selectedColorName ? (
                    <span className="product-detail__selected-label"> — {selectedColorName}</span>
                  ) : null}
                </legend>
                <div className="product-detail__variant-options product-detail__variant-options--colors">
                  {colorOptions.map((color) => {
                    const active = color.id === selectedColor;
                    const mixed = isMixedColor(color);
                    const stateClass = `${active ? " is-active" : ""}${!color.available ? " is-unavailable" : ""}`;
                    if (mixed || !color.hexCode) {
                      return (
                        <button
                          key={color.id}
                          type="button"
                          className={`product-detail__color-chip${stateClass}`}
                          aria-pressed={active}
                          aria-disabled={!color.available || undefined}
                          onClick={() => handleColor(color)}
                        >
                          {mixed ? (
                            <span className="product-detail__color-chip-dot" aria-hidden="true" />
                          ) : null}
                          {color.name}
                          {!color.available ? <span className="sr-only"> (agotado)</span> : null}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={color.id}
                        type="button"
                        title={color.name}
                        aria-label={`${color.name}${!color.available ? " (agotado)" : ""}`}
                        aria-pressed={active}
                        aria-disabled={!color.available || undefined}
                        className={`product-detail__color-swatch${stateClass}`}
                        onClick={() => handleColor(color)}
                      >
                        <span
                          className="product-detail__color-swatch-fill"
                          style={{ backgroundColor: color.hexCode }}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <p className="product-detail__variant-notice" role="status" aria-live="polite">
              {variantNotice}
            </p>
          </div>

          <StockAlert stock={selectedVariant?.stock} />

          {/* ─── CANTIDAD + COMPRA ─── */}
          <div className="product-detail__buy">
            {!ctaDisabled && (
              <div
                className="product-detail__qty"
                role="group"
                aria-labelledby="pdp-qty-label"
              >
                <span id="pdp-qty-label" className="sr-only">
                  Cantidad
                </span>
                <button
                  type="button"
                  className="product-detail__qty-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Reducir cantidad"
                >
                  −
                </button>
                <output className="product-detail__qty-value" aria-live="polite">
                  {quantity}
                </output>
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
            )}
            <button
              ref={addBtnRef}
              type="button"
              className="product-detail__add-btn"
              disabled={ctaDisabled}
              onClick={handleAddToCart}
            >
              {ctaLabel}
            </button>
          </div>

          <div className="product-detail__cart-status" role="status" aria-live="polite">
            {cartStatus ? (
              <p
                className={`product-detail__added-msg${cartStatus.kind === "error" ? " is-error" : ""}`}
              >
                {cartStatus.text}{" "}
                {cartStatus.kind === "success" || allInCart ? (
                  <Link href="/carrito" className="product-detail__go-cart">
                    Ver carrito
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>

          {(selectedVariant?.sku || product.allowsCustomization) && (
            <div className="product-detail__meta">
              {selectedVariant?.sku ? (
                <span className="product-detail__sku">SKU: {selectedVariant.sku}</span>
              ) : null}
              {product.allowsCustomization && (
                <Link
                  href={`/personalizar?producto=${encodeURIComponent(product.slug)}`}
                  className="product-detail__custom-btn"
                >
                  Solicitar personalización
                </Link>
              )}
            </div>
          )}

          {description}
        </div>
      </div>

      {showSizeGuide && sizeGuideOpen && (
        <div id="product-size-guide" ref={sizeGuideRef}>
          <SizeGuide variant="panel" onClose={() => setSizeGuideOpen(false)} />
        </div>
      )}

      <MobileBuyBar
        anchorRef={addBtnRef}
        productName={product.name}
        priceLabel={formatCOP(pricing.price)}
        summary={barSummary}
        ctaLabel={barCtaLabel}
        ctaDisabled={ctaDisabled}
        needsSelection={needsSelection && productHasStock}
        status={cartStatus}
        onAdd={handleAddToCart}
        onChoose={goToSelectors}
      />
    </>
  );
}

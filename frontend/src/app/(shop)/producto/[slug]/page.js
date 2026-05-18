"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/products/ProductCard";
import { useCart } from "@/context/CartContext";
import { getProductBySlug } from "@/services/productService";
import { formatCOP } from "@/lib/formatCurrency";

const resolveSlug = (slugParam) => {
  const raw = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return String(raw).trim();
  }
};

export default function ProductoPage() {
  const params = useParams();
  const slug = resolveSlug(params.slug);
  const router = useRouter();
  const { addItem } = useCart();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [addedMsg, setAddedMsg] = useState("");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setLoadError("");
    getProductBySlug(slug)
      .then((res) => {
        setData(res);
        const product = res.product;
        if (product.variants?.length) {
          const first = product.variants.find((v) => v.isActive && v.stock > 0);
          if (first) {
            setSelectedSize(first.size?._id || first.size);
            setSelectedColor(first.color?._id || first.color);
          }
        }
      })
      .catch((err) => {
        setData(null);
        setLoadError(
          err.response?.data?.message ||
            "No se pudo cargar el producto. Verifica que esté activo en la tienda."
        );
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const product = data?.product;

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
      if (size?._id) map.set(size._id, size);
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
      if (color?._id) map.set(color._id, color);
    });
    return [...map.values()];
  }, [product, selectedSize]);

  if (loading) {
    return <p className="auth-loading">Cargando producto...</p>;
  }

  if (!product) {
    return (
      <div className="catalog-empty">
        <p>{loadError || "Producto no encontrado."}</p>
        <Link href="/catalogo">Volver al catálogo</Link>
      </div>
    );
  }

  const hasPromo =
    product.onPromotion &&
    product.discountPercent > 0 &&
    product.effectivePrice < product.salePrice;

  const images = product.images?.length
    ? product.images
    : [{ url: product.mainImage, alt: product.name }];

  const variantPrice = selectedVariant?.price || product.effectivePrice;

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity: 1,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.mainImage,
      sizeName: selectedVariant.size?.name || "",
      colorName: selectedVariant.color?.name || "",
      sku: selectedVariant.sku,
      unitPrice: variantPrice,
      maxStock: selectedVariant.stock,
    });

    setAddedMsg("Producto agregado al carrito");
    setTimeout(() => setAddedMsg(""), 3000);
  };

  return (
    <article className="product-detail">
      {data?.preview && (
        <p className="product-detail__preview-banner" role="status">
          Vista previa: este producto está inactivo y no es visible en el catálogo
          público.
        </p>
      )}
      <div className="product-detail__grid">
        <div className="product-detail__gallery">
          <div className="product-detail__main-image">
            <Image
              src={images[activeImage]?.url || product.mainImage}
              alt={images[activeImage]?.alt || product.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              style={{ objectFit: "cover" }}
              priority
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
                    alt={img.alt || ""}
                    width={72}
                    height={72}
                    style={{ objectFit: "cover" }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-detail__info">
          <p className="product-detail__breadcrumb">
            <Link href="/catalogo">Catálogo</Link> / {product.name}
          </p>
          <h1 className="product-detail__title">{product.name}</h1>

          <div>
            <span className="product-detail__price">{formatCOP(variantPrice)}</span>
            {hasPromo && (
              <span className="product-detail__price-old">
                {formatCOP(product.salePrice)}
              </span>
            )}
          </div>

          <p>{product.shortDescription}</p>

          <div className="product-detail__attrs">
            <div className="product-detail__attr">
              <span className="product-detail__attr-label">Tejido</span>
              <span>{product.weaveType?.name}</span>
            </div>
            <div className="product-detail__attr">
              <span className="product-detail__attr-label">Horma</span>
              <span>{product.style?.name}</span>
            </div>
            <div className="product-detail__attr">
              <span className="product-detail__attr-label">Material</span>
              <span>{product.material}</span>
            </div>
          </div>

          <div className="product-detail__variants">
            <div className="product-detail__variant-group">
              <label>Talla</label>
              <div className="product-detail__variant-options">
                {availableSizes.map((size) => (
                  <button
                    key={size._id}
                    type="button"
                    className={`product-detail__variant-btn${String(selectedSize) === String(size._id) ? " product-detail__variant-btn--active" : ""}`}
                    onClick={() => {
                      setSelectedSize(size._id);
                      setSelectedColor(null);
                    }}
                  >
                    {size.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="product-detail__variant-group">
              <label>Color</label>
              <div className="product-detail__variant-options">
                {availableColors.map((color) => (
                  <button
                    key={color._id}
                    type="button"
                    className={`product-detail__variant-btn${String(selectedColor) === String(color._id) ? " product-detail__variant-btn--active" : ""}`}
                    onClick={() => setSelectedColor(color._id)}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="product-detail__add-btn"
            disabled={!selectedVariant || selectedVariant.stock < 1}
            onClick={handleAddToCart}
          >
            {selectedVariant?.stock > 0
              ? "Agregar al carrito"
              : "Selecciona talla y color disponibles"}
          </button>

          {product.allowsCustomization && (
            <Link
              href={`/personalizar?producto=${encodeURIComponent(product.slug)}`}
              className="product-detail__custom-btn"
            >
              Solicitar personalización
            </Link>
          )}

          {addedMsg && (
            <p style={{ color: "var(--color-success)", fontSize: "0.9rem" }}>
              {addedMsg}{" "}
              <button
                type="button"
                onClick={() => router.push("/carrito")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-primary)",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Ver carrito
              </button>
            </p>
          )}

          {selectedVariant && (
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              SKU: {selectedVariant.sku} · Stock: {selectedVariant.stock}
            </p>
          )}
        </div>
      </div>

      {product.fullDescription && (
        <div className="product-detail__description">
          <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}>
            Descripción
          </h2>
          <p>{product.fullDescription}</p>
        </div>
      )}

      {data.related?.length > 0 && (
        <section className="product-detail__related">
          <h2 className="product-detail__related-title">También te puede gustar</h2>
          <div className="products-grid">
            {data.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  createAdminProduct,
  getCatalogMeta,
  getAdminProduct,
  updateAdminProduct,
  uploadProductImages,
  uploadTempImages,
} from "@/services/adminCatalogService";

const emptyVariant = () => ({
  id: null,
  size: "",
  color: "",
  sku: "",
  stock: 0,
  price: "",
  isActive: true,
});

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

const generateSeed = () =>
  Math.random().toString(36).substring(2, 6).toUpperCase();

const extractSeedFromSku = (sku) => {
  const match = /^[A-Z0-9]{1,4}-([A-Z0-9]{4})-\d{2}$/i.exec(sku || "");
  return match ? match[1].toUpperCase() : null;
};

const generateSkuForVariant = (productName, seed, index) => {
  const prefix = (productName || "")
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase();
  return `${prefix || "PRD"}-${seed}-${String(index + 1).padStart(2, "0")}`;
};

const defaultForm = () => ({
  name: "",
  shortDescription: "",
  fullDescription: "",
  category: "",
  weaveType: "",
  style: "",
  material: "Palma de iraca",
  salePrice: "",
  internalCost: "",
  discountPercent: 0,
  onPromotion: false,
  isActive: true,
  isFeatured: false,
  isNew: false,
  allowsCustomization: false,
  seoTitle: "",
  seoDescription: "",
  images: [],
  mainImage: "",
  variants: [emptyVariant()],
});

export default function ProductForm({ productId }) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  const skuSeedRef = useRef(generateSeed());

  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState("");

  const MAX_IMAGES = 10;
  const MAX_BATCH = 3;

  useEffect(() => {
    const load = async () => {
      try {
        const metaRes = await getCatalogMeta();
        setMeta(metaRes.meta);

        if (isEdit) {
          const { product } = await getAdminProduct(productId);
          setForm({
            name: product.name || "",
            shortDescription: product.shortDescription || "",
            fullDescription: product.fullDescription || "",
            category:
              product.category?._id ||
              product.category?.id ||
              product.category ||
              "",
            weaveType:
              product.weaveType?._id ||
              product.weaveType?.id ||
              product.weaveType ||
              "",
            style:
              product.style?._id ||
              product.style?.id ||
              product.style ||
              "",
            material: product.material || "Palma de iraca",
            salePrice: product.salePrice ?? "",
            internalCost: product.internalCost ?? "",
            discountPercent: product.discountPercent ?? 0,
            onPromotion: Boolean(product.onPromotion),
            isActive: product.isActive !== false,
            isFeatured: Boolean(product.isFeatured),
            isNew: Boolean(product.isNew),
            allowsCustomization: Boolean(product.allowsCustomization),
            seoTitle: product.seoTitle || "",
            seoDescription: product.seoDescription || "",
            images: (product.images || []).map((img) => ({
              url: img.url,
              alt: img.alt || product.name,
            })),
            mainImage: product.mainImage || "",
            variants:
              product.variants?.length > 0
                ? product.variants.map((v) => ({
                    id: v.id || v._id || null,
                    size: v.size?.toString?.() || v.size || "",
                    color: v.color?.toString?.() || v.color || "",
                    sku: v.sku || "",
                    stock: v.stock ?? 0,
                    price: v.price ?? "",
                    isActive: v.isActive !== false,
                  }))
                : [emptyVariant()],
          });
          const firstSku = product.variants?.[0]?.sku;
          const extracted = extractSeedFromSku(firstSku);
          if (extracted) skuSeedRef.current = extracted;
        }
      } catch (err) {
        setError(err.response?.data?.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId, isEdit]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setVariant = (index, key, value) => {
    setForm((prev) => {
      const variants = [...prev.variants];
      variants[index] = { ...variants[index], [key]: value };
      return { ...prev, variants };
    });
  };

  const handleNameChange = (value) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      variants: isEdit
        ? prev.variants
        : prev.variants.map((v, i) => ({
            ...v,
            sku: generateSkuForVariant(value, skuSeedRef.current, i),
          })),
    }));
  };

  const addVariant = () => {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          ...emptyVariant(),
          sku: generateSkuForVariant(prev.name, skuSeedRef.current, prev.variants.length),
        },
      ],
    }));
  };

  const removeVariant = (index) => {
    setForm((prev) => {
      if (prev.variants.length <= 1) return prev;
      return {
        ...prev,
        variants: prev.variants.filter((_, i) => i !== index),
      };
    });
  };

  const addImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setForm((prev) => {
      const images = [...prev.images, { url, alt: prev.name || "Producto" }];
      return {
        ...prev,
        images,
        mainImage: prev.mainImage || url,
      };
    });
    setNewImageUrl("");
  };

  const MAX_FILE_BYTES = 10 * 1024 * 1024;

  const validateFiles = (files) => {
    if (files.length > MAX_BATCH)
      return `Selecciona máximo ${MAX_BATCH} imágenes por subida`;
    const oversized = files.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized)
      return `"${oversized.name}" supera el límite de peso de 10 MB. Reduce el tamaño o usa otra imagen.`;
    return null;
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    const remaining = MAX_IMAGES - form.images.length;
    if (files.length > remaining) {
      setError(
        remaining === 0
          ? "El producto ya tiene el máximo de 10 imágenes"
          : `Solo puedes agregar ${remaining} imagen${remaining !== 1 ? "es" : ""} más (máximo ${MAX_IMAGES})`
      );
      return;
    }

    setUploadingCount(files.length);
    setUploading(true);
    setError("");
    try {
      if (productId) {
        const data = await uploadProductImages(productId, files);
        setForm((prev) => ({
          ...prev,
          images: data.images || prev.images,
          mainImage: data.mainImage || prev.mainImage,
        }));
      } else {
        const data = await uploadTempImages(files);
        const newImages = data.images || [];
        setForm((prev) => {
          const combined = [...prev.images, ...newImages];
          return {
            ...prev,
            images: combined,
            mainImage: prev.mainImage || newImages[0]?.url || "",
          };
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error al subir imágenes");
    } finally {
      setUploading(false);
      setUploadingCount(0);
    }
  };

  const removeImage = (index) => {
    setForm((prev) => {
      const images = prev.images.filter((_, i) => i !== index);
      let mainImage = prev.mainImage;
      if (!images.find((img) => img.url === mainImage)) {
        mainImage = images[0]?.url || "";
      }
      return { ...prev, images, mainImage };
    });
  };

  const setMainImage = (url) => {
    setField("mainImage", url);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    shortDescription: form.shortDescription.trim(),
    fullDescription: form.fullDescription.trim(),
    category: form.category,
    weaveType: form.weaveType,
    style: form.style,
    material: form.material.trim() || "Palma de iraca",
    salePrice: Number(form.salePrice),
    internalCost:
      form.internalCost === "" ? undefined : Number(form.internalCost),
    discountPercent: Number(form.discountPercent) || 0,
    onPromotion: form.onPromotion,
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    isNew: form.isNew,
    allowsCustomization: form.allowsCustomization,
    seoTitle: form.seoTitle.trim() || form.name.trim(),
    seoDescription: form.seoDescription.trim(),
    images: form.images.map((img) => ({
      url: img.url,
      alt: img.alt || form.name,
    })),
    mainImage: form.mainImage || form.images[0]?.url,
    variants: form.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      size: v.size,
      color: v.color,
      sku: String(v.sku).trim().toUpperCase(),
      stock: Number(v.stock) || 0,
      price:
        v.price === "" || v.price == null ? null : Number(v.price),
      isActive: v.isActive !== false,
    })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!form.images.length) {
      setError("Agrega al menos una imagen antes de guardar");
      setSaving(false);
      return;
    }

    if (!form.category || !form.weaveType || !form.style) {
      setError("Selecciona categoría, tejido y estilo");
      setSaving(false);
      return;
    }

    try {
      const payload = buildPayload();
      if (isEdit) {
        await updateAdminProduct(productId, payload);
        router.push("/admin/productos");
      } else {
        await createAdminProduct(payload);
        router.push("/admin/productos");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "No se pudo guardar el producto"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="auth-loading">Cargando producto…</p>;
  }

  const categories = meta?.categories || [];
  const colors = meta?.colors || [];
  const sizes = meta?.sizes || [];
  const weaveTypes = meta?.weaveTypes || [];
  const styles = meta?.styles || [];

  return (
    <form className="product-form admin-form" onSubmit={handleSubmit}>
      {error && <p className="admin-form-error">{error}</p>}

      <p className="product-form__hint">
        Configura taxonomías en{" "}
        <Link href="/admin/catalogo">Catálogo base</Link> si faltan opciones.
      </p>

      <section className="product-form__section">
        <h2>Información general</h2>
        <div className="admin-form__row">
          <div className="admin-form__group admin-form__group--wide">
            <label htmlFor="name">Nombre *</label>
            <input
              id="name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>
          <div className="admin-form__group">
            <label htmlFor="material">Material</label>
            <input
              id="material"
              value={form.material}
              onChange={(e) => setField("material", e.target.value)}
            />
          </div>
        </div>

        <div className="admin-form__group">
          <label htmlFor="shortDescription">Descripción corta</label>
          <textarea
            id="shortDescription"
            rows={2}
            value={form.shortDescription}
            onChange={(e) => setField("shortDescription", e.target.value)}
          />
        </div>
        <div className="admin-form__group">
          <label htmlFor="fullDescription">Descripción completa</label>
          <textarea
            id="fullDescription"
            rows={12}
            value={form.fullDescription}
            onChange={(e) => setField("fullDescription", e.target.value)}
            placeholder={`Ejemplo:

Sombrero tejido a mano en palma de iraca.

# Material y origen
Fibra natural de Sandoná, Nariño.

# Detalles
- Ala flexible
- Acabado a mano
- Ideal para clima cálido

![Detalle del tejido](https://res.cloudinary.com/.../detalle.jpg)`}
          />
          <p className="image-upload-hint">
            Formato: línea en blanco = nuevo bloque.{" "}
            <code># Título</code> o <code>#Título</code> se muestra en
            mayúsculas y negrita (sin el #).{" "}
            <code>- texto</code> = viñeta con sangría. Enter = salto de línea.{" "}
            <code>![texto alt](url)</code> = imagen (el texto entre{" "}
            <code>[]</code> no se ve en pantalla, solo ayuda a accesibilidad).
            Las fotos principales van en la galería del producto.
          </p>
        </div>

        <div className="admin-form__row">
          <div className="admin-form__group">
            <label htmlFor="category">Categoría *</label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form__group">
            <label htmlFor="weaveType">Tejido *</label>
            <select
              id="weaveType"
              value={form.weaveType}
              onChange={(e) => setField("weaveType", e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {weaveTypes.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form__group">
            <label htmlFor="style">Estilo / horma *</label>
            <select
              id="style"
              value={form.style}
              onChange={(e) => setField("style", e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {styles.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="product-form__section">
        <h2>Precios</h2>
        <div className="admin-form__row">
          <div className="admin-form__group">
            <label htmlFor="salePrice">Precio venta (COP) *</label>
            <input
              id="salePrice"
              type="number"
              min="0"
              value={form.salePrice}
              onChange={(e) => setField("salePrice", e.target.value)}
              required
            />
          </div>
          <div className="admin-form__group">
            <label htmlFor="internalCost">Costo interno (COP)</label>
            <input
              id="internalCost"
              type="number"
              min="0"
              value={form.internalCost}
              onChange={(e) => setField("internalCost", e.target.value)}
            />
          </div>
          <div className="admin-form__group">
            <label htmlFor="discountPercent">Descuento %</label>
            <input
              id="discountPercent"
              type="number"
              min="0"
              max="100"
              value={form.discountPercent}
              onChange={(e) => setField("discountPercent", e.target.value)}
            />
          </div>
        </div>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={form.onPromotion}
            onChange={(e) => setField("onPromotion", e.target.checked)}
          />
          En promoción
        </label>
      </section>

      <section className="product-form__section">
        <h2>Variantes (talla + color)</h2>
        {form.variants.map((variant, index) => (
          <div key={index} className="variant-row">
            <select
              value={variant.size}
              onChange={(e) => setVariant(index, "size", e.target.value)}
              required
              aria-label={`Talla variante ${index + 1}`}
            >
              <option value="">Talla</option>
              {sizes.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={variant.color}
              onChange={(e) => setVariant(index, "color", e.target.value)}
              required
              aria-label={`Color variante ${index + 1}`}
            >
              <option value="">Color</option>
              {colors.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              readOnly
              value={variant.sku}
              aria-label={`SKU variante ${index + 1}`}
              title="SKU generado automáticamente"
              style={{ background: "var(--color-bg)", cursor: "default", color: "var(--color-text-muted)", minWidth: 0 }}
            />
            <input
              type="number"
              min="0"
              placeholder="Stock"
              value={variant.stock}
              onChange={(e) => setVariant(index, "stock", e.target.value)}
              required
            />
            <input
              type="number"
              min="0"
              placeholder="Precio opcional"
              value={variant.price}
              onChange={(e) => setVariant(index, "price", e.target.value)}
            />
            <label className="admin-checkbox admin-checkbox--inline">
              <input
                type="checkbox"
                checked={variant.isActive}
                onChange={(e) =>
                  setVariant(index, "isActive", e.target.checked)
                }
              />
              Activa
            </label>
            {form.variants.length > 1 && (
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--danger"
                onClick={() => removeVariant(index)}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
        <button type="button" className="admin-btn" onClick={addVariant}>
          + Variante
        </button>
      </section>

      <section className="product-form__section">
        <h2>
          Imágenes
          <span
            className={`image-count-badge${form.images.length >= MAX_IMAGES ? " image-count-badge--full" : ""}`}
          >
            {form.images.length} / {MAX_IMAGES}
          </span>
        </h2>

        {meta?.cloudinaryConfigured ? (
          <div className="image-upload-block">
            <label
              className={`admin-btn admin-btn--sm image-upload-label${uploading ? " is-uploading" : ""}`}
            >
              {uploading ? (
                <>
                  <span className="upload-spinner" aria-hidden="true" />
                  Subiendo {uploadingCount} imagen{uploadingCount !== 1 ? "es" : ""}…
                </>
              ) : (
                "Subir desde equipo"
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={uploading || form.images.length >= MAX_IMAGES}
                onChange={handleFileUpload}
              />
            </label>
            <p className="image-upload-hint">
              Máx. {MAX_BATCH} archivos por subida · 10 MB c/u · JPG, PNG, WebP
            </p>
          </div>
        ) : (
          <p className="image-upload-hint image-upload-hint--info">
            Para subir archivos desde tu equipo, agrega{" "}
            <strong>CLOUDINARY_CLOUD_NAME</strong>,{" "}
            <strong>CLOUDINARY_API_KEY</strong> y{" "}
            <strong>CLOUDINARY_API_SECRET</strong> en el <code>.env</code> del
            backend y reinicia el servidor.
          </p>
        )}

        <div className="image-section-divider">
          <span>o agrega por enlace</span>
        </div>

        <div className="image-url-add">
          <input
            type="url"
            placeholder="https://… URL de imagen"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addImage();
              }
            }}
          />
          <button
            type="button"
            className="admin-btn"
            onClick={addImage}
            disabled={form.images.length >= MAX_IMAGES}
          >
            Agregar
          </button>
        </div>

        {form.images.length > 0 && (
          <ul className="image-list">
            {form.images.map((img, index) => (
              <li key={`${img.url}-${index}`}>
                <img
                  src={img.url}
                  alt={img.alt}
                  width={72}
                  height={72}
                  loading="lazy"
                  decoding="async"
                />
                <div className="image-list__meta">
                  <button
                    type="button"
                    className={
                      form.mainImage === img.url
                        ? "admin-btn admin-btn--sm admin-btn--primary"
                        : "admin-btn admin-btn--sm"
                    }
                    onClick={() => setMainImage(img.url)}
                  >
                    {form.mainImage === img.url ? "Principal" : "Hacer principal"}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--danger"
                    onClick={() => removeImage(index)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="product-form__section">
        <h2>Visibilidad y SEO</h2>
        <div className="admin-form__flags">
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField("isActive", e.target.checked)}
            />
            Activo en tienda
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setField("isFeatured", e.target.checked)}
            />
            Destacado
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isNew}
              onChange={(e) => setField("isNew", e.target.checked)}
            />
            Nuevo
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.allowsCustomization}
              onChange={(e) =>
                setField("allowsCustomization", e.target.checked)
              }
            />
            Permite personalización
          </label>
        </div>
        <div className="admin-form__group">
          <label htmlFor="seoTitle">Título SEO</label>
          <input
            id="seoTitle"
            value={form.seoTitle}
            onChange={(e) => setField("seoTitle", e.target.value)}
          />
        </div>
        <div className="admin-form__group">
          <label htmlFor="seoDescription">Descripción SEO</label>
          <textarea
            id="seoDescription"
            rows={2}
            value={form.seoDescription}
            onChange={(e) => setField("seoDescription", e.target.value)}
          />
        </div>
      </section>

      <div className="admin-form__actions">
        <button
          type="submit"
          className="admin-btn admin-btn--primary"
          disabled={saving}
        >
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
        </button>
        <Link href="/admin/productos" className="admin-btn">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

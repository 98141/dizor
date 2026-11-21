"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  adjustProductStock,
  createAdminProduct,
  getCatalogMeta,
  getAdminProduct,
  updateAdminProduct,
  uploadProductImages,
  uploadTempImages,
} from "@/services/adminCatalogService";

const newClientKey = () =>
  `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const emptyVariant = () => ({
  clientKey: newClientKey(),
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
  const match = /^[A-Z0-9]{1,4}-([A-Z0-9]{4})-\d{2,}$/i.exec(sku || "");
  return match ? match[1].toUpperCase() : null;
};

const skuPrefixFromName = (productName) =>
  (productName || "")
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase() || "PRD";

const parseSkuSeq = (sku, seed) => {
  const match = new RegExp(`^[A-Z0-9]{1,4}-${seed}-(\\d{2,})$`, "i").exec(
    sku || ""
  );
  return match ? Number.parseInt(match[1], 10) : null;
};

const usedSkuSet = (variants) =>
  new Set(
    (variants || [])
      .map((v) => String(v.sku || "").trim().toUpperCase())
      .filter(Boolean)
  );

const generateUniqueSku = (productName, seed, variants) => {
  const prefix = skuPrefixFromName(productName);
  const existing = usedSkuSet(variants);
  let seq = 0;
  for (const v of variants || []) {
    const n = parseSkuSeq(v.sku, seed);
    if (n != null && n > seq) seq = n;
  }
  seq += 1;
  let sku = `${prefix}-${seed}-${String(seq).padStart(2, "0")}`;
  while (existing.has(sku)) {
    seq += 1;
    sku = `${prefix}-${seed}-${String(seq).padStart(2, "0")}`;
  }
  return sku;
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

export default function ProductForm({ productId, returnTo = "/admin/productos" }) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  // Semilla estable por montaje (estado, no ref: se lee durante el render inicial).
  const [initialSkuSeed] = useState(generateSeed);
  const skuSeedRef = useRef(initialSkuSeed);

  const saveRef = useRef(false), savedRef = useRef(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(() => {
    const initial = defaultForm();
    initial.variants[0].sku = generateUniqueSku("", initialSkuSeed, []);
    return initial;
  });
  const [newImageUrl, setNewImageUrl] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState("");
  const [adjustmentStates, setAdjustmentStates] = useState({});
  // Refs are updated synchronously: a second click in the same render sees
  // the pending operation, including its immutable payload and idempotency key.
  const inFlightAdjustmentsRef = useRef(new Map());

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
              publicId: img.publicId || null,
              alt: img.alt || product.name,
            })),
            mainImage: product.mainImage || "",
            variants:
              product.variants?.length > 0
                ? product.variants.map((v) => ({
                    clientKey: String(v.id || v._id || newClientKey()),
                    id: v.id || v._id || null,
                    size: v.size?.toString?.() || v.size || "",
                    color: v.color?.toString?.() || v.color || "",
                    sku: v.sku || "",
                    stock: v.stock ?? "",
                    price: v.price ?? "",
                    isActive: v.isActive !== false,
                  }))
                : [],
          });
          const firstSku = product.variants?.[0]?.sku;
          const extracted = extractSeedFromSku(firstSku);
          if (extracted) skuSeedRef.current = extracted;
        }
      } catch (err) {
        setError(err.response?.data?.message || "Error al cargar datos"); setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId, isEdit, loadAttempt]);

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
    setForm((prev) => {
      if (isEdit) return { ...prev, name: value };
      const seed = skuSeedRef.current;
      const assigned = [];
      const variants = prev.variants.map((v) => {
        const next = {
          ...v,
          sku: generateUniqueSku(value, seed, assigned),
        };
        assigned.push(next);
        return next;
      });
      return { ...prev, name: value, variants };
    });
  };

  const addVariant = () => {
    setForm((prev) => {
      const next = {
        ...emptyVariant(),
        sku: generateUniqueSku(prev.name, skuSeedRef.current, prev.variants),
      };
      return { ...prev, variants: [...prev.variants, next] };
    });
  };

  const removeVariant = (index) => {
    setForm((prev) => {
      if (prev.variants.length <= 1) return prev;
      return {
        ...prev,
        variants: prev.variants[index]?.id ? prev.variants.map((v, i) => i === index ? { ...v, isActive: false } : v) : prev.variants.filter((_, i) => i !== index),
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
    weaveType: form.weaveType || null,
    style: form.style || null,
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
      publicId: img.publicId || null,
      alt: img.alt || form.name,
    })),
    mainImage: form.mainImage || form.images[0]?.url,
    variants: form.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      size: v.size || null,
      color: v.color || null,
      sku: String(v.sku).trim().toUpperCase(),
      ...(!v.id ? { stock: Number(v.stock) || 0 } : {}),
      price:
        v.price === "" || v.price == null ? null : Number(v.price),
      isActive: v.isActive !== false,
    })),
  });

  const handleStockAdjustment = async (index) => {
    const variant = form.variants[index];
    if (!variant?.id) return;
    const operations = inFlightAdjustmentsRef.current;
    let operation = operations.get(variant.id);
    if (operation?.inFlight || operation?.completed) return;
    const delta = Number(variant.adjustmentDelta);
    if (!Number.isSafeInteger(delta) || delta === 0 || !variant.adjustmentReason?.trim()) { setError("Registra una cantidad entera distinta de cero y el motivo del ajuste"); return; }
    if (!operation) {
      operation = { payload: { variantId: variant.id, delta,
        reason: variant.adjustmentReason.trim(), operationKey: crypto.randomUUID() } };
      operations.set(variant.id, operation);
    }
    operation.inFlight = true;
    setAdjustmentStates((prev) => ({ ...prev, [variant.id]: { status: "processing", message: "Registrando ajuste…" } }));
    try {
      const result = await adjustProductStock(productId, operation.payload);
      operation.completed = true;
      setForm((prev) => ({ ...prev, variants: prev.variants.map((v) => v.id === variant.id
        ? { ...v, stock: result.currentStock ?? result.stock, adjustmentDelta: "", adjustmentReason: "" } : v) }));
      setAdjustmentStates((prev) => ({ ...prev, [variant.id]: { status: "success", message: `Ajuste registrado. Stock: ${result.currentStock ?? result.stock}.` } }));
      setError("");
    } catch (err) {
      const status = err.response?.status;
      // Explicit business rejections permit correcting the form. Ambiguous
      // network/5xx errors retain the original key AND payload for a safe retry.
      const retryPending = ![400, 403, 404, 409, 422].includes(status);
      if (!retryPending) operations.delete(variant.id);
      const message = err.response?.data?.message || "No se pudo confirmar el ajuste. Reintenta la misma operación.";
      setAdjustmentStates((prev) => ({ ...prev, [variant.id]: { status: "error", message, retryPending } }));
    } finally {
      operation.inFlight = false;
    }
  };

  const setAdjustmentField = (index, key, value) => {
    const variant = form.variants[index];
    const operation = inFlightAdjustmentsRef.current.get(variant.id);
    if (operation?.inFlight || (operation && !operation.completed)) return;
    inFlightAdjustmentsRef.current.delete(variant.id);
    setAdjustmentStates((prev) => ({ ...prev, [variant.id]: null }));
    setVariant(index, key, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saveRef.current || savedRef.current) return;
    saveRef.current = true;
    setSaving(true);
    setError("");

    if (!form.images.length) {
      setError("Agrega al menos una imagen antes de guardar");
      setSaving(false); saveRef.current = false;
      return;
    }

    if (!form.category) {
      setError("Selecciona la categoría");
      setSaving(false); saveRef.current = false;
      return;
    }

    const skus = form.variants.map((v) =>
      String(v.sku || "").trim().toUpperCase()
    );
    if (skus.some((sku) => !sku)) {
      setError("Cada variante necesita un SKU");
      setSaving(false); saveRef.current = false;
      return;
    }
    if (new Set(skus).size !== skus.length) {
      setError("Hay SKUs duplicados. Cada variante debe tener un código único.");
      setSaving(false); saveRef.current = false;
      return;
    }
    const combos = form.variants.filter((v) => v.isActive !== false).map((v) => `${v.size || ""}|${v.color || ""}`);
    if (new Set(combos).size !== combos.length) {
      setError("Hay variantes con la misma talla y color");
      setSaving(false); saveRef.current = false;
      return;
    }

    try {
      const payload = buildPayload();
      if (isEdit) {
        await updateAdminProduct(productId, payload);
        savedRef.current = true; router.push(returnTo);
      } else {
        await createAdminProduct(payload);
        savedRef.current = true; router.push(returnTo);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          "No se pudo guardar el producto"
      );
    } finally {
      setSaving(false); saveRef.current = false;
    }
  };

  if (loading) {
    return <p className="auth-loading">Cargando producto…</p>;
  }

  if (loadFailed) return <div role="alert"><p>{error}</p><button type="button" className="admin-btn" onClick={() => { setLoadFailed(false); setLoading(true); setLoadAttempt((n) => n + 1); }}>Reintentar carga del producto</button><Link href={returnTo}>Volver a productos</Link></div>;

  const categories = meta?.categories || [];
  const colors = meta?.colors || [];
  const sizes = meta?.sizes || [];
  // Solo opciones activas (más la ya asignada, para no perderla al editar).
  const usable = (list, current) =>
    (list || []).filter((i) => i.isActive !== false || i._id === current);
  const weaveTypes = usable(meta?.weaveTypes, form.weaveType);
  const styles = usable(meta?.styles, form.style);

  const skuDupSet = new Set();
  const comboDupSet = new Set();
  {
    const skuCount = {};
    const comboCount = {};
    form.variants.forEach((v) => {
      const sku = String(v.sku || "").trim().toUpperCase();
      if (sku) skuCount[sku] = (skuCount[sku] || 0) + 1;
      if (v.isActive !== false) {
        const combo = `${v.size || ""}|${v.color || ""}`;
        comboCount[combo] = (comboCount[combo] || 0) + 1;
      }
    });
    Object.entries(skuCount).forEach(([sku, n]) => {
      if (n > 1) skuDupSet.add(sku);
    });
    Object.entries(comboCount).forEach(([combo, n]) => {
      if (n > 1) comboDupSet.add(combo);
    });
  }

  return (
    <form className="product-form admin-form" onSubmit={handleSubmit}>
      {error && <p role="alert" className="admin-form-error">{error}</p>}

      <div className="product-form__navigation"><Link href={returnTo}>← Volver a la lista filtrada</Link><nav aria-label="Secciones del producto"><a href="#product-general">Información</a><a href="#product-images">Imágenes</a><a href="#product-price">Precio y promoción</a><a href="#product-variants">Variantes</a><a href="#product-publication">Publicación</a></nav></div>
      <p className="product-form__hint">
        Configura taxonomías en{" "}
        <Link href="/admin/catalogo">Catálogo base</Link> si faltan opciones.
      </p>

      <section id="product-general" className="product-form__section">
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
            <label htmlFor="weaveType">Tejido</label>
            <select
              id="weaveType"
              value={form.weaveType}
              onChange={(e) => setField("weaveType", e.target.value)}
            >
              <option value="">No aplica</option>
              {weaveTypes.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form__group">
            <label htmlFor="style">Estilo / horma</label>
            <select
              id="style"
              value={form.style}
              onChange={(e) => setField("style", e.target.value)}
            >
              <option value="">No aplica</option>
              {styles.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="image-upload-hint">
          Tejido y horma describen sombreros: en bolsos o accesorios deja
          «No aplica» en lo que no corresponda (no uses el nombre de la
          categoría como horma). Así los filtros del catálogo muestran solo
          opciones reales.
        </p>
      </section>

<section id="product-images" className="product-form__section">
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
            La carga de archivos no está disponible en este entorno. Puedes agregar imágenes por enlace o consultar al responsable de configuración.
          </p>
        )}

        <div className="image-section-divider">
          <span>o agrega por enlace</span>
        </div>

        <div className="image-url-add">
          <input
            type="url"
            aria-label="URL de imagen"
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

<section id="product-price" className="product-form__section">
        <h2>Precio y promoción</h2>
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

<section id="product-variants" className="product-form__section">
        <h2>Presentaciones y variantes</h2>
        <p className="product-form__hint product-form__hint--tight">
          El SKU identifica cada presentación. Talla y color son opcionales: no agregues opciones que el producto no necesita. El stock existente se modifica con ajustes relativos, no al guardar estos datos.
        </p>
        <div className="variant-table-wrap">
          <div className="variant-table">
            <div className="variant-table__head" aria-hidden="true">
              <span>Talla</span>
              <span>Color</span>
              <span>SKU</span>
              <span>Stock</span>
              <span>Precio</span>
              <span>Activa</span>
              <span />
            </div>
            {form.variants.map((variant, index) => {
              const skuKey = String(variant.sku || "").trim().toUpperCase();
              const comboKey =
                variant.isActive !== false
                  ? `${variant.size || ""}|${variant.color || ""}`
                  : "";
              const hasError =
                skuDupSet.has(skuKey) || comboDupSet.has(comboKey);
              return (
                <div
                  key={variant.clientKey || variant.id || `variant-${index}`}
                  className={`variant-row${hasError ? " variant-row--error" : ""}`}
                >
                  <label>Talla (opcional)<select
                    value={variant.size}
                    onChange={(e) => setVariant(index, "size", e.target.value)}
                    aria-label={`Talla variante ${index + 1}`}
                  >
                    <option value="">No aplica</option>
                    {sizes.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select></label>
                  <label>Color (opcional)<select
                    value={variant.color}
                    onChange={(e) => setVariant(index, "color", e.target.value)}
                    aria-label={`Color variante ${index + 1}`}
                  >
                    <option value="">No aplica</option>
                    {colors.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select></label>
                  <label>SKU<input
                    className="variant-row__sku"
                    onChange={(e) => setVariant(index, "sku", e.target.value.toUpperCase())}
                    value={variant.sku}
                    aria-label={`SKU variante ${index + 1}`}
                    title="SKU único de la presentación"
                    autoComplete="off"
                  /></label>
                  <label>Existencias<input
                    type="number"
                    min="0"
                    placeholder="0"
                    step="1"
                    readOnly={!!variant.id}
                    title={variant.id ? "El stock se cambia mediante un ajuste con motivo" : "Stock inicial"}
                    value={variant.stock}
                    onChange={(e) => setVariant(index, "stock", e.target.value)}
                    required={!variant.id}
                    aria-label={`Stock variante ${index + 1}`}
                  /></label>
                  <label>Precio propio (opcional)<input
                    type="number"
                    min="0"
                    placeholder="Opcional"
                    value={variant.price}
                    onChange={(e) => setVariant(index, "price", e.target.value)}
                    aria-label={`Precio variante ${index + 1}`}
                  /></label>
                  <label className="admin-checkbox admin-checkbox--inline">
                    <input
                      type="checkbox"
                      checked={variant.isActive}
                      onChange={(e) =>
                        setVariant(index, "isActive", e.target.checked)
                      }
                    />
                    <span className="variant-row__active-label">Activa</span>
                  </label>
                  {variant.id && <details className="variant-adjustment-legacy"><summary>Ajuste relativo en este formulario</summary><p>Al registrar confirmas el ajuste con motivo. Stock previsto: {variant.stock + (Number(variant.adjustmentDelta) || 0)}. El resultado se comprueba en el servidor.</p>
                    <input type="number" step="1" placeholder="Ajuste + / −" aria-label="Cantidad del ajuste"
                      disabled={adjustmentStates[variant.id]?.status === "processing" || adjustmentStates[variant.id]?.retryPending}
                      value={variant.adjustmentDelta || ""} onChange={(e) => setAdjustmentField(index, "adjustmentDelta", e.target.value)} />
                    <input placeholder="Motivo del ajuste" aria-label="Motivo del ajuste"
                      disabled={adjustmentStates[variant.id]?.status === "processing" || adjustmentStates[variant.id]?.retryPending}
                      value={variant.adjustmentReason || ""} onChange={(e) => setAdjustmentField(index, "adjustmentReason", e.target.value)} />
                    <button type="button" className="admin-btn" onClick={() => handleStockAdjustment(index)}
                      disabled={adjustmentStates[variant.id]?.status === "processing"}>
                      {adjustmentStates[variant.id]?.status === "processing" ? "Registrando…" : adjustmentStates[variant.id]?.retryPending ? "Reintentar ajuste" : "Registrar ajuste"}
                    </button>
                    {adjustmentStates[variant.id] && <p role={adjustmentStates[variant.id].status === "error" ? "alert" : "status"}>
                      {adjustmentStates[variant.id].message}
                    </p>}
                  </details>}
                  {form.variants.length > 1 ? (
                    <button
                      type="button"
                      className="variant-row__remove"
                      onClick={() => removeVariant(index)}
                      aria-label={`Quitar variante ${index + 1}`}
                    >
                      {variant.id ? "Desactivar variante" : "Quitar variante nueva"}
                    </button>
                  ) : (
                    <span className="variant-row__remove-placeholder" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {(skuDupSet.size > 0 || comboDupSet.size > 0) && (
          <p className="admin-form-error variant-table__alert">
            {skuDupSet.size > 0
              ? "Hay SKUs duplicados. Quita la variante repetida o recarga para generar uno nuevo."
              : "Hay variantes con la misma talla y color."}
          </p>
        )}
        <button type="button" className="admin-btn admin-btn--sm" onClick={addVariant}>
          + Variante
        </button>
      </section>

<section id="product-publication" className="product-form__section">
        <h2>Publicación y posicionamiento</h2>
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
        <Link href={returnTo} className="admin-btn">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

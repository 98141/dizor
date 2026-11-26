"use client";

// Sprint 09 · shared editor for "Nuevo producto" and "Editar producto" (Operativo Premium Híbrido).
// Five sections with progressive disclosure. Every field stays mounted (only hidden when its
// section or variant is closed), so switching sections never resets the draft, the images or a
// generated SKU: the state belongs to the whole form. Services, payload, SKU generation,
// relative stock adjustment (idempotent key) and the business validations are the previous ones.
// Constraint: frontend/test/stock-adjustment.test.cjs executes this file with a minimal React
// (useState/useRef/useEffect) and only these imports. Optional UI pieces (confirmation modal,
// description preview) are injected by ProductEditor.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  adjustProductStock,
  createAdminProduct,
  getAdminProducts,
  getCatalogMeta,
  getAdminProduct,
  getStockOperation,
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

const refId = (value) => value?._id || value?.id || value || "";

/** Server product → form state (same mapping as before Sprint 09). */
const productToForm = (product) => ({
  name: product.name || "",
  shortDescription: product.shortDescription || "",
  fullDescription: product.fullDescription || "",
  category: refId(product.category),
  weaveType: refId(product.weaveType),
  style: refId(product.style),
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

const buildPayload = (form) => ({
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

/** What a confirmed save must contain on the server (ids, stock and alt texts excluded). */
const comparable = (payload) => JSON.stringify({
  ...payload,
  images: payload.images.map((i) => i.url),
  variants: payload.variants.map(({ size, color, sku, price, isActive }) => ({ size: size ? String(size) : null, color: color ? String(color) : null, sku, price, isActive })).sort((a, b) => a.sku.localeCompare(b.sku)),
  category: String(payload.category || ""), weaveType: payload.weaveType ? String(payload.weaveType) : null, style: payload.style ? String(payload.style) : null,
  internalCost: payload.internalCost ?? null,
});

/** Editable state used to detect unsaved changes (stock of saved variants moves only by adjustments). */
const snapshot = (form) => JSON.stringify({
  ...form,
  variants: form.variants.map(({ clientKey, id, size, color, sku, stock, price, isActive }) => ({ clientKey, id, size, color, sku, price, isActive, ...(id ? {} : { stock: String(stock) }) })),
});
const variantSnapshot = (v) => JSON.stringify([v.size, v.color, String(v.sku), String(v.price ?? ""), v.isActive !== false]);

export const PRODUCT_SECTIONS = [
  { id: "general", title: "Información general" },
  { id: "images", title: "Imágenes" },
  { id: "price", title: "Precio y promoción" },
  { id: "variants", title: "Presentaciones y variantes" },
  { id: "publication", title: "Publicación y posicionamiento" },
];
const sectionTitle = (id) => PRODUCT_SECTIONS.find((s) => s.id === id)?.title || "";
const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const money = (value) => (value === "" || value == null || !Number.isFinite(Number(value)) ? "" : COP.format(Number(value)));
const units = (n) => `${n} ${Number(n) === 1 ? "unidad" : "unidades"}`;

const FIELD_MESSAGES = {
  name: "Escribe el nombre del producto.",
  category: "Selecciona la categoría",
  salePrice: "Indica el precio de venta (COP).",
};
function validityMessage(el) {
  const v = el.validity;
  const isStock = (el.getAttribute("aria-label") || "").startsWith("Stock variante");
  if (v.valueMissing) return FIELD_MESSAGES[el.id] || (isStock ? "Indica las existencias iniciales (número entero, 0 o más)." : "Completa este campo.");
  if (v.badInput) return "Escribe un número válido.";
  if (v.rangeUnderflow) return "No puede ser negativo.";
  if (v.rangeOverflow) return `El máximo es ${el.max}.`;
  if (v.stepMismatch) return "Usa un número entero, sin decimales.";
  if (v.tooLong) return `Máximo ${el.maxLength} caracteres.`;
  if (v.typeMismatch) return "Revisa el formato.";
  return el.validationMessage || "Revisa este campo.";
}
const fieldLabel = (el) => (el.labels?.[0]?.textContent || el.getAttribute("aria-label") || el.id).replace(/\s*\(obligatorio\)\s*$/i, "").replace(/\s*\*\s*$/, "").trim();

export default function ProductForm({ productId, returnTo = "/admin/productos", initialSection = "general", ConfirmModal = null, renderDescriptionPreview = null }) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  // Semilla estable por montaje (estado, no ref: se lee durante el render inicial).
  const [initialSkuSeed] = useState(generateSeed);
  const skuSeedRef = useRef(initialSkuSeed);

  const saveRef = useRef(false), savedRef = useRef(false), ambiguousRef = useRef(false), verifyingRef = useRef(false), leavingRef = useRef(false);
  const formRef = useRef(null), previewRef = useRef(null), previewReturnRef = useRef(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(() => {
    const initial = defaultForm();
    initial.variants[0].sku = generateUniqueSku("", initialSkuSeed, []);
    return initial;
  });
  const [baseline, setBaseline] = useState(null);
  const [baselineVariants, setBaselineVariants] = useState({});
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
  // Sprint 09 presentation state. It never owns form data.
  const [active, setActive] = useState(PRODUCT_SECTIONS.some((s) => s.id === initialSection) ? initialSection : "general");
  const [openVariant, setOpenVariant] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorList, setErrorList] = useState([]);
  const [focusRequest, setFocusRequest] = useState(null);
  const [ambiguous, setAmbiguous] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [imageMenu, setImageMenu] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState("");
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [leaveTo, setLeaveTo] = useState(null);

  const MAX_IMAGES = 10;
  const MAX_BATCH = 3;

  useEffect(() => {
    const load = async () => {
      try {
        const metaRes = await getCatalogMeta();
        setMeta(metaRes.meta);

        if (isEdit) {
          const { product } = await getAdminProduct(productId);
          const loaded = productToForm(product);
          setForm(loaded);
          setBaseline(snapshot(loaded));
          setBaselineVariants(Object.fromEntries(loaded.variants.map((v) => [v.clientKey, variantSnapshot(v)])));
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

  // Focus the requested field once its section/variant is visible.
  useEffect(() => {
    if (!focusRequest || typeof document === "undefined") return;
    const el = document.getElementById(focusRequest.id);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center" }); }
  }, [focusRequest]);

  // Image actions menu: first item focused on open; outside click closes it.
  useEffect(() => {
    if (imageMenu == null || typeof document === "undefined") return;
    document.querySelector(`#pe-image-menu-${imageMenu} [role="menuitem"]`)?.focus();
    const outside = (e) => { if (!e.target.closest?.(`[data-image-index="${imageMenu}"]`)) setImageMenu(null); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [imageMenu]);

  // Enlarged image preview (native modal dialog: Escape and focus containment by the browser).
  useEffect(() => {
    const dialog = previewRef.current;
    if (preview == null || !dialog || typeof dialog.showModal !== "function") return;
    if (!dialog.open) dialog.showModal();
  }, [preview]);

  const dirty = baseline !== null ? snapshot(form) !== baseline : false;
  // A new product starts dirty only after the first edit: the untouched default form is the baseline.
  const [createBaseline] = useState(() => snapshot(form));
  const hasChanges = isEdit ? dirty : snapshot(form) !== createBaseline;

  // Unsaved changes: confirm internal navigation and warn on reload/close. Never after a confirmed save.
  useEffect(() => {
    if (!hasChanges || typeof window === "undefined") return;
    const beforeUnload = (e) => { if (savedRef.current || leavingRef.current) return; e.preventDefault(); e.returnValue = ""; };
    const click = (e) => {
      if (savedRef.current || leavingRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return;
      e.preventDefault(); e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); };
  }, [hasChanges]);

  const clearFieldError = (id) => setFieldErrors((prev) => (prev[id] ? { ...prev, [id]: undefined } : prev));

  const setField = (key, value) => {
    clearFieldError(key);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setVariant = (index, key, value) => {
    const variant = form.variants[index];
    if (variant) clearFieldError(`pe-${variant.clientKey}-${key}`);
    setForm((prev) => {
      const variants = [...prev.variants];
      variants[index] = { ...variants[index], [key]: value };
      return { ...prev, variants };
    });
  };

  const handleNameChange = (value) => {
    clearFieldError("name");
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
    const next = {
      ...emptyVariant(),
      sku: generateUniqueSku(form.name, skuSeedRef.current, form.variants),
    };
    setForm((prev) => ({ ...prev, variants: [...prev.variants, next] }));
    setOpenVariant(next.clientKey);
    setFocusRequest((prev) => ({ id: `pe-${next.clientKey}-size`, n: (prev?.n || 0) + 1 }));
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
    if (form.images.length >= MAX_IMAGES) return;
    clearFieldError("pe-image-url");
    setForm((prev) => {
      const images = [...prev.images, { url, alt: prev.name || "Producto" }];
      return {
        ...prev,
        images,
        mainImage: prev.mainImage || url,
      };
    });
    setNewImageUrl("");
    setNotice(`Imagen ${form.images.length + 1} agregada. Se guardará con el producto.`);
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

  /** Business and constraint errors, in visual order (section, then position in the form). */
  const collectErrors = (formEl) => {
    const errors = [];
    const add = (section, id, message, label, variantKey = null) => { if (!errors.some((e) => e.id === id)) errors.push({ section, id, message, label, variantKey }); };
    if (!form.images.length) add("images", "pe-image-url", "Agrega al menos una imagen antes de guardar", "Imágenes");
    if (!form.category) add("general", "category", FIELD_MESSAGES.category, "Categoría");
    const skuCount = {}, comboCount = {};
    form.variants.forEach((v) => {
      const sku = String(v.sku || "").trim().toUpperCase();
      if (sku) skuCount[sku] = (skuCount[sku] || 0) + 1;
      if (v.isActive !== false) { const combo = `${v.size || ""}|${v.color || ""}`; comboCount[combo] = (comboCount[combo] || 0) + 1; }
    });
    const seenSku = new Set(), seenCombo = new Set();
    form.variants.forEach((v, i) => {
      const sku = String(v.sku || "").trim().toUpperCase(), combo = `${v.size || ""}|${v.color || ""}`;
      if (!sku) add("variants", `pe-${v.clientKey}-sku`, "Cada variante necesita un SKU", `SKU variante ${i + 1}`, v.clientKey);
      else if (skuCount[sku] > 1 && seenSku.has(sku)) add("variants", `pe-${v.clientKey}-sku`, "Hay SKUs duplicados. Cada variante debe tener un código único.", `SKU variante ${i + 1}`, v.clientKey);
      seenSku.add(sku);
      if (v.isActive !== false) {
        if (comboCount[combo] > 1 && seenCombo.has(combo)) add("variants", `pe-${v.clientKey}-size`, "Hay variantes con la misma talla y color", `Talla variante ${i + 1}`, v.clientKey);
        seenCombo.add(combo);
      }
    });
    for (const el of formEl?.elements || []) {
      if (!el.willValidate || el.checkValidity() || !el.id) continue;
      const section = el.closest("[data-pe-section]")?.getAttribute("data-pe-section") || "general";
      add(section, el.id, validityMessage(el), fieldLabel(el), el.closest("[data-pe-variant]")?.getAttribute("data-pe-variant") || null);
    }
    const order = (e) => PRODUCT_SECTIONS.findIndex((s) => s.id === e.section);
    const position = (e) => (typeof document !== "undefined" ? document.getElementById(e.id) : null);
    return errors.sort((a, b) => order(a) - order(b) || ((position(a) && position(b) && position(a).compareDocumentPosition(position(b)) & 4) ? -1 : 1));
  };

  /** Open the section (and variant) of an error and move focus to its field. */
  const goTo = (target) => {
    setActive(target.section);
    if (target.variantKey) setOpenVariant(target.variantKey);
    setFocusRequest((prev) => ({ id: target.id, n: (prev?.n || 0) + 1 }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saveRef.current || savedRef.current || ambiguousRef.current) return;
    saveRef.current = true;
    const errors = collectErrors(e.currentTarget);
    if (errors.length) {
      setFieldErrors(Object.fromEntries(errors.map((x) => [x.id, x.message])));
      setErrorList(errors);
      setError(errors.length === 1 ? "Revisa 1 campo antes de guardar." : `Revisa ${errors.length} campos antes de guardar.`);
      goTo(errors[0]);
      saveRef.current = false;
      return;
    }
    setSaving(true);
    setError("");
    setErrorList([]);
    setFieldErrors({});

    try {
      const payload = buildPayload(form);
      if (isEdit) {
        await updateAdminProduct(productId, payload);
        savedRef.current = true; router.push(returnTo);
      } else {
        await createAdminProduct(payload);
        savedRef.current = true; router.push(returnTo);
      }
    } catch (err) {
      const status = err.response?.status;
      if (!status || status >= 500) {
        // No answer or a gateway/server failure: the product may or may not be saved (same rule as
        // the stock adjustment). Block another save until the real result is checked.
        ambiguousRef.current = true;
        setAmbiguous(true);
        setError("No se pudo confirmar si el producto se guardó. Comprueba el resultado antes de volver a guardar; tu borrador se conserva.");
      } else {
        setError(
          err.response?.data?.message ||
            err.response?.data?.error?.message ||
            "No se pudo guardar el producto"
        );
      }
    } finally {
      setSaving(false); saveRef.current = false;
    }
  };

  // Checks a save whose answer was lost, without sending it again.
  const verifySave = async () => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    const expected = buildPayload(form);
    const unconfirmed = (message) => { ambiguousRef.current = false; setAmbiguous(false); setError(message); };
    try {
      if (isEdit) {
        const { product } = await getAdminProduct(productId);
        if (comparable(buildPayload(productToForm(product))) === comparable(expected)) { savedRef.current = true; router.push(returnTo); return; }
        unconfirmed("El servidor no tiene estos cambios. Tu borrador se conserva: revisa y guarda de nuevo.");
      } else {
        const sku = expected.variants[0]?.sku;
        const data = await getAdminProducts({ q: sku, limit: 5 });
        const found = (data.products || []).some((p) => (p.variants || []).some((v) => String(v.sku || "").toUpperCase() === sku));
        if (found) { savedRef.current = true; router.push(returnTo); return; }
        unconfirmed("El producto no aparece en el catálogo: no se creó. Tu borrador se conserva y puedes crearlo de nuevo.");
      }
    } catch {
      setError("Sigue sin poder comprobarse el resultado. No vuelvas a guardar hasta confirmarlo; tu borrador se conserva.");
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  // Checks an adjustment whose answer was lost, with the same operation key (no new intent).
  const verifyAdjustment = async (index) => {
    const variant = form.variants[index];
    if (!variant?.id) return;
    const operation = inFlightAdjustmentsRef.current.get(variant.id);
    if (!operation || operation.inFlight || operation.completed) return;
    operation.inFlight = true;
    setAdjustmentStates((prev) => ({ ...prev, [variant.id]: { ...prev[variant.id], status: "processing", message: "Comprobando ajuste…" } }));
    try {
      const result = await getStockOperation(productId, operation.payload.operationKey);
      if (result.found) {
        operation.completed = true;
        const stock = result.currentStock ?? result.stock;
        setForm((prev) => ({ ...prev, variants: prev.variants.map((v) => v.id === variant.id ? { ...v, stock, adjustmentDelta: "", adjustmentReason: "" } : v) }));
        setAdjustmentStates((prev) => ({ ...prev, [variant.id]: { status: "success", message: `Ajuste confirmado. Stock: ${stock}.` } }));
      } else if (result.rejected) {
        inFlightAdjustmentsRef.current.delete(variant.id);
        setAdjustmentStates((prev) => ({ ...prev, [variant.id]: { status: "error", message: `El ajuste fue rechazado y no movió existencias: ${result.message}` } }));
      } else {
        setAdjustmentStates((prev) => ({ ...prev, [variant.id]: { status: "error", retryPending: true, message: "Aún no hay constancia del ajuste. Reintenta la misma operación: se usa la misma clave." } }));
      }
    } catch {
      setAdjustmentStates((prev) => ({ ...prev, [variant.id]: { status: "error", retryPending: true, message: "No se pudo comprobar. Se conserva la misma operación." } }));
    } finally {
      operation.inFlight = false;
    }
  };

  const toggleSection = (id) => setActive((current) => (current === id ? null : id));
  const closePreview = () => { setPreview(null); const back = previewReturnRef.current; previewReturnRef.current = null; back?.focus?.(); };
  const openPreview = (index, from) => { previewReturnRef.current = from || (typeof document !== "undefined" ? document.activeElement : null); setImageMenu(null); setPreview(index); };
  const menuKeys = (e, index) => {
    const items = [...e.currentTarget.querySelectorAll('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement);
    const move = (i) => { e.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (e.key === "ArrowDown") move(at + 1);
    else if (e.key === "ArrowUp") move(at - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Escape") { e.preventDefault(); setImageMenu(null); document.getElementById(`pe-image-trigger-${index}`)?.focus(); }
    else if (e.key === "Tab") setImageMenu(null);
  };
  const menuAction = (index, action) => {
    const trigger = typeof document !== "undefined" ? document.getElementById(`pe-image-trigger-${index}`) : null;
    if (action === "main") { setMainImage(form.images[index].url); setNotice(`La imagen ${index + 1} es ahora la principal.`); setImageMenu(null); trigger?.focus(); }
    if (action === "preview") openPreview(index, trigger);
    if (action === "remove") {
      removeImage(index); setImageMenu(null);
      setNotice(`Imagen ${index + 1} quitada. El cambio se aplica al guardar.`);
      if (typeof document !== "undefined") document.getElementById("pe-image-url")?.focus();
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

  // ── Derived, read-only summaries (never stored) ──
  const nameOf = (list, id) => list.find((i) => i._id === id)?.name || "";
  const variantLabel = (v) => [nameOf(sizes, v.size), nameOf(colors, v.color)].filter(Boolean).join(" / ") || "Presentación única";
  const activeVariants = form.variants.filter((v) => v.isActive !== false);
  const inactiveCount = form.variants.length - activeVariants.length;
  const totalStock = activeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  const discount = Number(form.discountPercent) || 0;
  const flags = [form.isFeatured && "Destacado", form.isNew && "Nuevo", form.allowsCustomization && "Personalizable"].filter(Boolean);
  const mainImage = form.mainImage || form.images[0]?.url || "";
  const summaries = {
    general: [form.name.trim() || "Sin nombre", nameOf(categories, form.category) || "Sin categoría"].join(" · "),
    images: `${form.images.length} de ${MAX_IMAGES}${form.images.length ? " · principal definida" : " · falta al menos una"}`,
    price: [money(form.salePrice) || "Sin precio", form.onPromotion && discount > 0 ? `promoción ${discount} %` : discount > 0 ? `descuento ${discount} % sin promoción activa` : ""].filter(Boolean).join(" · "),
    variants: [`${activeVariants.length} ${activeVariants.length === 1 ? "presentación" : "presentaciones"}`, inactiveCount ? `${inactiveCount} inactiva${inactiveCount === 1 ? "" : "s"}` : "", units(totalStock)].filter(Boolean).join(" · "),
    publication: [form.isActive ? "Activo" : "Inactivo", ...flags].join(" · "),
  };
  const pending = [
    !form.name.trim() && { section: "general", id: "name", label: "Falta el nombre" },
    !form.category && { section: "general", id: "category", label: "Falta la categoría" },
    !form.images.length && { section: "images", id: "pe-image-url", label: "Falta al menos una imagen" },
    (form.salePrice === "" || form.salePrice == null) && { section: "price", id: "salePrice", label: "Falta el precio de venta" },
    (skuDupSet.size > 0 || comboDupSet.size > 0) && { section: "variants", id: `pe-${form.variants[form.variants.length - 1]?.clientKey}-sku`, label: skuDupSet.size ? "SKU repetido en variantes" : "Talla y color repetidos" },
  ].filter(Boolean);
  const errorCount = (section) => errorList.filter((e) => e.section === section && fieldErrors[e.id]).length;
  const describedBy = (id, hint) => [fieldErrors[id] ? `${id}-error` : null, hint].filter(Boolean).join(" ") || undefined;
  const fieldError = (id) => fieldErrors[id] ? <p id={`${id}-error`} className="pe-field-error">{fieldErrors[id]}</p> : null;
  const invalid = (id) => (fieldErrors[id] ? true : undefined);
  const sectionHead = (id, index) => <h2 className="pe-section__h">
    <button type="button" id={`pe-toggle-${id}`} className="pe-section__toggle" aria-expanded={active === id} aria-controls={`pe-panel-${id}`} onClick={() => toggleSection(id)}>
      <span className="pe-section__index" aria-hidden="true">{index + 1}</span>
      <span className="pe-section__titles"><span className="pe-section__title">{sectionTitle(id)}</span><span className="pe-section__summary">{summaries[id]}</span></span>
      {errorCount(id) > 0 && <span className="pe-chip pe-chip--danger">{errorCount(id) === 1 ? "1 error" : `${errorCount(id)} errores`}</span>}
      <svg className="pe-section__chevron" aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m5 8 5 5 5-5" /></svg>
    </button>
  </h2>;
  const statusText = saving ? "Guardando…" : ambiguous ? "Resultado sin confirmar" : hasChanges ? "Cambios sin guardar" : isEdit ? "Sin cambios pendientes" : "Producto nuevo sin guardar";

  return (
    <>
    <form ref={formRef} className="product-form admin-form pe" onSubmit={handleSubmit} noValidate aria-busy={saving}>
      <div className="pe-top">
        <Link href={returnTo} className="pe-back">← Volver a la lista filtrada</Link>
        <p className="product-form__hint pe-top__hint">
          Configura taxonomías en{" "}
          <Link href="/admin/catalogo">Catálogo base</Link> si faltan opciones.
        </p>
      </div>

      {error && <div role="alert" className="admin-form-error pe-errors">
        <p>{error}</p>
        {errorList.length > 0 && <ul>{errorList.map((e) => <li key={e.id}><button type="button" className="pe-errors__link" onClick={() => goTo(e)}>{e.label} · {sectionTitle(e.section)}</button><span>: {e.message}</span></li>)}</ul>}
      </div>}

      <div className="pe-layout">
        <div className="pe-main">

      <section id="product-general" className="pe-section" data-pe-section="general" data-open={active === "general" || undefined}>
        {sectionHead("general", 0)}
        <div id="pe-panel-general" className="pe-section__panel" role="region" aria-labelledby="pe-toggle-general" hidden={active !== "general"}>
          <div className="pe-grid">
            <div className="admin-form__group pe-span-all">
              <label htmlFor="name">Nombre *</label>
              <input id="name" value={form.name} maxLength={150} onChange={(e) => handleNameChange(e.target.value)} required aria-invalid={invalid("name")} aria-describedby={describedBy("name")} />
              {fieldError("name")}
            </div>
            <div className="admin-form__group">
              <label htmlFor="category">Categoría *</label>
              <select id="category" value={form.category} onChange={(e) => setField("category", e.target.value)} required aria-invalid={invalid("category")} aria-describedby={describedBy("category")}>
                <option value="">Seleccionar…</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              {fieldError("category")}
            </div>
            <div className="admin-form__group">
              <label htmlFor="material">Material</label>
              <input id="material" value={form.material} maxLength={120} onChange={(e) => setField("material", e.target.value)} aria-invalid={invalid("material")} aria-describedby={describedBy("material")} />
              {fieldError("material")}
            </div>
            <div className="admin-form__group">
              <label htmlFor="weaveType">Tejido</label>
              <select id="weaveType" value={form.weaveType} onChange={(e) => setField("weaveType", e.target.value)} aria-describedby="pe-taxonomy-hint">
                <option value="">No aplica</option>
                {weaveTypes.map((w) => (
                  <option key={w._id} value={w._id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="admin-form__group">
              <label htmlFor="style">Estilo / horma</label>
              <select id="style" value={form.style} onChange={(e) => setField("style", e.target.value)} aria-describedby="pe-taxonomy-hint">
                <option value="">No aplica</option>
                {styles.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <p id="pe-taxonomy-hint" className="image-upload-hint pe-span-all">
              Tejido y horma describen sombreros: en bolsos o accesorios deja «No aplica» en lo que no corresponda (no uses el nombre de la categoría como horma). Así los filtros del catálogo muestran solo opciones reales.
            </p>
            <div className="admin-form__group pe-span-all">
              <label htmlFor="shortDescription">Descripción corta</label>
              <textarea id="shortDescription" className="pe-autogrow pe-autogrow--short" rows={2} maxLength={300} value={form.shortDescription} onChange={(e) => setField("shortDescription", e.target.value)} aria-invalid={invalid("shortDescription")} aria-describedby={describedBy("shortDescription", "shortDescription-count")} />
              <span id="shortDescription-count" className="pe-count">{form.shortDescription.length}/300</span>
              {fieldError("shortDescription")}
            </div>
            <div className="admin-form__group pe-span-all">
              <div className="pe-label-row">
                <label htmlFor="fullDescription">Descripción completa</label>
                <div className="pe-label-row__actions">
                  <button type="button" className="admin-btn admin-btn--tertiary admin-btn--sm" aria-expanded={showFormatHelp} aria-controls="pe-format-help" onClick={() => setShowFormatHelp((v) => !v)}>Formato</button>
                  {renderDescriptionPreview && <button type="button" className="admin-btn admin-btn--tertiary admin-btn--sm" aria-expanded={showDescriptionPreview} aria-controls="pe-description-preview" onClick={() => setShowDescriptionPreview((v) => !v)}>{showDescriptionPreview ? "Ocultar vista previa" : "Vista previa"}</button>}
                </div>
              </div>
              <textarea
                id="fullDescription"
                className="pe-autogrow"
                rows={4}
                maxLength={8000}
                value={form.fullDescription}
                onChange={(e) => setField("fullDescription", e.target.value)}
                aria-invalid={invalid("fullDescription")}
                aria-describedby={describedBy("fullDescription", "fullDescription-count")}
                placeholder="Historia, materiales, medidas y cuidados. Usa «Formato» para ver títulos, viñetas e imágenes."
              />
              <span id="fullDescription-count" className="pe-count">{form.fullDescription.length}/8000</span>
              {fieldError("fullDescription")}
              {/* The one-line placeholder keeps an empty field short; the full example lives here. */}
              <div id="pe-format-help" className="pe-format-help" hidden={!showFormatHelp}>
                <p className="image-upload-hint">
                  Formato: línea en blanco = nuevo bloque.{" "}
                  <code># Título</code> o <code>#Título</code> se muestra en
                  mayúsculas y negrita (sin el #).{" "}
                  <code>- texto</code> = viñeta con sangría. Enter = salto de línea.{" "}
                  <code>![texto alt](url)</code> = imagen (el texto entre{" "}
                  <code>[]</code> no se ve en pantalla, solo ayuda a accesibilidad).
                  Las fotos principales van en la galería del producto.
                </p>
                <pre>{`Ejemplo:

Sombrero tejido a mano en palma de iraca.

# Material y origen
Fibra natural de Sandoná, Nariño.

# Detalles
- Ala flexible
- Acabado a mano
- Ideal para clima cálido

![Detalle del tejido](https://res.cloudinary.com/.../detalle.jpg)`}</pre>
              </div>
              {renderDescriptionPreview && <div id="pe-description-preview" className="pe-preview-body" hidden={!showDescriptionPreview} aria-label="Vista previa de la descripción" role="region">
                {showDescriptionPreview && (renderDescriptionPreview(form.fullDescription, form.shortDescription) || <p className="image-upload-hint">Sin contenido que mostrar.</p>)}
              </div>}
            </div>
          </div>
        </div>
      </section>

      <section id="product-images" className="pe-section" data-pe-section="images" data-open={active === "images" || undefined}>
        {sectionHead("images", 1)}
        <div id="pe-panel-images" className="pe-section__panel" role="region" aria-labelledby="pe-toggle-images" hidden={active !== "images"}>
          <div className="pe-gallery-tools">
            {meta?.cloudinaryConfigured ? (
              <div className="image-upload-block">
                <label className={`admin-btn admin-btn--sm image-upload-label${uploading ? " is-uploading" : ""}`}>
                  {uploading ? (
                    <>
                      <span className="upload-spinner" aria-hidden="true" />
                      Subiendo {uploadingCount} imagen{uploadingCount !== 1 ? "es" : ""}…
                    </>
                  ) : (
                    "Subir desde equipo"
                  )}
                  <input type="file" accept="image/*" multiple hidden disabled={uploading || form.images.length >= MAX_IMAGES} onChange={handleFileUpload} />
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
            <div className="image-url-add">
              <input
                id="pe-image-url"
                type="url"
                aria-label="URL de imagen"
                placeholder="https://… URL de imagen"
                value={newImageUrl}
                disabled={form.images.length >= MAX_IMAGES}
                aria-invalid={invalid("pe-image-url")}
                aria-describedby={describedBy("pe-image-url", "pe-images-limit")}
                onChange={(e) => setNewImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImage();
                  }
                }}
              />
              <button type="button" className="admin-btn" onClick={addImage} disabled={form.images.length >= MAX_IMAGES}>
                Agregar
              </button>
            </div>
            <p id="pe-images-limit" className="image-upload-hint">{form.images.length >= MAX_IMAGES ? "El producto ya tiene el máximo de 10 imágenes. Quita una para agregar otra." : `Máximo ${MAX_IMAGES} imágenes. La principal se muestra primero en la tienda.`}</p>
            {fieldError("pe-image-url")}
          </div>
          {notice && <p className="pe-notice" role="status">{notice}</p>}

          {form.images.length > 0 && (
            <ol className="pe-gallery" aria-label="Imágenes del producto">
              {form.images.map((img, index) => {
                const isMain = form.mainImage === img.url;
                const open = imageMenu === index;
                return (
                  <li key={`${img.url}-${index}`} data-image-index={index} className={isMain ? "is-main" : undefined}>
                    <button type="button" className="pe-thumb" aria-label={`Ver imagen ${index + 1} ampliada${isMain ? " (principal)" : ""}`} onClick={(e) => openPreview(index, e.currentTarget)}>
                      <img src={img.url} alt="" width={120} height={120} loading="lazy" decoding="async" />
                    </button>
                    <span className="pe-thumb__pos" aria-hidden="true">{index + 1}</span>
                    {isMain && <span className="pe-thumb__main">Principal</span>}
                    <div className="pe-menu">
                      <button type="button" id={`pe-image-trigger-${index}`} className="pe-menu__trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={`pe-image-menu-${index}`} aria-label={`Acciones de la imagen ${index + 1}`} onClick={() => setImageMenu(open ? null : index)}>
                        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" /></svg>
                      </button>
                      <ul id={`pe-image-menu-${index}`} role="menu" aria-label={`Imagen ${index + 1}`} className="pe-menu__list" hidden={!open} onKeyDown={(e) => menuKeys(e, index)}>
                        {!isMain && <li role="none"><button type="button" role="menuitem" tabIndex={-1} className="pe-menu__item" onClick={() => menuAction(index, "main")}>Hacer principal</button></li>}
                        <li role="none"><button type="button" role="menuitem" tabIndex={-1} className="pe-menu__item" onClick={() => menuAction(index, "preview")}>Ver ampliada</button></li>
                        <li role="none"><button type="button" role="menuitem" tabIndex={-1} className="pe-menu__item pe-menu__danger" onClick={() => menuAction(index, "remove")}>Eliminar</button></li>
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <section id="product-price" className="pe-section" data-pe-section="price" data-open={active === "price" || undefined}>
        {sectionHead("price", 2)}
        <div id="pe-panel-price" className="pe-section__panel" role="region" aria-labelledby="pe-toggle-price" hidden={active !== "price"}>
          <div className="pe-grid pe-grid--price">
            <div className="admin-form__group">
              <label htmlFor="salePrice">Precio venta (COP) *</label>
              <input id="salePrice" type="number" min="0" inputMode="numeric" value={form.salePrice} onChange={(e) => setField("salePrice", e.target.value)} required aria-invalid={invalid("salePrice")} aria-describedby={describedBy("salePrice")} />
              {fieldError("salePrice")}
            </div>
            <div className="admin-form__group">
              <label htmlFor="internalCost">Costo interno (COP)</label>
              <input id="internalCost" type="number" min="0" inputMode="numeric" value={form.internalCost} onChange={(e) => setField("internalCost", e.target.value)} aria-invalid={invalid("internalCost")} aria-describedby={describedBy("internalCost", "internalCost-hint")} />
              <span id="internalCost-hint" className="image-upload-hint">Solo administración. No se muestra en la tienda.</span>
              {fieldError("internalCost")}
            </div>
            <div className="admin-form__group">
              <label htmlFor="discountPercent">Descuento %</label>
              <input id="discountPercent" type="number" min="0" max="100" inputMode="numeric" value={form.discountPercent} onChange={(e) => setField("discountPercent", e.target.value)} aria-invalid={invalid("discountPercent")} aria-describedby={describedBy("discountPercent")} />
              {fieldError("discountPercent")}
            </div>
          </div>
          <label className="admin-checkbox pe-check" htmlFor="onPromotion">
            <input id="onPromotion" type="checkbox" checked={form.onPromotion} onChange={(e) => setField("onPromotion", e.target.checked)} />
            <span>En promoción</span>
          </label>
          <p className="image-upload-hint">Cada variante puede tener su propio precio en «Presentaciones y variantes».</p>
        </div>
      </section>

      <section id="product-variants" className="pe-section" data-pe-section="variants" data-open={active === "variants" || undefined}>
        {sectionHead("variants", 3)}
        <div id="pe-panel-variants" className="pe-section__panel" role="region" aria-labelledby="pe-toggle-variants" hidden={active !== "variants"}>
          <p className="product-form__hint product-form__hint--tight">
            El SKU identifica cada presentación. Talla y color son opcionales: no agregues opciones que el producto no necesita. El stock existente se modifica con ajustes relativos, no al guardar estos datos.
          </p>
          <ul className="pe-variants">
            {form.variants.map((variant, index) => {
              const key = variant.clientKey || variant.id || `variant-${index}`;
              const skuKey = String(variant.sku || "").trim().toUpperCase();
              const comboKey = variant.isActive !== false ? `${variant.size || ""}|${variant.color || ""}` : "";
              const hasError = skuDupSet.has(skuKey) || comboDupSet.has(comboKey) || [`pe-${key}-sku`, `pe-${key}-size`, `pe-${key}-stock`, `pe-${key}-price`].some((id) => fieldErrors[id]);
              const open = openVariant === key;
              const changed = variant.id ? baselineVariants[key] !== undefined && baselineVariants[key] !== variantSnapshot(variant) : false;
              const adjustment = variant.id ? adjustmentStates[variant.id] : null;
              const adjusting = Boolean(adjustOpen[key] || adjustment?.retryPending || adjustment?.status === "processing");
              const stockValue = variant.stock === "" || variant.stock == null ? 0 : variant.stock;
              return (
                <li key={key} data-pe-variant={key} className={`pe-variant${open ? " is-open" : ""}${hasError ? " variant-row--error pe-variant--error" : ""}${variant.isActive === false ? " is-inactive" : ""}`}>
                  <div className="pe-variant__summary">
                    <div className="pe-variant__info">
                      <strong>{variantLabel(variant)}</strong>
                      <span className="pe-variant__sku">SKU: {variant.sku || "sin SKU"}</span>
                      <span className="pe-variant__meta">{units(stockValue)} · {!variant.id ? "Nueva" : variant.isActive === false ? "Inactiva" : "Activa"}{!variant.id && variant.isActive === false ? " · Inactiva" : ""}{variant.price !== "" && variant.price != null ? ` · ${money(variant.price)}` : ""}</span>
                      {changed && <span className="pe-chip pe-chip--warning">Cambios sin guardar</span>}
                      {hasError && <span className="pe-chip pe-chip--danger">Revisar</span>}
                    </div>
                    <button type="button" className="admin-btn admin-btn--sm pe-variant__toggle" aria-expanded={open} aria-controls={`pe-variant-panel-${key}`} onClick={() => setOpenVariant(open ? null : key)}>
                      {open ? "Cerrar variante" : "Editar variante"}<span className="pe-sr"> {index + 1}</span>
                    </button>
                  </div>
                  <div id={`pe-variant-panel-${key}`} className="pe-variant__panel" hidden={!open}>
                    <div className="pe-variant__fields">
                      <label>Talla (opcional)<select id={`pe-${key}-size`} value={variant.size} onChange={(e) => setVariant(index, "size", e.target.value)} aria-label={`Talla variante ${index + 1}`} aria-invalid={invalid(`pe-${key}-size`)} aria-describedby={describedBy(`pe-${key}-size`)}>
                        <option value="">No aplica</option>
                        {sizes.map((s) => (
                          <option key={s._id} value={s._id}>{s.name}</option>
                        ))}
                      </select></label>
                      <label>Color (opcional)<select id={`pe-${key}-color`} value={variant.color} onChange={(e) => setVariant(index, "color", e.target.value)} aria-label={`Color variante ${index + 1}`}>
                        <option value="">No aplica</option>
                        {colors.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select></label>
                      <label>SKU<input
                        id={`pe-${key}-sku`}
                        className="variant-row__sku"
                        onChange={(e) => setVariant(index, "sku", e.target.value.toUpperCase())}
                        value={variant.sku}
                        aria-label={`SKU variante ${index + 1}`}
                        aria-invalid={invalid(`pe-${key}-sku`)}
                        aria-describedby={describedBy(`pe-${key}-sku`)}
                        title="SKU único de la presentación"
                        autoComplete="off"
                      /></label>
                      <label>{variant.id ? "Existencias actuales" : "Existencias iniciales"}<input
                        id={`pe-${key}-stock`}
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
                        aria-invalid={invalid(`pe-${key}-stock`)}
                        aria-describedby={describedBy(`pe-${key}-stock`)}
                      /></label>
                      <label>Precio propio (opcional)<input
                        id={`pe-${key}-price`}
                        type="number"
                        min="0"
                        placeholder="Opcional"
                        value={variant.price}
                        onChange={(e) => setVariant(index, "price", e.target.value)}
                        aria-label={`Precio variante ${index + 1}`}
                        aria-invalid={invalid(`pe-${key}-price`)}
                        aria-describedby={describedBy(`pe-${key}-price`)}
                      /></label>
                      <label className="admin-checkbox admin-checkbox--inline pe-variant__active">
                        <input type="checkbox" checked={variant.isActive} aria-label={`Activa variante ${index + 1}`} onChange={(e) => setVariant(index, "isActive", e.target.checked)} />
                        <span className="variant-row__active-label">Activa</span>
                      </label>
                    </div>
                    {[`pe-${key}-size`, `pe-${key}-sku`, `pe-${key}-stock`, `pe-${key}-price`].map((id) => <div key={id}>{fieldError(id)}</div>)}
                    {variant.id && <div className="pe-adjust">
                      <button type="button" className="admin-btn admin-btn--sm" aria-expanded={adjusting} aria-controls={`pe-adjust-${key}`} onClick={() => setAdjustOpen((prev) => ({ ...prev, [key]: !prev[key] }))}>Ajustar existencias</button>
                      <div id={`pe-adjust-${key}`} className="pe-adjust__panel" hidden={!adjusting}>
                        <p className="pe-adjust__intro">Existencias actuales: <strong>{variant.stock}</strong>. Escribe una cantidad positiva para sumar o negativa para retirar. Stock previsto: {variant.stock + (Number(variant.adjustmentDelta) || 0)}. El resultado se comprueba en el servidor.</p>
                        <div className="pe-adjust__fields">
                          <label>Cantidad (+ / −)<input type="number" step="1" placeholder="Ajuste + / −" aria-label="Cantidad del ajuste"
                            disabled={adjustmentStates[variant.id]?.status === "processing" || adjustmentStates[variant.id]?.retryPending}
                            value={variant.adjustmentDelta || ""} onChange={(e) => setAdjustmentField(index, "adjustmentDelta", e.target.value)} /></label>
                          <label>Motivo<input placeholder="Motivo del ajuste" aria-label="Motivo del ajuste" maxLength={500}
                            disabled={adjustmentStates[variant.id]?.status === "processing" || adjustmentStates[variant.id]?.retryPending}
                            value={variant.adjustmentReason || ""} onChange={(e) => setAdjustmentField(index, "adjustmentReason", e.target.value)} /></label>
                        </div>
                        <div className="pe-adjust__actions">
                          <button type="button" className="admin-btn admin-btn--sm pe-adjust__submit" onClick={() => handleStockAdjustment(index)}
                            disabled={adjustmentStates[variant.id]?.status === "processing"}>
                            {adjustmentStates[variant.id]?.status === "processing" ? "Registrando…" : adjustmentStates[variant.id]?.retryPending ? "Reintentar ajuste" : "Registrar ajuste"}
                          </button>
                          {adjustmentStates[variant.id]?.retryPending && <button type="button" className="admin-btn admin-btn--tertiary admin-btn--sm" onClick={() => verifyAdjustment(index)}>Comprobar resultado del ajuste</button>}
                        </div>
                        {adjustmentStates[variant.id] && <p role={adjustmentStates[variant.id].status === "error" ? "alert" : "status"}>
                          {adjustmentStates[variant.id].message}
                        </p>}
                      </div>
                    </div>}
                    {!variant.id && form.variants.length > 1 && <button type="button" className="admin-btn admin-btn--tertiary admin-btn--sm variant-row__remove" onClick={() => { removeVariant(index); setOpenVariant(null); }} aria-label={`Quitar variante ${index + 1}`}>Quitar variante nueva</button>}
                  </div>
                </li>
              );
            })}
          </ul>
          {(skuDupSet.size > 0 || comboDupSet.size > 0) && (
            <p className="admin-form-error variant-table__alert">
              {skuDupSet.size > 0
                ? "Hay SKUs duplicados. Quita la variante repetida o recarga para generar uno nuevo."
                : "Hay variantes con la misma talla y color."}
            </p>
          )}
          <button type="button" className="admin-btn admin-btn--sm pe-add-variant" onClick={addVariant}>
            <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 4v12M4 10h12" /></svg>Agregar variante
          </button>
        </div>
      </section>

      <section id="product-publication" className="pe-section" data-pe-section="publication" data-open={active === "publication" || undefined}>
        {sectionHead("publication", 4)}
        <div id="pe-panel-publication" className="pe-section__panel" role="region" aria-labelledby="pe-toggle-publication" hidden={active !== "publication"}>
          <fieldset className="pe-flags">
            <legend>Visibilidad en la tienda</legend>
            {[["isActive", "Activo en tienda", "Visible y disponible para comprar."], ["isFeatured", "Destacado", "Aparece entre los productos destacados."], ["isNew", "Nuevo", "Muestra la etiqueta de novedad."], ["allowsCustomization", "Permite personalización", "Habilita solicitudes de personalización."]].map(([key, label, help]) => (
              <label key={key} className={`pe-flag${form[key] ? " is-on" : ""}`} htmlFor={key}>
                <input id={key} type="checkbox" checked={form[key]} onChange={(e) => setField(key, e.target.checked)} aria-describedby={`${key}-help`} />
                <span className="pe-flag__text"><span className="pe-flag__label">{label}</span><span id={`${key}-help`} className="pe-flag__help">{help}</span></span>
                <span className="pe-flag__state" aria-hidden="true">{form[key] ? "Sí" : "No"}</span>
              </label>
            ))}
          </fieldset>
          <div className="pe-grid">
            <div className="admin-form__group pe-span-all">
              <label htmlFor="seoTitle">Título SEO</label>
              <input id="seoTitle" value={form.seoTitle} maxLength={70} placeholder="Si lo dejas vacío se usa el nombre del producto" onChange={(e) => setField("seoTitle", e.target.value)} aria-invalid={invalid("seoTitle")} aria-describedby={describedBy("seoTitle", "seoTitle-count")} />
              <span id="seoTitle-count" className="pe-count">{form.seoTitle.length}/70</span>
              {fieldError("seoTitle")}
            </div>
            <div className="admin-form__group pe-span-all">
              <label htmlFor="seoDescription">Descripción SEO</label>
              <textarea id="seoDescription" className="pe-autogrow pe-autogrow--short" rows={2} maxLength={160} value={form.seoDescription} onChange={(e) => setField("seoDescription", e.target.value)} aria-invalid={invalid("seoDescription")} aria-describedby={describedBy("seoDescription", "seoDescription-count")} />
              <span id="seoDescription-count" className="pe-count">{form.seoDescription.length}/160</span>
              {fieldError("seoDescription")}
            </div>
          </div>
        </div>
      </section>

        </div>

        <aside className="pe-aside" aria-label="Resumen del producto">
          <div className="pe-aside__media">
            {mainImage ? <img src={mainImage} alt="" width={96} height={96} /> : <span className="pe-aside__placeholder" aria-hidden="true">Sin imagen</span>}
          </div>
          <p className="pe-aside__name">{form.name.trim() || "Producto sin nombre"}</p>
          <p><span className={`pe-chip ${form.isActive ? "pe-chip--ok" : "pe-chip--muted"}`}>{form.isActive ? "Activo" : "Inactivo"}</span>{flags.map((f) => <span key={f} className="pe-chip">{f}</span>)}</p>
          <dl className="pe-aside__facts">
            <div><dt>Precio</dt><dd>{money(form.salePrice) || "Sin precio"}{form.onPromotion && discount > 0 ? ` · −${discount} %` : ""}</dd></div>
            <div><dt>Variantes</dt><dd>{activeVariants.length} {activeVariants.length === 1 ? "variante activa" : "variantes activas"}{inactiveCount ? ` · ${inactiveCount} inactiva${inactiveCount === 1 ? "" : "s"}` : ""}</dd></div>
            <div><dt>Imágenes</dt><dd>{form.images.length} {form.images.length === 1 ? "imagen" : "imágenes"} de {MAX_IMAGES}</dd></div>
          </dl>
          {pending.length > 0 ? <div className="pe-aside__pending">
            <p>Requiere atención</p>
            <ul>{pending.map((p) => <li key={p.label}><button type="button" className="pe-errors__link" onClick={() => goTo(p)}>{p.label}</button></li>)}</ul>
          </div> : <p className="pe-aside__ok">Datos obligatorios completos.</p>}
        </aside>
      </div>

      <div className="pe-savebar">
        <p className="pe-savebar__status" aria-live="polite" data-idle={!saving && !ambiguous && !hasChanges || undefined}>{statusText}</p>
        <div className="pe-savebar__actions">
          <Link href={returnTo} className="admin-btn admin-btn--tertiary">Cancelar</Link>
          {ambiguous && <button type="button" className="admin-btn" disabled={verifying} aria-busy={verifying} onClick={verifySave}>Comprobar guardado</button>}
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving || ambiguous} aria-busy={saving || undefined}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </div>
    </form>

    {preview != null && form.images[preview] && <dialog ref={previewRef} className="pe-preview" aria-label={`Imagen ${preview + 1} de ${form.images.length}`} onClose={closePreview} onClick={(e) => { if (e.target === e.currentTarget) previewRef.current?.close(); }}>
      <img src={form.images[preview].url} alt={form.images[preview].alt || ""} />
      <div className="pe-preview__bar">
        <span>Imagen {preview + 1} de {form.images.length}{form.mainImage === form.images[preview].url ? " · principal" : ""}</span>
        <button type="button" className="admin-btn admin-btn--sm" onClick={() => previewRef.current?.close()}>Cerrar</button>
      </div>
    </dialog>}

    {ConfirmModal && <ConfirmModal isOpen={leaveTo !== null} title="Cambios sin guardar"
      message="Tienes cambios sin guardar en este producto. Si sales ahora se descartarán."
      confirmLabel="Descartar cambios" cancelLabel="Seguir editando"
      onCancel={() => setLeaveTo(null)}
      onConfirm={() => { const target = leaveTo; leavingRef.current = true; setLeaveTo(null); router.push(target); }} />}
    </>
  );
}

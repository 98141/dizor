"use client";

import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import Image from "next/image";
import AuthFormField from "@/components/admin/AdminFormField";
import AuthErrorAlert from "@/components/admin/AdminFeedback";
import ConfirmModal from "@/components/admin/AdminConfirmModal";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import {
  getAdminHomeImages,
  createAdminHomeImage,
  updateAdminHomeImage,
  reorderAdminHomeImages,
  deleteAdminHomeImage,
} from "@/services/adminHomeImageService";
import { getCatalogFilters } from "@/services/productService";
import InspirationFocalEditor from "@/components/admin/InspirationFocalEditor";
import {
  DEFAULT_INSPIRATION_RATIO,
  frameRatio,
  inspirationLayout,
} from "@/lib/inspirationLayout";

const SECTIONS = [
  { id: "hero", label: "Hero", hint: "Varias fotografías full-bleed ordenables. La de menor orden es la principal (LCP). Se muestran en crossfade en el inicio." },
  { id: "historia", label: "Historia", hint: "Imagen del bloque origen / historia" },
  { id: "personalizacion", label: "Personalización", hint: "Imagen vertical del bloque a tu medida" },
  { id: "pormayor", label: "Por mayor", hint: "Imagen del bloque pedidos al por mayor" },
  {
    id: "coleccion",
    label: "Colecciones",
    hint: "Asocia cada imagen a un tejido. Puedes subir varias por tejido (orden = secuencia del carrusel).",
  },
  { id: "inspiracion", label: "Inspiración", hint: "Mosaico 1 grande + 4 pequeñas · máximo 5 imágenes" },
  {
    id: "editorial1",
    label: "Pausa editorial 1",
    hint: "Solo fotografía entre Descubre hoy y Personalización. 1 imagen (panorámica) o 2 (composición). Sin título ni CTA. Máx. 2.",
  },
  {
    id: "editorial2",
    label: "Pausa editorial 2",
    hint: "Solo fotografía entre Reseñas e Inspiración. 1 imagen (panorámica) o 2 (composición). Sin título ni CTA. Máx. 2.",
  },
];

const INSPIRACION_MAX = 5;
const EDITORIAL_MAX = 2;

function weaveOptionId(wt) {
  return String(wt._id || wt.id || "");
}

const INSPIRACION_UPLOAD_HELP =
  "Recomendado: foto cuadrada de 2000 × 2000 px. Deja aire alrededor del producto, especialmente arriba y abajo. Revisa el encuadre en móvil y escritorio antes de guardar.";

/** Ancho de la vista previa ≈ marco real a 1280 px (escritorio) y 390 px (móvil), a escala. */
const DESKTOP_PREVIEW = {
  lead: { width: 190, label: "protagonista" },
  secondary: { width: 146, label: "secundaria" },
  half: { width: 200, label: "media fila" },
  grid: { width: 140, label: "en fila" },
  single: { width: 200, label: "individual" },
};
const MOBILE_PREVIEW = {
  pair: { width: 104, label: "en pareja" },
  center: { width: 104, label: "centrada" },
  wide: { width: 212, label: "a lo ancho" },
  single: { width: 212, label: "individual" },
  lead: { width: 212, label: "protagonista a lo ancho" },
};

/**
 * Marcos que tendrá la foto `index` dentro de `ratios` (fotos activas en
 * orden), con las mismas reglas que la galería pública.
 */
function inspirationPreviews(ratios, index) {
  const slot = inspirationLayout(ratios)[index];
  if (!slot) return [];
  const d = DESKTOP_PREVIEW[slot.desktop.kind];
  const m = MOBILE_PREVIEW[slot.mobile.kind];
  const pos = `posición ${index + 1} de ${ratios.length}`;
  return [
    {
      key: "desktop",
      label: `Escritorio · ${d.label} · ${slot.desktop.frame || "≈ 4:5"} · ${pos}`,
      ratio: frameRatio(slot.desktop.frame),
      width: d.width,
    },
    {
      key: "mobile",
      label: `Móvil · ${m.label} · ${slot.mobile.frame}`,
      ratio: frameRatio(slot.mobile.frame),
      width: m.width,
    },
  ];
}

/**
 * Versión ligera para el editor de encuadre (misma proporción que el
 * original): los originales pueden pesar varios MB.
 */
function editorPreviewUrl(url) {
  return String(url || "").replace(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/,
    "$1c_limit,w_1200,q_auto,f_auto/"
  );
}

function sameFocal(a, b) {
  return (a ?? null) === (b ?? null);
}

export default function HomeImagesTab() {
  const [section, setSection] = useState("hero");
  const [images, setImages] = useState([]);
  const [weaveTypes, setWeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [zoom, setZoom] = useState(null);
  const { message, error, flashKey, showMsg, clearMsg } = useFlashMessage();

  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState("");
  const [titulo, setTitulo] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [weaveType, setWeaveType] = useState("");

  // Encuadre (solo Inspiración)
  const [ratiosById, setRatiosById] = useState({});
  const [savedFocalById, setSavedFocalById] = useState({});
  const [newFocal, setNewFocal] = useState({ x: null, y: null });
  const [newRatio, setNewRatio] = useState(null);
  const newPreviewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );
  useEffect(
    () => () => {
      if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl);
    },
    [newPreviewUrl]
  );

  const load = useCallback(async () => {
    setLoading(true);    try {
      const [imagesData, filtersData] = await Promise.all([
        getAdminHomeImages(),
        getCatalogFilters().catch(() => null),
      ]);
      setImages(imagesData.images || []);
      setSavedFocalById(
        Object.fromEntries(
          (imagesData.images || []).map((img) => [
            img.id,
            { focalX: img.focalX ?? null, focalY: img.focalY ?? null },
          ])
        )
      );
      setWeaveTypes(filtersData?.filters?.weaveTypes || []);
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al cargar imágenes", true);
    } finally {
      setLoading(false);
    }
  }, [showMsg]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminHomeImages(),
      getCatalogFilters().catch(() => null),
    ]).then(([imagesData, filtersData]) => {
      if (cancelled) return;
      setImages(imagesData.images || []);
      setSavedFocalById(Object.fromEntries((imagesData.images || []).map((img) => [img.id, { focalX: img.focalX ?? null, focalY: img.focalY ?? null }])));
      setWeaveTypes(filtersData?.filters?.weaveTypes || []);
    }).catch((err) => {
      if (!cancelled) showMsg(err.response?.data?.message || "Error al cargar imágenes", true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [showMsg]);

  const sectionImages = useMemo(
    () =>
      images
        .filter((img) => img.seccion === section)
        .sort((a, b) => a.orden - b.orden),
    [images, section]
  );

  const inspiracionFull =
    section === "inspiracion" && sectionImages.length >= INSPIRACION_MAX;
  const editorialFull =
    (section === "editorial1" || section === "editorial2") &&
    sectionImages.length >= EDITORIAL_MAX;
  const sectionFull = inspiracionFull || editorialFull;

  const sectionMeta = SECTIONS.find((s) => s.id === section);

  const resetForm = () => {
    setFile(null);
    setAltText("");
    setTitulo("");
    setLinkHref("");
    setWeaveType("");
    setNewFocal({ x: null, y: null });
    setNewRatio(null);
  };

  /** Fotos que verá el público (activas, en orden), con su proporción medida. */
  const ratioOf = (img) => ratiosById[img.id] || DEFAULT_INSPIRATION_RATIO;
  const previewsForCard = (img) => {
    const list = sectionImages.filter((x) => x.activo || x.id === img.id);
    return inspirationPreviews(list.map(ratioOf), list.findIndex((x) => x.id === img.id));
  };
  const previewsForNew = () => {
    const list = sectionImages.filter((x) => x.activo);
    return inspirationPreviews(
      [...list.map(ratioOf), newRatio || DEFAULT_INSPIRATION_RATIO],
      list.length
    );
  };
  const setCardFocal = (id, focalX, focalY) =>
    setImages((prev) =>
      prev.map((x) => (x.id === id ? { ...x, focalX, focalY } : x))
    );

  const applyWeaveSelection = (id, setTitle, setLink, setWeave) => {
    setWeave(id);
    const wt = weaveTypes.find((w) => weaveOptionId(w) === id);
    if (wt) {
      setTitle(wt.name || "");
      setLink(id ? `/catalogo?weaveType=${id}` : "");
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      showMsg("Selecciona una imagen desde tu dispositivo", true);
      return;
    }
    if (section === "inspiracion" && sectionImages.length >= INSPIRACION_MAX) {
      showMsg(`Inspiración admite máximo ${INSPIRACION_MAX} imágenes`, true);
      return;
    }
    if (
      (section === "editorial1" || section === "editorial2") &&
      sectionImages.length >= EDITORIAL_MAX
    ) {
      showMsg(
        `Las pausas editoriales admiten máximo ${EDITORIAL_MAX} imágenes`,
        true
      );
      return;
    }
    if (section === "coleccion" && !weaveType) {
      showMsg("Selecciona el tejido al que pertenece esta imagen", true);
      return;
    }
    if (savingLock.current) return;

    savingLock.current = true;

    setSaving(true);
    clearMsg();
    try {
      await createAdminHomeImage({
        file,
        seccion: section,
        altText,
        titulo,
        linkHref,
        weaveType: section === "coleccion" ? weaveType : undefined,
        activo: true,
        focalX: section === "inspiracion" ? newFocal.x : undefined,
        focalY: section === "inspiracion" ? newFocal.y : undefined,
      });
      showMsg("Imagen subida");
      resetForm();
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo subir", true);
    } finally {
      savingLock.current = false; setSaving(false);
    }
  };

  const move = async (id, direction) => {
    const list = [...sectionImages];
    const idx = list.findIndex((img) => img.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;

    const reordered = [...list];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const items = reordered.map((img, i) => ({ id: img.id, orden: i }));

    if (savingLock.current) return;


    savingLock.current = true;


    setSaving(true);
    try {
      await reorderAdminHomeImages(items);
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo reordenar", true);
    } finally {
      savingLock.current = false; setSaving(false);
    }
  };

  const toggleActive = async (img) => {
    if (savingLock.current) return;

    savingLock.current = true;

    setSaving(true);
    try {
      await updateAdminHomeImage(img.id, { activo: !img.activo });
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo actualizar", true);
    } finally {
      savingLock.current = false; setSaving(false);
    }
  };

  const saveMeta = async (img, patch) => {
    if (savingLock.current) return;

    savingLock.current = true;

    setSaving(true);
    try {
      await updateAdminHomeImage(img.id, patch);
      await load();
      showMsg("Guardado");
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo guardar", true);
    } finally {
      savingLock.current = false; setSaving(false);
    }
  };

  const remove = (id) => {
    setConfirmModal({
      message:
        "¿Eliminar esta imagen? También se borrará de Cloudinary si tiene publicId.",
      onConfirm: async () => {
        setConfirmModal(null);
        if (savingLock.current) return;

        savingLock.current = true;

        setSaving(true);
        try {
          await deleteAdminHomeImage(id);
          showMsg("Imagen eliminada");
          await load();
        } catch (err) {
          showMsg(err.response?.data?.message || "No se pudo eliminar", true);
        } finally {
          savingLock.current = false; setSaving(false);
        }
      },
    });
  };

  if (loading) return <p className="auth-loading">Cargando…</p>;

  return (
    <div className="st-images">
      <p className="admin-page__subtitle" style={{ marginTop: 0 }}>
        Sube, reordena y elimina las imágenes de cada sección del inicio
        (Cloudinary). Los textos se editan en la pestaña Inicio.
      </p>

      <ConfirmModal
        isOpen={!!confirmModal}
        message={confirmModal?.message}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />
      <AuthErrorAlert
        key={flashKey}
        message={message}
        variant={error ? "error" : "success"}
      />

      <nav className="cms-tabs cms-tabs--sub" aria-label="Secciones de imágenes">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`st-tab${section === s.id ? " active" : ""}`}
            onClick={() => {
              setSection(s.id);
              clearMsg();
              resetForm();
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
        {sectionMeta?.hint}
        {section === "inspiracion"
          ? ` · ${sectionImages.length}/${INSPIRACION_MAX}`
          : ""}
        {section === "editorial1" || section === "editorial2"
          ? ` · ${sectionImages.length}/${EDITORIAL_MAX}`
          : ""}
        {section === "hero" && sectionImages.length > 0
          ? ` · ${sectionImages.length} foto${sectionImages.length === 1 ? "" : "s"} · la primera del orden es la principal`
          : ""}
      </p>

      <form className="admin-form product-form__section st-upload" onSubmit={handleUpload}>
        <h2>Subir imagen — {sectionMeta?.label}</h2>
        {inspiracionFull ? (
          <p className="admin-page__subtitle">
            Ya hay {INSPIRACION_MAX} imágenes. Elimina una para subir otra.
          </p>
        ) : null}
        {editorialFull ? (
          <p className="admin-page__subtitle">
            Ya hay {EDITORIAL_MAX} imágenes en esta pausa. Elimina una para
            subir otra.
          </p>
        ) : null}
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="home-image-file">
            Archivo (obligatorio)
          </label>
          <input
            id="home-image-file"
            type="file"
            accept="image/*"
            disabled={sectionFull || saving}
            aria-describedby={
              section === "inspiracion" ? "home-image-file-help" : undefined
            }
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setNewFocal({ x: null, y: null });
              setNewRatio(null);
            }}
          />
          {section === "inspiracion" ? (
            <p id="home-image-file-help" className="focal-editor__note">
              {INSPIRACION_UPLOAD_HELP}
            </p>
          ) : null}
        </div>
        {section === "inspiracion" && newPreviewUrl && !sectionFull ? (
          <div className="st-span"><InspirationFocalEditor
            src={newPreviewUrl}
            focalX={newFocal.x}
            focalY={newFocal.y}
            onChange={(x, y) => setNewFocal({ x, y })}
            onRatio={setNewRatio}
            previews={previewsForNew()}
            idPrefix="focal-new"
            disabled={saving}
          /></div>
        ) : null}
        <AuthFormField
          label="Texto alternativo"
          name="altText"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
        />
        {section === "coleccion" && (
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="coleccion-weaveType">
              Tejido (obligatorio)
            </label>
            <select
              id="coleccion-weaveType"
              className="auth-field__input"
              value={weaveType}
              disabled={saving}
              onChange={(e) =>
                applyWeaveSelection(
                  e.target.value,
                  setTitulo,
                  setLinkHref,
                  setWeaveType
                )
              }
              required
            >
              <option value="">Selecciona un tejido…</option>
              {weaveTypes.map((wt) => (
                <option key={weaveOptionId(wt)} value={weaveOptionId(wt)}>
                  {wt.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {(section === "coleccion" || section === "inspiracion") && (
          <>
            <AuthFormField
              label="Título"
              name="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
            <AuthFormField
              label="Enlace"
              name="linkHref"
              value={linkHref}
              placeholder={
                section === "coleccion"
                  ? "/catalogo?weaveType=…"
                  : "https://instagram.com/…"
              }
              onChange={(e) => setLinkHref(e.target.value)}
            />
          </>
        )}
        <div className="cms-section-actions cms-section-actions--end">
          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={saving || sectionFull}
          >
            {saving ? "Subiendo…" : "Subir a Cloudinary"}
          </button>
        </div>
      </form>

      <section className="product-form__section" style={{ marginTop: "1.5rem" }}>
        <h2>Imágenes ({sectionImages.length})</h2>
        {sectionImages.length === 0 ? (
          <p className="admin-page__subtitle">
            Aún no hay imágenes en esta sección.
          </p>
        ) : (
          <div className="st-gallery">
            {sectionImages.map((img, idx) => (
              <article key={img.id} className="st-card">
                <button type="button" className="st-zoom" onClick={() => setZoom(img)} aria-label={`Ver imagen ${img.altText || img.titulo || idx + 1}`}>
                  <Image src={img.url} alt="" width={320} height={112} unoptimized className="st-thumb" />
                </button>
                <p className="st-meta">
                  {img.titulo || img.altText || "Sin título"}
                  {img.publicId ? ` · ${img.publicId}` : ""}
                </p>
                <p className="st-meta">
                  Orden {img.orden}
                  {" "}
                  <span className={img.activo ? "st-chip st-chip--on" : "st-chip st-chip--off"}>{img.activo ? "Activa" : "Inactiva"}</span>
                  {section === "hero" && idx === 0 ? <span className="st-chip st-chip--on"> Principal (LCP)</span> : null}
                  {img.weaveTypeId ? ` · tejido ${weaveTypes.find((w) => weaveOptionId(w) === img.weaveTypeId)?.name || img.weaveTypeId}` : ""}
                </p>
                <div className="st-image-actions">
                  <button type="button" className="admin-btn admin-btn--sm" disabled={saving || idx === 0} onClick={() => move(img.id, -1)} aria-label={`Subir imagen ${idx + 1}`}>Subir</button>
                  <button type="button" className="admin-btn admin-btn--sm" disabled={saving || idx === sectionImages.length - 1} onClick={() => move(img.id, 1)} aria-label={`Bajar imagen ${idx + 1}`}>Bajar</button>
                </div>
                <details className="st-more">
                  <summary>Editar datos</summary>
                  {section === "inspiracion" ? (
                    <>
                      <InspirationFocalEditor
                        src={editorPreviewUrl(img.url)}
                        focalX={img.focalX ?? null}
                        focalY={img.focalY ?? null}
                        onChange={(x, y) => setCardFocal(img.id, x, y)}
                        onRatio={(ratio) => setRatiosById((prev) => (prev[img.id] === ratio ? prev : { ...prev, [img.id]: ratio }))}
                        previews={previewsForCard(img)}
                        idPrefix={`focal-${img.id}`}
                        disabled={saving}
                      />
                      {!sameFocal(img.focalX, savedFocalById[img.id]?.focalX) || !sameFocal(img.focalY, savedFocalById[img.id]?.focalY) ? (
                        <p className="focal-editor__note" role="status">Encuadre sin guardar: pulsa «Guardar datos».</p>
                      ) : null}
                    </>
                  ) : null}
                <div className="auth-field">
                  <label className="auth-field__label">Alt
                  <input
                    className="auth-field__input"
                    value={img.altText || ""}
                    onChange={(e) =>
                      setImages((prev) =>
                        prev.map((x) =>
                          x.id === img.id
                            ? { ...x, altText: e.target.value }
                            : x
                        )
                      )
                    }
                  /></label>
                </div>
                {section === "coleccion" && (
                  <div className="auth-field">
                    <label className="auth-field__label">Tejido
                    <select
                      className="auth-field__input"
                      value={img.weaveTypeId || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        const wt = weaveTypes.find(
                          (w) => weaveOptionId(w) === id
                        );
                        setImages((prev) =>
                          prev.map((x) =>
                            x.id === img.id
                              ? {
                                  ...x,
                                  weaveTypeId: id || null,
                                  titulo: wt?.name || x.titulo,
                                  linkHref: id
                                    ? `/catalogo?weaveType=${id}`
                                    : x.linkHref,
                                }
                              : x
                          )
                        );
                      }}
                    >
                      <option value="">Sin asociar…</option>
                      {weaveTypes.map((wt) => (
                        <option
                          key={weaveOptionId(wt)}
                          value={weaveOptionId(wt)}
                        >
                          {wt.name}
                        </option>
                      ))}
                    </select></label>
                  </div>
                )}
                {(section === "coleccion" || section === "inspiracion") && (
                  <>
                    <div className="auth-field">
                      <label className="auth-field__label">Título
                      <input
                        className="auth-field__input"
                        value={img.titulo || ""}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((x) =>
                              x.id === img.id
                                ? { ...x, titulo: e.target.value }
                                : x
                            )
                          )
                        }
                      /></label>
                    </div>
                    <div className="auth-field">
                      <label className="auth-field__label">Enlace
                      <input
                        className="auth-field__input"
                        value={img.linkHref || ""}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((x) =>
                              x.id === img.id
                                ? { ...x, linkHref: e.target.value }
                                : x
                            )
                          )
                        }
                      /></label>
                    </div>
                  </>
                )}
                <div className="st-image-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--primary"
                    disabled={saving}
                    onClick={() =>
                      saveMeta(img, {
                        altText: img.altText || "",
                        titulo: img.titulo || "",
                        linkHref: img.linkHref || "",
                        weaveType:
                          section === "coleccion"
                            ? img.weaveTypeId || null
                            : undefined,
                        ...(section === "inspiracion"
                          ? {
                              focalX: img.focalX ?? null,
                              focalY: img.focalY ?? null,
                            }
                          : {}),
                      })
                    }
                  >
                    Guardar datos
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    disabled={saving}
                    onClick={() => toggleActive(img)}
                  >
                    {img.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--danger"
                    disabled={saving}
                    onClick={() => remove(img.id)}
                  >
                    Eliminar
                  </button>
                </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
      {zoom ? (
        <dialog open className="st-panel" aria-label="Imagen ampliada" style={{ position: "fixed", inset: "10vh 8vw auto", zIndex: 40, maxWidth: 720, margin: "0 auto" }}>
          <Image src={zoom.url} alt={zoom.altText || zoom.titulo || "Imagen de la sección"} width={960} height={640} unoptimized style={{ width: "100%", height: "auto", maxHeight: "70vh", objectFit: "contain" }} />
          <p className="st-meta">{zoom.altText || "Sin texto alternativo"}{zoom.publicId ? ` · ${zoom.publicId}` : ""}</p>
          <button type="button" className="admin-btn admin-btn--tertiary" onClick={() => setZoom(null)}>Cerrar</button>
        </dialog>
      ) : null}
    </div>
  );
}

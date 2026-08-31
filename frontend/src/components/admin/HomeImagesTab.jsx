"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useFlashMessage } from "@/hooks/useFlashMessage";
import {
  getAdminHomeImages,
  createAdminHomeImage,
  updateAdminHomeImage,
  reorderAdminHomeImages,
  deleteAdminHomeImage,
} from "@/services/adminHomeImageService";

const SECTIONS = [
  { id: "hero", label: "Hero", hint: "Una imagen principal full-bleed (la de menor orden)" },
  { id: "historia", label: "Historia", hint: "Imagen del bloque origen / historia" },
  { id: "personalizacion", label: "Personalización", hint: "Imagen vertical del bloque a tu medida" },
  { id: "pormayor", label: "Por mayor", hint: "Imagen del bloque pedidos al por mayor" },
  { id: "coleccion", label: "Colecciones", hint: "Tarjetas de tejidos/colecciones (título + enlace)" },
  { id: "inspiracion", label: "Inspiración", hint: "Mosaico 1 grande + 4 pequeñas · máximo 5 imágenes" },
];

const INSPIRACION_MAX = 5;

export default function HomeImagesTab() {
  const [section, setSection] = useState("hero");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const { message, error, flashKey, showMsg, clearMsg } = useFlashMessage();

  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState("");
  const [titulo, setTitulo] = useState("");
  const [linkHref, setLinkHref] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    clearMsg();
    try {
      const data = await getAdminHomeImages();
      setImages(data.images || []);
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al cargar imágenes", true);
    } finally {
      setLoading(false);
    }
  }, [clearMsg, showMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const sectionImages = useMemo(
    () =>
      images
        .filter((img) => img.seccion === section)
        .sort((a, b) => a.orden - b.orden),
    [images, section]
  );

  const inspiracionFull =
    section === "inspiracion" && sectionImages.length >= INSPIRACION_MAX;

  const sectionMeta = SECTIONS.find((s) => s.id === section);

  const resetForm = () => {
    setFile(null);
    setAltText("");
    setTitulo("");
    setLinkHref("");
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
    setSaving(true);
    clearMsg();
    try {
      await createAdminHomeImage({
        file,
        seccion: section,
        altText,
        titulo,
        linkHref,
        activo: true,
      });
      showMsg("Imagen subida");
      resetForm();
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo subir", true);
    } finally {
      setSaving(false);
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

    setSaving(true);
    try {
      await reorderAdminHomeImages(items);
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo reordenar", true);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (img) => {
    setSaving(true);
    try {
      await updateAdminHomeImage(img.id, { activo: !img.activo });
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo actualizar", true);
    } finally {
      setSaving(false);
    }
  };

  const saveMeta = async (img, patch) => {
    setSaving(true);
    try {
      await updateAdminHomeImage(img.id, patch);
      await load();
      showMsg("Guardado");
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo guardar", true);
    } finally {
      setSaving(false);
    }
  };

  const remove = (id) => {
    setConfirmModal({
      message: "¿Eliminar esta imagen? También se borrará de Cloudinary si tiene publicId.",
      onConfirm: async () => {
        setConfirmModal(null);
        setSaving(true);
        try {
          await deleteAdminHomeImage(id);
          showMsg("Imagen eliminada");
          await load();
        } catch (err) {
          showMsg(err.response?.data?.message || "No se pudo eliminar", true);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  if (loading) return <p className="auth-loading">Cargando…</p>;

  return (
    <div>
      <p className="admin-page__subtitle" style={{ marginTop: 0 }}>
        Sube, reordena y elimina las imágenes de cada sección del inicio (Cloudinary).
        Los textos se editan en la pestaña Inicio.
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
            className={section === s.id ? "active" : ""}
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
      </p>

      <form className="admin-form product-form__section" onSubmit={handleUpload}>
        <h2>Subir imagen — {sectionMeta?.label}</h2>
        {inspiracionFull ? (
          <p className="admin-page__subtitle">
            Ya hay {INSPIRACION_MAX} imágenes. Elimina una para subir otra.
          </p>
        ) : null}
        <div className="auth-field">
          <label className="auth-field__label">Archivo (obligatorio)</label>
          <input
            type="file"
            accept="image/*"
            disabled={inspiracionFull || saving}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <AuthFormField
          label="Texto alternativo"
          name="altText"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
        />
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
            disabled={saving || inspiracionFull}
          >
            {saving ? "Subiendo…" : "Subir a Cloudinary"}
          </button>
        </div>
      </form>

      <section className="product-form__section" style={{ marginTop: "1.5rem" }}>
        <h2>Imágenes ({sectionImages.length})</h2>
        {sectionImages.length === 0 ? (
          <p className="admin-page__subtitle">Aún no hay imágenes en esta sección.</p>
        ) : (
          <div className="admin-grid-2">
            {sectionImages.map((img, idx) => (
              <article key={img.id} className="taxonomy-form-card">
                <img
                  src={img.url}
                  alt={img.altText || img.titulo || "Home"}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: "100%",
                    height: 160,
                    objectFit: "cover",
                    borderRadius: 4,
                    border: "1px solid var(--color-border)",
                  }}
                />
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  Orden {img.orden} · {img.activo ? "Activa" : "Inactiva"}
                </p>
                <div className="auth-field">
                  <label className="auth-field__label">Alt</label>
                  <input
                    className="auth-field__input"
                    value={img.altText || ""}
                    onChange={(e) =>
                      setImages((prev) =>
                        prev.map((x) =>
                          x.id === img.id ? { ...x, altText: e.target.value } : x
                        )
                      )
                    }
                  />
                </div>
                {(section === "coleccion" || section === "inspiracion") && (
                  <>
                    <div className="auth-field">
                      <label className="auth-field__label">Título</label>
                      <input
                        className="auth-field__input"
                        value={img.titulo || ""}
                        onChange={(e) =>
                          setImages((prev) =>
                            prev.map((x) =>
                              x.id === img.id ? { ...x, titulo: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>
                    <div className="auth-field">
                      <label className="auth-field__label">Enlace</label>
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
                      />
                    </div>
                  </>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    disabled={saving}
                    onClick={() =>
                      saveMeta(img, {
                        altText: img.altText || "",
                        titulo: img.titulo || "",
                        linkHref: img.linkHref || "",
                      })
                    }
                  >
                    Guardar datos
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    disabled={saving || idx === 0}
                    onClick={() => move(img.id, -1)}
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    disabled={saving || idx === sectionImages.length - 1}
                    onClick={() => move(img.id, 1)}
                  >
                    Bajar
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

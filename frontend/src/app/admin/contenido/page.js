"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  getAdminHomeContent,
  updateAdminHomeContent,
  getAdminPages,
  getAdminPage,
  createAdminPage,
  updateAdminPage,
  deleteAdminPage,
  getAdminBanners,
  createAdminBanner,
  updateAdminBanner,
  deleteAdminBanner,
  uploadCmsImage,
} from "@/services/adminCmsService";
import {
  getMarketingSettings,
  updateMarketingSettings,
  getNewsletterSubscribers,
  getAbandonedCarts,
  sendAbandonedReminders,
  exportNewsletterCsv,
  exportOrdersCsv,
  exportAbandonedCartsCsv,
} from "@/services/adminMarketingService";
import {
  getStoreSettings,
  updateStoreSettings,
} from "@/services/adminSettingsService";
import { formatCOP } from "@/lib/formatCurrency";

const TABS = [
  { id: "home", label: "Inicio" },
  { id: "banners", label: "Banners" },
  { id: "pages", label: "Páginas" },
  { id: "popup", label: "Popup" },
  { id: "newsletter", label: "Newsletter" },
  { id: "carritos", label: "Carritos" },
  { id: "exports", label: "Exportar" },
  { id: "appearance", label: "Apariencia" },
];

const emptyPage = () => ({
  title: "",
  excerpt: "",
  imageUrl: "",
  imageAlt: "",
  body: "",
  isPublished: false,
  showInFooter: true,
  sortOrder: 0,
  seoTitle: "",
  seoDescription: "",
});

const emptyBanner = () => ({
  title: "",
  subtitle: "",
  imageUrl: "",
  linkHref: "/catalogo",
  ctaLabel: "Ver más",
  placement: "home_mid",
  sortOrder: 0,
  isActive: true,
});

const normalizeMarketing = (raw) => ({
  ...raw,
  popup: {
    enabled: false,
    delaySeconds: 4,
    showNewsletterForm: true,
    title: "",
    text: "",
    ctaLabel: "Suscribirme",
    ctaHref: "",
    imageUrl: "",
    ...(raw?.popup || {}),
  },
  newsletter: {
    footerTitle: "Newsletter Dizor",
    footerText: "",
    successMessage: "¡Gracias! Te hemos suscrito.",
    ...(raw?.newsletter || {}),
  },
  abandonedCart: {
    enabled: true,
    delayHours: 24,
    maxReminders: 2,
    emailSubject: "Tu carrito te espera — Dizor",
    ...(raw?.abandonedCart || {}),
  },
});

const normalizeAppearance = (raw) => ({
  siteName: "",
  primaryColor: "",
  accentColor: "",
  bgColor: "",
  faviconUrl: "",
  ...(raw || {}),
});

function ColorField({ label, value, onChange }) {
  return (
    <div className="appearance-color-field">
      <label className="auth-field__label">{label}</label>
      <div className="appearance-color-row">
        <input
          type="color"
          value={value || "#3d4f3a"}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-color-picker"
        />
        <input
          type="text"
          className="auth-field__input"
          value={value}
          placeholder="Vacío = color por defecto"
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        {value && (
          <button
            type="button"
            className="admin-btn admin-btn--sm"
            onClick={() => onChange("")}
          >
            Restablecer
          </button>
        )}
      </div>
    </div>
  );
}

function CmsImageField({ label, value, onChange, placeholder = "https://res.cloudinary.com/…" }) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadErr("La imagen supera el límite de 10 MB");
      return;
    }
    setUploading(true);
    setUploadErr("");
    try {
      const data = await uploadCmsImage(file);
      onChange(data.url);
    } catch (err) {
      setUploadErr(err.response?.data?.message || "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="auth-field">
      <label className="auth-field__label">{label}</label>
      <div className="image-upload-block">
        <label className={`admin-btn admin-btn--sm image-upload-label${uploading ? " is-uploading" : ""}`}>
          {uploading ? (
            <><span className="upload-spinner" aria-hidden="true" /> Subiendo…</>
          ) : (
            "Subir desde equipo"
          )}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={uploading}
            onChange={handleFile}
          />
        </label>
        <span className="image-upload-hint">JPG, PNG, WebP · máx. 10 MB</span>
      </div>
      <div className="image-section-divider"><span>o usa URL</span></div>
      <input
        className="auth-field__input"
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { setUploadErr(""); onChange(e.target.value); }}
      />
      {uploadErr && (
        <p style={{ color: "var(--color-error)", fontSize: "0.82rem", marginTop: "0.25rem" }}>
          {uploadErr}
        </p>
      )}
      {value && (
        <div style={{ marginTop: "0.5rem" }}>
          <img
            src={value}
            alt="Vista previa"
            style={{ maxWidth: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 6, border: "1px solid var(--color-border)" }}
          />
        </div>
      )}
    </div>
  );
}

function ContenidoAdminContent() {
  const [tab, setTab] = useState("home");

  // CMS state
  const [home, setHome] = useState(null);
  const [pages, setPages] = useState([]);
  const [banners, setBanners] = useState([]);
  const [pageForm, setPageForm] = useState(emptyPage());
  const [editingPageId, setEditingPageId] = useState(null);
  const [bannerForm, setBannerForm] = useState(emptyBanner());
  const [editingBannerId, setEditingBannerId] = useState(null);

  // Marketing state
  const [marketing, setMarketing] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [carts, setCarts] = useState([]);

  // Appearance state
  const [appearance, setAppearance] = useState(normalizeAppearance(null));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  const showMsg = (text, isError = false) => {
    setMessage(text);
    setError(isError);
  };

  const load = async () => {
    setLoading(true);
    setMessage("");
    setError(false);
    try {
      const [homeRes, pagesRes, bannersRes] = await Promise.all([
        getAdminHomeContent(),
        getAdminPages(),
        getAdminBanners(),
      ]);
      setHome(homeRes.home);
      setPages(pagesRes.pages || []);
      setBanners(bannersRes.banners || []);
    } catch {
      showMsg("Error al cargar contenido CMS", true);
    }

    try {
      const mRes = await getMarketingSettings();
      setMarketing(normalizeMarketing(mRes.settings));
    } catch {
      setMarketing(normalizeMarketing({}));
    }

    try {
      const [subsRes, cartsRes] = await Promise.all([
        getNewsletterSubscribers({ limit: 50 }),
        getAbandonedCarts({ limit: 30 }),
      ]);
      setSubscribers(subsRes.subscribers || []);
      setCarts(cartsRes.carts || []);
    } catch {
      /* non-fatal */
    }

    try {
      const sRes = await getStoreSettings();
      setAppearance(normalizeAppearance(sRes.settings?.appearance));
    } catch {
      /* non-fatal */
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── CMS handlers ──────────────────────────────────────
  const saveHome = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      const data = await updateAdminHomeContent(home);
      setHome(data.home);
      showMsg("Inicio guardado");
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al guardar", true);
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () =>
    setHome((h) => ({ ...h, features: [...(h.features || []), { title: "", text: "" }] }));

  const updateFeature = (i, key, value) =>
    setHome((h) => {
      const features = [...h.features];
      features[i] = { ...features[i], [key]: value };
      return { ...h, features };
    });

  const removeFeature = (i) =>
    setHome((h) => ({ ...h, features: h.features.filter((_, idx) => idx !== i) }));

  const startEditPage = async (id) => {
    if (!id) { setEditingPageId(null); setPageForm(emptyPage()); return; }
    const data = await getAdminPage(id);
    setEditingPageId(id);
    setPageForm({
      title: data.page.title,
      excerpt: data.page.excerpt || "",
      imageUrl: data.page.imageUrl || "",
      imageAlt: data.page.imageAlt || "",
      body: data.page.body || "",
      isPublished: data.page.isPublished,
      showInFooter: data.page.showInFooter !== false,
      sortOrder: data.page.sortOrder || 0,
      seoTitle: data.page.seoTitle || "",
      seoDescription: data.page.seoDescription || "",
    });
  };

  const savePage = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      if (editingPageId) await updateAdminPage(editingPageId, pageForm);
      else await createAdminPage(pageForm);
      showMsg("Página guardada");
      setEditingPageId(null);
      setPageForm(emptyPage());
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al guardar página", true);
    } finally {
      setSaving(false);
    }
  };

  const removePage = (id) => {
    setConfirmModal({
      message: "¿Estás seguro de que deseas eliminar esta página? Esta acción no se puede deshacer.",
      onConfirm: async () => {
        setConfirmModal(null);
        await deleteAdminPage(id);
        if (editingPageId === id) startEditPage(null);
        await load();
      },
    });
  };

  const startEditBanner = (banner) => {
    if (!banner) { setEditingBannerId(null); setBannerForm(emptyBanner()); return; }
    setEditingBannerId(banner.id);
    setBannerForm({ ...banner });
  };

  const saveBanner = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      if (editingBannerId) await updateAdminBanner(editingBannerId, bannerForm);
      else await createAdminBanner(bannerForm);
      showMsg("Banner guardado");
      startEditBanner(null);
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al guardar banner", true);
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = (id) => {
    setConfirmModal({
      message: "¿Estás seguro de que deseas eliminar este banner? Esta acción no se puede deshacer.",
      onConfirm: async () => {
        setConfirmModal(null);
        await deleteAdminBanner(id);
        if (editingBannerId === id) startEditBanner(null);
        await load();
      },
    });
  };

  // ── Marketing handlers ────────────────────────────────
  const setPopup = (key, value) =>
    setMarketing((s) => ({ ...s, popup: { ...normalizeMarketing(s).popup, [key]: value } }));
  const setNl = (key, value) =>
    setMarketing((s) => ({ ...s, newsletter: { ...normalizeMarketing(s).newsletter, [key]: value } }));
  const setAbandoned = (key, value) =>
    setMarketing((s) => ({ ...s, abandonedCart: { ...normalizeMarketing(s).abandonedCart, [key]: value } }));

  const saveMarketing = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      const data = await updateMarketingSettings({
        popup: marketing.popup,
        newsletter: marketing.newsletter,
        abandonedCart: marketing.abandonedCart,
      });
      setMarketing(normalizeMarketing(data.settings));
      showMsg("Configuración de marketing guardada");
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo guardar", true);
    } finally {
      setSaving(false);
    }
  };

  const handleSendReminders = async () => {
    setSaving(true);
    try {
      const data = await sendAbandonedReminders();
      showMsg(data.message || "Recordatorios procesados");
      await load();
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al enviar", true);
    } finally {
      setSaving(false);
    }
  };

  // ── Appearance handler ────────────────────────────────
  const saveAppearance = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      await updateStoreSettings({ appearance });
      showMsg("Apariencia guardada — recarga la tienda para ver los cambios");
    } catch (err) {
      showMsg(err.response?.data?.message || "No se pudo guardar", true);
    } finally {
      setSaving(false);
    }
  };

  const setAppearanceField = (key, value) =>
    setAppearance((a) => ({ ...a, [key]: value }));

  if (loading) return <p className="auth-loading">Cargando…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Contenido & Marketing</h1>
      <p className="admin-page__subtitle">
        CMS, banners, páginas, marketing y apariencia del sitio.
      </p>

      <nav className="cms-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => { setTab(t.id); setMessage(""); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <ConfirmModal
        isOpen={!!confirmModal}
        message={confirmModal?.message}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />
      <AuthErrorAlert message={message} variant={error ? "error" : "success"} />

      {/* ── INICIO ── */}
      {tab === "home" && home && (
        <form className="admin-form product-form__section" onSubmit={saveHome}>
          <h2>Hero</h2>
          <AuthFormField label="Título" name="heroTitle" value={home.hero.title}
            onChange={(e) => setHome((h) => ({ ...h, hero: { ...h.hero, title: e.target.value } }))} />
          <div className="auth-field">
            <label className="auth-field__label">Subtítulo</label>
            <textarea className="auth-field__input" rows={3} value={home.hero.subtitle}
              onChange={(e) => setHome((h) => ({ ...h, hero: { ...h.hero, subtitle: e.target.value } }))} />
          </div>
          <AuthFormField label="Texto botón" name="ctaLabel" value={home.hero.ctaLabel}
            onChange={(e) => setHome((h) => ({ ...h, hero: { ...h.hero, ctaLabel: e.target.value } }))} />
          <AuthFormField label="Enlace botón" name="ctaHref" value={home.hero.ctaHref}
            onChange={(e) => setHome((h) => ({ ...h, hero: { ...h.hero, ctaHref: e.target.value } }))} />
          <CmsImageField
            label="Imagen de fondo"
            value={home.hero.imageUrl || ""}
            onChange={(url) => setHome((h) => ({ ...h, hero: { ...h.hero, imageUrl: url } }))}
          />

          <h2>Barra de anuncio</h2>
          <label className="admin-checkbox">
            <input type="checkbox" checked={home.announcement.isActive}
              onChange={(e) => setHome((h) => ({ ...h, announcement: { ...h.announcement, isActive: e.target.checked } }))} />
            Mostrar barra superior
          </label>
          <AuthFormField label="Texto anuncio" name="announceText" value={home.announcement.text}
            onChange={(e) => setHome((h) => ({ ...h, announcement: { ...h.announcement, text: e.target.value } }))} />
          <AuthFormField label="Enlace anuncio" name="announceLink" value={home.announcement.linkHref}
            onChange={(e) => setHome((h) => ({ ...h, announcement: { ...h.announcement, linkHref: e.target.value } }))} />

          <h2>Sección destacados</h2>
          <AuthFormField label="Título" name="featTitle" value={home.featuredSection.title}
            onChange={(e) => setHome((h) => ({ ...h, featuredSection: { ...h.featuredSection, title: e.target.value } }))} />

          <h2>Bloques informativos</h2>
          {home.features.map((f, i) => (
            <div key={i} className="cms-feature-row">
              <AuthFormField label="Título" name={`ft-${i}`} value={f.title}
                onChange={(e) => updateFeature(i, "title", e.target.value)} />
              <AuthFormField label="Texto" name={`fx-${i}`} value={f.text}
                onChange={(e) => updateFeature(i, "text", e.target.value)} />
              <button type="button" className="admin-btn admin-btn--sm admin-btn--danger"
                onClick={() => removeFeature(i)}>Quitar</button>
            </div>
          ))}
          <button type="button" className="admin-btn" onClick={addFeature}>+ Bloque</button>
          <AuthSubmitButton loading={saving}>Guardar inicio</AuthSubmitButton>
        </form>
      )}

      {/* ── BANNERS ── */}
      {tab === "banners" && (
        <div className="admin-grid-2">
          <section className="taxonomy-form-card">
            <h2>{editingBannerId ? "Editar banner" : "Nuevo banner"}</h2>
            <form className="admin-form" onSubmit={saveBanner}>
              <AuthFormField label="Título" name="bTitle" value={bannerForm.title} required
                onChange={(e) => setBannerForm((p) => ({ ...p, title: e.target.value }))} />
              <AuthFormField label="Subtítulo" name="bSub" value={bannerForm.subtitle}
                onChange={(e) => setBannerForm((p) => ({ ...p, subtitle: e.target.value }))} />
              <CmsImageField
                label="Imagen"
                value={bannerForm.imageUrl}
                onChange={(url) => setBannerForm((p) => ({ ...p, imageUrl: url }))}
              />
              <AuthFormField label="Enlace" name="bLink" value={bannerForm.linkHref}
                onChange={(e) => setBannerForm((p) => ({ ...p, linkHref: e.target.value }))} />
              <div className="admin-form__group">
                <label htmlFor="placement">Ubicación</label>
                <select id="placement" value={bannerForm.placement}
                  onChange={(e) => setBannerForm((p) => ({ ...p, placement: e.target.value }))}>
                  <option value="home_mid">Inicio (medio)</option>
                  <option value="catalog_top">Catálogo (arriba)</option>
                </select>
              </div>
              <label className="admin-checkbox">
                <input type="checkbox" checked={bannerForm.isActive}
                  onChange={(e) => setBannerForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Activo
              </label>
              <AuthSubmitButton loading={saving}>{editingBannerId ? "Actualizar" : "Crear"}</AuthSubmitButton>
              {editingBannerId && (
                <button type="button" className="admin-btn" onClick={() => startEditBanner(null)}>Cancelar</button>
              )}
            </form>
          </section>
          <section className="taxonomy-list-card">
            <h2>Banners</h2>
            {banners.map((b) => (
              <div key={b.id} className="cms-banner-card">
                <strong>{b.title}</strong>
                <p className="admin-muted">{b.placement}</p>
                <div className="admin-table__actions">
                  <button type="button" className="admin-btn admin-btn--sm" onClick={() => startEditBanner(b)}>Editar</button>
                  <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => removeBanner(b.id)}>Eliminar</button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* ── PÁGINAS ── */}
      {tab === "pages" && (
        <div className="admin-grid-2">
          <section className="taxonomy-form-card">
            <h2>{editingPageId ? "Editar página" : "Nueva página"}</h2>
            <form className="admin-form" onSubmit={savePage}>
              <AuthFormField label="Título" name="pTitle" value={pageForm.title} required
                onChange={(e) => setPageForm((p) => ({ ...p, title: e.target.value }))} />
              <AuthFormField label="Extracto (subtítulo visible)" name="pExcerpt" value={pageForm.excerpt}
                onChange={(e) => setPageForm((p) => ({ ...p, excerpt: e.target.value }))} />

              <CmsImageField
                label="Imagen destacada"
                value={pageForm.imageUrl}
                onChange={(url) => setPageForm((p) => ({ ...p, imageUrl: url }))}
              />
              <AuthFormField label="Texto alternativo de la imagen (accesibilidad)" name="pImageAlt"
                value={pageForm.imageAlt}
                onChange={(e) => setPageForm((p) => ({ ...p, imageAlt: e.target.value }))} />

              <div className="auth-field">
                <label className="auth-field__label">
                  Contenido
                  <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "0.5rem", fontSize: "0.78rem" }}>
                    Usa # para títulos de sección · Talla X — NN cm para tabla de tallas · - para listas
                  </span>
                </label>
                <textarea className="auth-field__input" rows={10} value={pageForm.body}
                  onChange={(e) => setPageForm((p) => ({ ...p, body: e.target.value }))} />
              </div>

              <div className="auth-field">
                <label className="auth-field__label">Título SEO <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "0.78rem" }}>(máx. 70 caracteres)</span></label>
                <input className="auth-field__input" maxLength={70} value={pageForm.seoTitle}
                  onChange={(e) => setPageForm((p) => ({ ...p, seoTitle: e.target.value }))} />
              </div>
              <div className="auth-field">
                <label className="auth-field__label">Descripción SEO <span style={{ fontWeight: 400, color: "var(--color-text-muted)", fontSize: "0.78rem" }}>(máx. 160 caracteres)</span></label>
                <textarea className="auth-field__input" rows={2} maxLength={160} value={pageForm.seoDescription}
                  onChange={(e) => setPageForm((p) => ({ ...p, seoDescription: e.target.value }))} />
              </div>

              <label className="admin-checkbox">
                <input type="checkbox" checked={pageForm.isPublished}
                  onChange={(e) => setPageForm((p) => ({ ...p, isPublished: e.target.checked }))} />
                Publicada
              </label>
              <label className="admin-checkbox">
                <input type="checkbox" checked={pageForm.showInFooter}
                  onChange={(e) => setPageForm((p) => ({ ...p, showInFooter: e.target.checked }))} />
                Mostrar en footer
              </label>
              <AuthSubmitButton loading={saving}>{editingPageId ? "Actualizar" : "Crear"}</AuthSubmitButton>
              {editingPageId && (
                <>
                  <button type="button" className="admin-btn" onClick={() => startEditPage(null)}>Cancelar</button>
                  <Link href={`/pagina/${pages.find((p) => p.id === editingPageId)?.slug || ""}`}
                    target="_blank" className="admin-btn">Ver en tienda</Link>
                </>
              )}
            </form>
          </section>
          <section className="taxonomy-list-card">
            <h2>Páginas</h2>
            <button type="button" className="admin-btn" style={{ marginBottom: "1rem" }}
              onClick={() => startEditPage(null)}>+ Nueva página</button>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Título</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id}>
                      <td>{p.title}<br /><span className="admin-muted">/pagina/{p.slug}</span></td>
                      <td>{p.isPublished ? "Publicada" : "Borrador"}</td>
                      <td className="admin-table__actions">
                        <button type="button" className="admin-btn admin-btn--sm" onClick={() => startEditPage(p.id)}>Editar</button>
                        <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => removePage(p.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ── POPUP ── */}
      {tab === "popup" && marketing && (
        <form className="admin-form product-form__section" onSubmit={saveMarketing}>
          <h2>Popup promocional</h2>
          <label className="admin-checkbox">
            <input type="checkbox" checked={Boolean(marketing.popup?.enabled)}
              onChange={(e) => setPopup("enabled", e.target.checked)} />
            Activar popup
          </label>
          <AuthFormField label="Título" name="popupTitle" value={marketing.popup?.title || ""}
            onChange={(e) => setPopup("title", e.target.value)} />
          <AuthFormField label="Texto" name="popupText" value={marketing.popup?.text || ""}
            onChange={(e) => setPopup("text", e.target.value)} />
          <AuthFormField label="Retraso (segundos)" name="delay" type="number"
            value={marketing.popup?.delaySeconds ?? 4}
            onChange={(e) => setPopup("delaySeconds", Number(e.target.value))} />
          <CmsImageField
            label="Imagen del popup (opcional)"
            value={marketing.popup?.imageUrl || ""}
            onChange={(url) => setPopup("imageUrl", url)}
          />

          <h2 style={{ marginTop: "1.5rem" }}>Newsletter (footer)</h2>
          <AuthFormField label="Título footer" name="nlTitle" value={marketing.newsletter?.footerTitle || ""}
            onChange={(e) => setNl("footerTitle", e.target.value)} />
          <AuthFormField label="Texto footer" name="nlText" value={marketing.newsletter?.footerText || ""}
            onChange={(e) => setNl("footerText", e.target.value)} />

          <h2 style={{ marginTop: "1.5rem" }}>Carrito abandonado</h2>
          <label className="admin-checkbox">
            <input type="checkbox" checked={Boolean(marketing.abandonedCart?.enabled)}
              onChange={(e) => setAbandoned("enabled", e.target.checked)} />
            Enviar recordatorios
          </label>
          <AuthFormField label="Horas antes del primer correo" name="delayHours" type="number"
            value={marketing.abandonedCart?.delayHours ?? 24}
            onChange={(e) => setAbandoned("delayHours", Number(e.target.value))} />
          <AuthFormField label="Máximo de recordatorios" name="maxReminders" type="number"
            value={marketing.abandonedCart?.maxReminders ?? 2}
            onChange={(e) => setAbandoned("maxReminders", Number(e.target.value))} />

          <AuthSubmitButton loading={saving}>Guardar configuración</AuthSubmitButton>
        </form>
      )}

      {/* ── NEWSLETTER ── */}
      {tab === "newsletter" && (
        <div className="marketing-admin__card">
          <p>{subscribers.length} suscriptores activos (últimos 50)</p>
          <table className="marketing-admin__table">
            <thead>
              <tr><th>Correo</th><th>Nombre</th><th>Fuente</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s._id}>
                  <td>{s.email}</td>
                  <td>{s.name || "—"}</td>
                  <td>{s.source}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CARRITOS ── */}
      {tab === "carritos" && (
        <div className="marketing-admin__card">
          <button type="button" className="admin-btn admin-btn--primary"
            onClick={handleSendReminders} disabled={saving} style={{ marginBottom: "1rem" }}>
            Enviar recordatorios pendientes
          </button>
          <table className="marketing-admin__table">
            <thead>
              <tr><th>Correo</th><th>Ítems</th><th>Subtotal</th><th>Recordatorios</th><th>Actualizado</th></tr>
            </thead>
            <tbody>
              {carts.map((c) => (
                <tr key={c._id}>
                  <td>{c.email}</td>
                  <td>{c.itemCount}</td>
                  <td>{formatCOP(c.subtotal)}</td>
                  <td>{c.remindersSent}</td>
                  <td>{new Date(c.updatedAt).toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── EXPORTAR ── */}
      {tab === "exports" && (
        <div className="marketing-admin__card">
          <div className="marketing-admin__exports">
            <button type="button" className="admin-btn" onClick={() => exportNewsletterCsv().catch(() => {})}>
              Exportar newsletter (CSV)
            </button>
            <button type="button" className="admin-btn" onClick={() => exportOrdersCsv().catch(() => {})}>
              Exportar pedidos (CSV)
            </button>
            <button type="button" className="admin-btn" onClick={() => exportAbandonedCartsCsv().catch(() => {})}>
              Exportar carritos (CSV)
            </button>
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", marginTop: "1rem" }}>
            Los archivos CSV se descargan en tu navegador. Máximo 5.000–10.000 registros por exportación.
          </p>
        </div>
      )}

      {/* ── APARIENCIA ── */}
      {tab === "appearance" && (
        <form className="admin-form product-form__section" onSubmit={saveAppearance}>
          <h2>Identidad del sitio</h2>
          <AuthFormField
            label="Nombre del sitio"
            name="siteName"
            value={appearance.siteName}
            placeholder="Dizor"
            onChange={(e) => setAppearanceField("siteName", e.target.value)}
          />
          <p className="admin-muted" style={{ marginTop: "-0.5rem" }}>
            Aparece en el título del navegador y en los resultados de Google.
          </p>

          <h2 style={{ marginTop: "1.5rem" }}>Colores</h2>
          <p className="admin-muted">
            Deja en blanco para usar el color por defecto del tema.
          </p>
          <ColorField
            label="Color principal (botones, precio, links)"
            value={appearance.primaryColor}
            onChange={(v) => setAppearanceField("primaryColor", v)}
          />
          <ColorField
            label="Color de acento (badges, ofertas)"
            value={appearance.accentColor}
            onChange={(v) => setAppearanceField("accentColor", v)}
          />
          <ColorField
            label="Color de fondo"
            value={appearance.bgColor}
            onChange={(v) => setAppearanceField("bgColor", v)}
          />

          <h2 style={{ marginTop: "1.5rem" }}>Favicon</h2>
          <CmsImageField
            label="Favicon"
            value={appearance.faviconUrl}
            onChange={(url) => setAppearanceField("faviconUrl", url)}
            placeholder="https://tudominio.com/favicon.ico"
          />
          <p className="admin-muted" style={{ marginTop: "-0.5rem" }}>
            Sube un PNG o ICO (16×16 a 64×64 px recomendado). Se aplica al abrir una nueva pestaña.
          </p>

          <AuthSubmitButton loading={saving}>Guardar apariencia</AuthSubmitButton>
        </form>
      )}
    </div>
  );
}

export default function AdminContenidoPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <ContenidoAdminContent />
      </AdminShell>
    </RoleRoute>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CONTENT_TABS, contentTab, contentHref } from "@/lib/adminNavigation.mjs";
import DataExports from "./DataExports";
import SettingsLoadState from "./SettingsLoadState";
import useConfirmedSettings from "@/hooks/useConfirmedSettings";
import { readMarketing, marketingPayload, validMarketing, readAppearance, validAppearance, readRows } from "@/lib/confirmedSettings.mjs";
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
} from "@/services/adminMarketingService";
import {
  getStoreSettings,
  updateStoreSettings,
} from "@/services/adminSettingsService";
import { getCoupons } from "@/services/adminCouponService";
import { formatCOP } from "@/lib/formatCurrency";
import HomeImagesTab from "@/components/admin/HomeImagesTab";
import HomeTextsTab from "@/components/admin/HomeTextsTab";
import ReviewsTab from "@/components/admin/ReviewsTab";
import { useFlashMessage } from "@/hooks/useFlashMessage";



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

const marketingOptions = { read: getMarketingSettings, write: updateMarketingSettings, parse: readMarketing, valid: validMarketing, payload: marketingPayload };
const appearanceOptions = { read: getStoreSettings, write: (appearance, config) => updateStoreSettings({ appearance }, config), parse: readAppearance, valid: validAppearance };
const subscribersOptions = { read: config => getNewsletterSubscribers({ limit: 50 }, config), parse: readRows("subscribers") };
const cartsOptions = { read: config => getAbandonedCarts({ limit: 30 }, config), parse: readRows("carts") };
const couponsOptions = { read: () => getCoupons(), parse: readRows("coupons", false) };

function ColorField({ label, value, onChange }) {
  return (
    <div className="appearance-color-field">
      <label className="auth-field__label">{label}</label>
      <div className="appearance-color-row">
        <input
          type="color"
          value={value || "#1A1A1A"}
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
            loading="lazy"
            decoding="async"
            style={{ maxWidth: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 6, border: "1px solid var(--color-border)" }}
          />
        </div>
      )}
    </div>
  );
}

function ContenidoAdminContent({ defaultTab = "home" }) {
  const searchParams = useSearchParams();
  const selected = contentTab(searchParams.get("tab"), defaultTab);
  const tab = selected.id, area = selected.area;
  const scope = ["orders", "newsletter", "carts"].includes(searchParams.get("scope")) ? searchParams.get("scope") : "all";

  // CMS state
  const [home, setHome] = useState(null);

  const [pages, setPages] = useState([]);
  const [banners, setBanners] = useState([]);
  const [pageForm, setPageForm] = useState(emptyPage());
  const [editingPageId, setEditingPageId] = useState(null);
  const [bannerForm, setBannerForm] = useState(emptyBanner());
  const [editingBannerId, setEditingBannerId] = useState(null);

  // Marketing state
  const marketingState = useConfirmedSettings(marketingOptions);
  const subscribersState = useConfirmedSettings(subscribersOptions);
  const cartsState = useConfirmedSettings(cartsOptions);
  const couponsState = useConfirmedSettings(couponsOptions);
  const marketing = marketingState.value, setMarketing = marketingState.resource.edit;
  const subscribers = subscribersState.value, carts = cartsState.value, coupons = couponsState.value || [];

  // Appearance state
  const appearanceState = useConfirmedSettings(appearanceOptions);
  const appearance = appearanceState.value, setAppearance = appearanceState.resource.edit;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const { message, error, flashKey, showMsg, clearMsg } = useFlashMessage();

  const load = async () => {
    setLoading(true);
    clearMsg();
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

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── CMS handlers ──────────────────────────────────────
  const cleanBullets = (bullets) =>
    (bullets || [])
      .map((line) => String(line).trim())
      .filter(Boolean)
      .slice(0, 5);

  const saveHome = async (e) => {
    e.preventDefault();
    setSaving(true);
    clearMsg();
    try {
      const payload = {
        ...home,
        personalizacion: {
          ...(home.personalizacion || {}),
          bullets: cleanBullets(home.personalizacion?.bullets),
        },
        porMayor: {
          ...(home.porMayor || {}),
          bullets: cleanBullets(home.porMayor?.bullets),
        },
      };
      const data = await updateAdminHomeContent(payload);
      setHome(data.home);
      showMsg("Inicio guardado");
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al guardar", true);
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () =>
    setHome((h) => {
      const current = h.features || [];
      if (current.length >= 4) return h;
      return {
        ...h,
        features: [...current, { title: "", text: "" }],
      };
    });

  const updateFeature = (i, key, value) =>
    setHome((h) => {
      const features = [...h.features];
      features[i] = { ...features[i], [key]: value };
      return { ...h, features };
    });

  const removeFeature = (i) =>
    setHome((h) => ({ ...h, features: h.features.filter((_, idx) => idx !== i) }));

  const addAnnouncement = () =>
    setHome((h) => {
      const current = h.announcement?.items || [];
      if (current.length >= 3) return h;
      return {
        ...h,
        announcement: {
          ...h.announcement,
          items: [...current, { text: "", linkHref: "" }],
        },
      };
    });

  const updateAnnouncement = (i, key, value) =>
    setHome((h) => {
      const items = [...(h.announcement?.items || [])];
      items[i] = { ...items[i], [key]: value };
      return { ...h, announcement: { ...h.announcement, items } };
    });

  const removeAnnouncement = (i) =>
    setHome((h) => ({
      ...h,
      announcement: {
        ...h.announcement,
        items: (h.announcement?.items || []).filter((_, idx) => idx !== i),
      },
    }));

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
    clearMsg();
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
    clearMsg();
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
    setMarketing((s) => ({ ...s, popup: { ...s.popup, [key]: value } }));
  const setNl = (key, value) =>
    setMarketing((s) => ({ ...s, newsletter: { ...s.newsletter, [key]: value } }));
  const setAbandoned = (key, value) =>
    setMarketing((s) => ({ ...s, abandonedCart: { ...s.abandonedCart, [key]: value } }));

  const saveMarketing = async (e) => { e.preventDefault(); await marketingState.resource.save(); };

  const handleSendReminders = async () => {
    if (!marketingState.resource.canEdit() || !marketing?.abandonedCart?.featureEnabled) return;
    setSaving(true);
    try {
      const data = await sendAbandonedReminders();
      showMsg(data.message || "Recordatorios procesados");
      await cartsState.resource.load();
    } catch (err) {
      showMsg(err.response?.data?.message || "Error al enviar", true);
    } finally {
      setSaving(false);
    }
  };

  // ── Appearance handler ────────────────────────────────
  const saveAppearance = async (e) => { e.preventDefault(); await appearanceState.resource.save(); };

  const setAppearanceField = (key, value) =>
    setAppearance((a) => ({ ...a, [key]: value }));

  if (loading && ["home", "banners", "pages"].includes(tab)) return <p className="auth-loading" role="status">Cargando…</p>;

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">{area === "store" ? "Tienda online" : area === "marketing" ? "Marketing" : ({ orders: "Exportaciones de pedidos", newsletter: "Exportaciones de newsletter", carts: "Exportaciones de carritos", all: "Exportaciones históricas" })[scope]}</h1>
      <p className="admin-page__subtitle">
        {area === "store" ? "Presentación y contenido editorial de la tienda." : area === "marketing" ? "Cupones, popup y suscripciones. Las herramientas desactivadas conservan su estado." : "Herramientas existentes con sus permisos originales."}
      </p>

      <nav className="cms-tabs" aria-label={area === "store" ? "Secciones de Tienda online" : "Secciones de Marketing"}>
        {area === "marketing" && <Link href="/admin/cupones">Cupones</Link>}
        {CONTENT_TABS.filter(t => t.area === area).map(t => <Link key={t.id} href={contentHref(t.id, searchParams.toString())} className={tab === t.id ? "active" : ""} aria-current={tab === t.id ? "page" : undefined}>{t.label}</Link>)}
        {area === "tools" && <><Link href="/admin/pedidos">Pedidos</Link><Link href="/admin/marketing?tab=newsletter">Newsletter</Link><Link href="/admin/marketing?tab=carritos">Carritos</Link></>}
      </nav>

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

      {/* ── INICIO ── */}
      {tab === "home" && home && (
        <HomeTextsTab
          home={home}
          setHome={setHome}
          saving={saving}
          onSave={saveHome}
          addFeature={addFeature}
          updateFeature={updateFeature}
          removeFeature={removeFeature}
          addAnnouncement={addAnnouncement}
          updateAnnouncement={updateAnnouncement}
          removeAnnouncement={removeAnnouncement}
        />
      )}

      {/* ── IMÁGENES HOME ── */}
      {tab === "imagenes" && <HomeImagesTab />}

      {/* ── RESEÑAS ── */}
      {tab === "resenas" && <ReviewsTab />}

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
            <p className="image-upload-hint" style={{ marginBottom: "1rem" }}>
              Puedes crear varias páginas (nosotros, envíos, cambios…).
              La URL se genera sola desde el título:{" "}
              <code>/pagina/tu-titulo</code>. Márcala como publicada y, si
              quieres, “Mostrar en footer”. La guía de tallas se edita en el
              código, no aquí.
            </p>
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
                    Usa # para títulos de sección · Talla X — NN cm para tabla · - para listas
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

      {["popup", "carritos"].includes(tab) && <SettingsLoadState state={marketingState} label="configuración de marketing" />}
      {/* ── POPUP ── */}
      {tab === "popup" && marketing && (
        <form className="admin-form product-form__section" onSubmit={saveMarketing}>
          <fieldset disabled={!marketingState.resource.canEdit()} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <h2>Popup promocional</h2>
          <label className="admin-checkbox">
            <input type="checkbox" checked={Boolean(marketing.popup?.enabled)}
              onChange={(e) => setPopup("enabled", e.target.checked)} />
            Activar popup
          </label>

          <fieldset className="admin-radio-group" style={{ margin: "1rem 0" }}>
            <legend>Contenido del popup (solo uno se publica)</legend>
            <label className="admin-radio">
              <input type="radio" name="popupVariant" value="newsletter"
                checked={(marketing.popup?.variant || "newsletter") === "newsletter"}
                onChange={() => setPopup("variant", "newsletter")} />
              Suscripción por correo
            </label>
            <label className="admin-radio">
              <input type="radio" name="popupVariant" value="coupon"
                checked={marketing.popup?.variant === "coupon"}
                onChange={() => setPopup("variant", "coupon")} />
              Cupón de descuento
            </label>
            <label className="admin-radio">
              <input type="radio" name="popupVariant" value="info"
                checked={marketing.popup?.variant === "info"}
                onChange={() => setPopup("variant", "info")} />
              Información / anuncio
            </label>
          </fieldset>

          <AuthFormField label="Título" name="popupTitle" value={marketing.popup?.title || ""}
            onChange={(e) => setPopup("title", e.target.value)} />
          <AuthFormField label="Texto" name="popupText" value={marketing.popup?.text || ""}
            onChange={(e) => setPopup("text", e.target.value)} />

          {marketing.popup?.variant === "coupon" && (
            <div className="admin-form-field">
              <SettingsLoadState state={couponsState} label="cupones disponibles" editable={false} />
              <label htmlFor="popupCoupon">Cupón a mostrar</label>
              <select id="popupCoupon" disabled={couponsState.status !== "ready"} value={marketing.popup?.couponCode || ""}
                onChange={(e) => setPopup("couponCode", e.target.value)}>
                <option value="">— Selecciona un cupón —</option>
                {marketing.popup.couponCode && !coupons.some(c => c.code === marketing.popup.couponCode) && <option value={marketing.popup.couponCode}>{marketing.popup.couponCode} (valor guardado)</option>}
                {coupons.filter((c) => c.isActive).map((c) => (
                  <option key={c._id} value={c.code}>
                    {c.code} ({c.type === "percentage" ? `${c.value}%` : formatCOP(c.value)})
                  </option>
                ))}
              </select>
              {couponsState.status === "ready" && coupons.filter((c) => c.isActive).length === 0 && (
                <p className="admin-muted">No hay cupones activos. Crea uno en la sección Cupones.</p>
              )}
            </div>
          )}

          {marketing.popup?.variant === "info" && (
            <>
              <AuthFormField label="Texto del botón (opcional)" name="popupCtaLabel"
                value={marketing.popup?.ctaLabel || ""}
                onChange={(e) => setPopup("ctaLabel", e.target.value)} />
              <AuthFormField label="Enlace del botón (opcional)" name="popupCtaHref"
                value={marketing.popup?.ctaHref || ""}
                onChange={(e) => setPopup("ctaHref", e.target.value)} />
            </>
          )}

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
          {!marketing.abandonedCart?.featureEnabled && (
            <p className="admin-muted">
              Los recordatorios están desactivados. Se conserva la configuración histórica; no se muestran formularios ni se envían recordatorios.
            </p>
          )}
          <label className="admin-checkbox">
            <input type="checkbox" disabled={!marketing.abandonedCart?.featureEnabled} checked={Boolean(marketing.abandonedCart?.enabled)}
              onChange={(e) => setAbandoned("enabled", e.target.checked)} />
            Enviar recordatorios
          </label>
          <AuthFormField disabled={!marketing.abandonedCart?.featureEnabled} label="Horas antes del primer correo" name="delayHours" type="number"
            value={marketing.abandonedCart?.delayHours ?? 24}
            onChange={(e) => setAbandoned("delayHours", Number(e.target.value))} />
          <AuthFormField disabled={!marketing.abandonedCart?.featureEnabled} label="Máximo de recordatorios" name="maxReminders" type="number"
            value={marketing.abandonedCart?.maxReminders ?? 2}
            onChange={(e) => setAbandoned("maxReminders", Number(e.target.value))} />

          <AuthSubmitButton loading={marketingState.status === "saving"} disabled={!marketingState.resource.canSave()}>Guardar configuración</AuthSubmitButton>
          </fieldset>
        </form>
      )}

      {/* ── NEWSLETTER ── */}
      {tab === "newsletter" && (
        <div className="marketing-admin__card">
          <DataExports scope="newsletter" embedded />
          <SettingsLoadState state={subscribersState} label="suscriptores" editable={false} />
          {subscribers !== null && <>
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
          </>}
        </div>
      )}

      {/* ── CARRITOS ── */}
      {tab === "carritos" && (
        <div className="marketing-admin__card">
          {marketing?.abandonedCart?.featureEnabled === false && <p role="status">Recordatorios desactivados. La consulta histórica y la exportación siguen disponibles; no se enviarán recordatorios.</p>}
          <DataExports scope="carts" embedded />
          <SettingsLoadState state={cartsState} label="carritos" editable={false} />
          <button type="button" className="admin-btn admin-btn--primary"
            onClick={handleSendReminders}
            disabled={saving || !marketingState.resource.canEdit() || !marketing?.abandonedCart?.featureEnabled}
            style={{ marginBottom: "1rem" }}>
            Enviar recordatorios pendientes
          </button>
          {carts !== null && <table className="marketing-admin__table">
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
          </table>}
        </div>
      )}

      {/* ── EXPORTAR ── */}
      {tab === "exports" && <DataExports scope={scope} />}

      {/* ── APARIENCIA ── */}
      {tab === "appearance" && <SettingsLoadState state={appearanceState} label="apariencia" />}
      {tab === "appearance" && appearance && (
        <form className="admin-form product-form__section" onSubmit={saveAppearance}>
          <fieldset disabled={!appearanceState.resource.canEdit()} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
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
            También se usa como texto de respaldo del navbar si el logo no carga.
          </p>

          <h2 style={{ marginTop: "1.5rem" }}>Logo del navbar</h2>
          <CmsImageField
            label="Logo horizontal"
            value={appearance.logoUrl}
            onChange={(url) => setAppearanceField("logoUrl", url)}
            placeholder="https://res.cloudinary.com/…/logo-dizor-horizontal.png"
          />
          <p className="admin-muted" style={{ marginTop: "-0.5rem" }}>
            PNG horizontal (fondo blanco o transparente), el navbar es claro.
            Vacío = usa el archivo{" "}
            <code>/images/logo-dizor-horizontal.png</code> del proyecto y, si
            tampoco existe, muestra el nombre del sitio en texto.
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

          <AuthSubmitButton loading={appearanceState.status === "saving"} disabled={!appearanceState.resource.canSave()}>Guardar apariencia</AuthSubmitButton>
          </fieldset>
        </form>
      )}
    </div>
  );
}

export default function ContentWorkspace({ defaultTab = "home" }) {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <Suspense fallback={<p className="auth-loading">Cargando…</p>}>
          <ContenidoAdminContent defaultTab={defaultTab} />
        </Suspense>
      </AdminShell>
    </RoleRoute>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
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
} from "@/services/adminCmsService";

const TABS = [
  { id: "home", label: "Inicio" },
  { id: "banners", label: "Banners" },
  { id: "pages", label: "Páginas" },
];

const emptyPage = () => ({
  title: "",
  excerpt: "",
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

function CmsAdminContent() {
  const [tab, setTab] = useState("home");
  const [home, setHome] = useState(null);
  const [pages, setPages] = useState([]);
  const [banners, setBanners] = useState([]);
  const [pageForm, setPageForm] = useState(emptyPage());
  const [editingPageId, setEditingPageId] = useState(null);
  const [bannerForm, setBannerForm] = useState(emptyBanner());
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
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
      setMessage("Error al cargar contenido");
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveHome = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      const data = await updateAdminHomeContent(home);
      setHome(data.home);
      setMessage("Inicio guardado");
    } catch (err) {
      setMessage(err.response?.data?.message || "Error al guardar");
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    setHome((h) => ({
      ...h,
      features: [...(h.features || []), { title: "", text: "" }],
    }));
  };

  const updateFeature = (index, key, value) => {
    setHome((h) => {
      const features = [...h.features];
      features[index] = { ...features[index], [key]: value };
      return { ...h, features };
    });
  };

  const removeFeature = (index) => {
    setHome((h) => ({
      ...h,
      features: h.features.filter((_, i) => i !== index),
    }));
  };

  const startEditPage = async (id) => {
    if (!id) {
      setEditingPageId(null);
      setPageForm(emptyPage());
      return;
    }
    const data = await getAdminPage(id);
    setEditingPageId(id);
    setPageForm({
      title: data.page.title,
      excerpt: data.page.excerpt || "",
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
      if (editingPageId) {
        await updateAdminPage(editingPageId, pageForm);
      } else {
        await createAdminPage(pageForm);
      }
      setMessage("Página guardada");
      setEditingPageId(null);
      setPageForm(emptyPage());
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || "Error al guardar página");
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const removePage = async (id) => {
    if (!window.confirm("¿Eliminar esta página?")) return;
    await deleteAdminPage(id);
    if (editingPageId === id) startEditPage(null);
    await load();
  };

  const startEditBanner = (banner) => {
    if (!banner) {
      setEditingBannerId(null);
      setBannerForm(emptyBanner());
      return;
    }
    setEditingBannerId(banner.id);
    setBannerForm({ ...banner });
  };

  const saveBanner = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError(false);
    try {
      if (editingBannerId) {
        await updateAdminBanner(editingBannerId, bannerForm);
      } else {
        await createAdminBanner(bannerForm);
      }
      setMessage("Banner guardado");
      startEditBanner(null);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || "Error al guardar banner");
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async (id) => {
    if (!window.confirm("¿Eliminar banner?")) return;
    await deleteAdminBanner(id);
    if (editingBannerId === id) startEditBanner(null);
    await load();
  };

  if (loading) {
    return <p className="auth-loading">Cargando CMS…</p>;
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">Contenido (CMS)</h1>
      <p className="admin-page__subtitle">
        Edita el inicio, banners promocionales y páginas informativas.
      </p>

      <nav className="cms-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <AuthErrorAlert message={message} variant={error ? "error" : "success"} />

      {tab === "home" && home && (
        <form className="admin-form product-form__section" onSubmit={saveHome}>
          <h2>Hero</h2>
          <AuthFormField
            label="Título"
            name="heroTitle"
            value={home.hero.title}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, title: e.target.value },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Subtítulo</label>
            <textarea
              className="auth-field__input"
              rows={3}
              value={home.hero.subtitle}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  hero: { ...h.hero, subtitle: e.target.value },
                }))
              }
            />
          </div>
          <AuthFormField
            label="Texto botón"
            name="ctaLabel"
            value={home.hero.ctaLabel}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, ctaLabel: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Enlace botón"
            name="ctaHref"
            value={home.hero.ctaHref}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, ctaHref: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Imagen de fondo (URL)"
            name="heroImage"
            value={home.hero.imageUrl || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, imageUrl: e.target.value },
              }))
            }
          />

          <h2>Barra de anuncio</h2>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={home.announcement.isActive}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  announcement: {
                    ...h.announcement,
                    isActive: e.target.checked,
                  },
                }))
              }
            />
            Mostrar barra superior
          </label>
          <AuthFormField
            label="Texto anuncio"
            name="announceText"
            value={home.announcement.text}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                announcement: { ...h.announcement, text: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Enlace anuncio"
            name="announceLink"
            value={home.announcement.linkHref}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                announcement: { ...h.announcement, linkHref: e.target.value },
              }))
            }
          />

          <h2>Sección destacados</h2>
          <AuthFormField
            label="Título"
            name="featTitle"
            value={home.featuredSection.title}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                featuredSection: {
                  ...h.featuredSection,
                  title: e.target.value,
                },
              }))
            }
          />

          <h2>Bloques informativos</h2>
          {home.features.map((f, i) => (
            <div key={i} className="cms-feature-row">
              <AuthFormField
                label="Título"
                name={`ft-${i}`}
                value={f.title}
                onChange={(e) => updateFeature(i, "title", e.target.value)}
              />
              <AuthFormField
                label="Texto"
                name={`fx-${i}`}
                value={f.text}
                onChange={(e) => updateFeature(i, "text", e.target.value)}
              />
              <button
                type="button"
                className="admin-btn admin-btn--sm admin-btn--danger"
                onClick={() => removeFeature(i)}
              >
                Quitar
              </button>
            </div>
          ))}
          <button type="button" className="admin-btn" onClick={addFeature}>
            + Bloque
          </button>

          <AuthSubmitButton loading={saving}>Guardar inicio</AuthSubmitButton>
        </form>
      )}

      {tab === "banners" && (
        <div className="admin-grid-2">
          <section className="taxonomy-form-card">
            <h2>{editingBannerId ? "Editar banner" : "Nuevo banner"}</h2>
            <form className="admin-form" onSubmit={saveBanner}>
              <AuthFormField
                label="Título"
                name="bTitle"
                value={bannerForm.title}
                onChange={(e) =>
                  setBannerForm((p) => ({ ...p, title: e.target.value }))
                }
                required
              />
              <AuthFormField
                label="Subtítulo"
                name="bSub"
                value={bannerForm.subtitle}
                onChange={(e) =>
                  setBannerForm((p) => ({ ...p, subtitle: e.target.value }))
                }
              />
              <AuthFormField
                label="Imagen URL"
                name="bImg"
                value={bannerForm.imageUrl}
                onChange={(e) =>
                  setBannerForm((p) => ({ ...p, imageUrl: e.target.value }))
                }
              />
              <AuthFormField
                label="Enlace"
                name="bLink"
                value={bannerForm.linkHref}
                onChange={(e) =>
                  setBannerForm((p) => ({ ...p, linkHref: e.target.value }))
                }
              />
              <div className="admin-form__group">
                <label htmlFor="placement">Ubicación</label>
                <select
                  id="placement"
                  value={bannerForm.placement}
                  onChange={(e) =>
                    setBannerForm((p) => ({ ...p, placement: e.target.value }))
                  }
                >
                  <option value="home_mid">Inicio (medio)</option>
                  <option value="catalog_top">Catálogo (arriba)</option>
                </select>
              </div>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={bannerForm.isActive}
                  onChange={(e) =>
                    setBannerForm((p) => ({ ...p, isActive: e.target.checked }))
                  }
                />
                Activo
              </label>
              <AuthSubmitButton loading={saving}>
                {editingBannerId ? "Actualizar" : "Crear"}
              </AuthSubmitButton>
              {editingBannerId && (
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => startEditBanner(null)}
                >
                  Cancelar
                </button>
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
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    onClick={() => startEditBanner(b)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--danger"
                    onClick={() => removeBanner(b.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "pages" && (
        <div className="admin-grid-2">
          <section className="taxonomy-form-card">
            <h2>{editingPageId ? "Editar página" : "Nueva página"}</h2>
            <form className="admin-form" onSubmit={savePage}>
              <AuthFormField
                label="Título"
                name="pTitle"
                value={pageForm.title}
                onChange={(e) =>
                  setPageForm((p) => ({ ...p, title: e.target.value }))
                }
                required
              />
              <AuthFormField
                label="Extracto"
                name="pExcerpt"
                value={pageForm.excerpt}
                onChange={(e) =>
                  setPageForm((p) => ({ ...p, excerpt: e.target.value }))
                }
              />
              <div className="auth-field">
                <label className="auth-field__label">Contenido</label>
                <textarea
                  className="auth-field__input"
                  rows={8}
                  value={pageForm.body}
                  onChange={(e) =>
                    setPageForm((p) => ({ ...p, body: e.target.value }))
                  }
                />
              </div>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={pageForm.isPublished}
                  onChange={(e) =>
                    setPageForm((p) => ({
                      ...p,
                      isPublished: e.target.checked,
                    }))
                  }
                />
                Publicada
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={pageForm.showInFooter}
                  onChange={(e) =>
                    setPageForm((p) => ({
                      ...p,
                      showInFooter: e.target.checked,
                    }))
                  }
                />
                Mostrar en footer
              </label>
              <AuthSubmitButton loading={saving}>
                {editingPageId ? "Actualizar" : "Crear"}
              </AuthSubmitButton>
              {editingPageId && (
                <>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => startEditPage(null)}
                  >
                    Cancelar
                  </button>
                  <Link
                    href={`/pagina/${pages.find((p) => p.id === editingPageId)?.slug || ""}`}
                    target="_blank"
                    className="admin-btn"
                  >
                    Ver en tienda
                  </Link>
                </>
              )}
            </form>
          </section>
          <section className="taxonomy-list-card">
            <h2>Páginas</h2>
            <button
              type="button"
              className="admin-btn"
              style={{ marginBottom: "1rem" }}
              onClick={() => startEditPage(null)}
            >
              + Nueva página
            </button>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.title}
                        <br />
                        <span className="admin-muted">/pagina/{p.slug}</span>
                      </td>
                      <td>{p.isPublished ? "Publicada" : "Borrador"}</td>
                      <td className="admin-table__actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm"
                          onClick={() => startEditPage(p.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm admin-btn--danger"
                          onClick={() => removePage(p.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function AdminContenidoPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <CmsAdminContent />
      </AdminShell>
    </RoleRoute>
  );
}

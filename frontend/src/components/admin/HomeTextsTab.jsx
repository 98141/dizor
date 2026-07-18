"use client";

import { useState } from "react";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";

const MAX_BULLETS = 5;
const MAX_FEATURES = 4;

/** Keep empty lines while typing so Enter can open a new bullet line. */
const parseBullets = (raw) => String(raw ?? "").split("\n").slice(0, MAX_BULLETS);

const filledBulletCount = (bullets) =>
  (bullets || []).filter((line) => String(line).trim()).length;

const SECTIONS = [
  {
    id: "hero",
    label: "Hero",
    hint: "Marca, título, subtítulo y 2 CTAs del primer viewport. Imagen: pestaña Imágenes → Hero (1 principal).",
  },
  {
    id: "anuncio",
    label: "Anuncio",
    hint: "Barra superior opcional del sitio (texto + enlace).",
  },
  {
    id: "beneficios",
    label: "Beneficios",
    hint: `Bloques de valor bajo el hero. Máximo ${MAX_FEATURES} ítems (título + texto corto).`,
  },
  {
    id: "colecciones",
    label: "Colecciones",
    hint: "Textos de la sección tejidos/colecciones. Imágenes de tarjetas: pestaña Imágenes → Colecciones.",
  },
  {
    id: "historia",
    label: "Historia",
    hint: "Bloque origen / historia. Imagen: pestaña Imágenes → Historia.",
  },
  {
    id: "personalizacion",
    label: "Personalización",
    hint: `Texto + hasta ${MAX_BULLETS} bullets. CTA a /personalizar. Imagen: pestaña Imágenes → Personalización.`,
  },
  {
    id: "pormayor",
    label: "Por mayor",
    hint: `Debajo del mosaico de Inspiración. Hasta ${MAX_BULLETS} bullets. CTA a /pedido-mayor. Imagen: Imágenes → Por mayor.`,
  },
  {
    id: "voces",
    label: "Voces",
    hint: "Títulos de la sección de reseñas en el home (moderación en pestaña Reseñas).",
  },
  {
    id: "seleccion",
    label: "Selección",
    hint: "Textos del carrusel de productos aleatorios (máx. 10, renovados cada 24 h).",
  },
  {
    id: "inspiracion",
    label: "Inspiración",
    hint: "Textos + Instagram. Mosaico: pestaña Imágenes → Inspiración (máx. 5 fotos).",
  },
  {
    id: "newsletter",
    label: "Newsletter",
    hint: "Textos del bloque de suscripción al final del home.",
  },
];

export default function HomeTextsTab({
  home,
  setHome,
  saving,
  onSave,
  addFeature,
  updateFeature,
  removeFeature,
}) {
  const [section, setSection] = useState("hero");
  const meta = SECTIONS.find((s) => s.id === section);

  return (
    <form className="admin-form product-form__section" onSubmit={onSave}>
      <p className="admin-page__subtitle">
        Edita los textos de cada sección del home. Las imágenes se gestionan en
        la pestaña <strong>Imágenes</strong>.
      </p>

      <nav className="cms-tabs" style={{ marginBottom: "1rem" }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={section === s.id ? "active" : ""}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
        {meta?.hint}
      </p>

      {section === "hero" && (
        <>
          <h2>Hero</h2>
          <AuthFormField
            label="Marca / claim"
            name="brandClaim"
            value={home.hero?.brandClaim || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, brandClaim: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="heroTitle"
            value={home.hero?.title || ""}
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
              value={home.hero?.subtitle || ""}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  hero: { ...h.hero, subtitle: e.target.value },
                }))
              }
            />
          </div>
          <AuthFormField
            label="CTA principal"
            name="ctaLabel"
            value={home.hero?.ctaLabel || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, ctaLabel: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Enlace CTA principal"
            name="ctaHref"
            value={home.hero?.ctaHref || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, ctaHref: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="CTA secundario"
            name="secCta"
            value={home.hero?.secondaryCtaLabel || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, secondaryCtaLabel: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Enlace CTA secundario"
            name="secHref"
            value={home.hero?.secondaryCtaHref || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                hero: { ...h.hero, secondaryCtaHref: e.target.value },
              }))
            }
          />
        </>
      )}

      {section === "anuncio" && (
        <>
          <h2>Barra de anuncio</h2>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={!!home.announcement?.isActive}
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
            value={home.announcement?.text || ""}
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
            value={home.announcement?.linkHref || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                announcement: { ...h.announcement, linkHref: e.target.value },
              }))
            }
          />
        </>
      )}

      {section === "beneficios" && (
        <>
          <h2>
            Beneficios ({(home.features || []).length}/{MAX_FEATURES})
          </h2>
          {(home.features || []).map((f, i) => (
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
              <div className="cms-feature-row__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--sm admin-btn--danger"
                  onClick={() => removeFeature(i)}
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
          <div className="cms-section-actions">
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--block"
              onClick={addFeature}
              disabled={(home.features || []).length >= MAX_FEATURES}
            >
              + Agregar bloque
            </button>
          </div>
        </>
      )}

      {section === "colecciones" && (
        <>
          <h2>Colecciones / tejidos</h2>
          <AuthFormField
            label="Eyebrow"
            name="craftEyebrow"
            value={home.craftSection?.eyebrow || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                craftSection: { ...h.craftSection, eyebrow: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="craftTitle"
            value={home.craftSection?.title || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                craftSection: { ...h.craftSection, title: e.target.value },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Subtítulo</label>
            <textarea
              className="auth-field__input"
              rows={2}
              value={home.craftSection?.subtitle || ""}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  craftSection: {
                    ...h.craftSection,
                    subtitle: e.target.value,
                  },
                }))
              }
            />
          </div>
          <AuthFormField
            label="Texto enlace en tarjetas"
            name="craftLink"
            value={home.craftSection?.linkLabel || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                craftSection: { ...h.craftSection, linkLabel: e.target.value },
              }))
            }
          />
        </>
      )}

      {section === "historia" && (
        <>
          <h2>Historia</h2>
          <AuthFormField
            label="Eyebrow"
            name="histEyebrow"
            value={home.historia?.eyebrow || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                historia: { ...h.historia, eyebrow: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="histTitle"
            value={home.historia?.title || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                historia: { ...h.historia, title: e.target.value },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Texto</label>
            <textarea
              className="auth-field__input"
              rows={4}
              value={home.historia?.body || ""}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  historia: { ...h.historia, body: e.target.value },
                }))
              }
            />
          </div>
          <AuthFormField
            label="CTA"
            name="histCta"
            value={home.historia?.ctaLabel || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                historia: { ...h.historia, ctaLabel: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Enlace CTA"
            name="histHref"
            value={home.historia?.ctaHref || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                historia: { ...h.historia, ctaHref: e.target.value },
              }))
            }
          />
        </>
      )}

      {section === "personalizacion" && (
        <>
          <h2>Personalización</h2>
          <AuthFormField
            label="Eyebrow"
            name="persEyebrow"
            value={home.personalizacion?.eyebrow || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                personalizacion: {
                  ...(h.personalizacion || {}),
                  eyebrow: e.target.value,
                },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="persTitle"
            value={home.personalizacion?.title || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                personalizacion: {
                  ...(h.personalizacion || {}),
                  title: e.target.value,
                },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Texto</label>
            <textarea
              className="auth-field__input"
              rows={3}
              value={home.personalizacion?.body || ""}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  personalizacion: {
                    ...(h.personalizacion || {}),
                    body: e.target.value,
                  },
                }))
              }
            />
          </div>
          <div className="auth-field">
            <label className="auth-field__label">
              Bullets (uno por línea, máx. {MAX_BULLETS}) ·{" "}
              {filledBulletCount(home.personalizacion?.bullets)}/{MAX_BULLETS}
            </label>
            <textarea
              className="auth-field__input"
              rows={5}
              value={(home.personalizacion?.bullets || []).join("\n")}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  personalizacion: {
                    ...(h.personalizacion || {}),
                    bullets: parseBullets(e.target.value),
                  },
                }))
              }
            />
          </div>
          <AuthFormField
            label="CTA"
            name="persCta"
            value={home.personalizacion?.ctaLabel || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                personalizacion: {
                  ...(h.personalizacion || {}),
                  ctaLabel: e.target.value,
                },
              }))
            }
          />
          <AuthFormField
            label="Enlace CTA"
            name="persHref"
            value={home.personalizacion?.ctaHref || "/personalizar"}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                personalizacion: {
                  ...(h.personalizacion || {}),
                  ctaHref: e.target.value,
                },
              }))
            }
          />
          <AuthFormField
            label="Texto WhatsApp"
            name="persWa"
            value={home.personalizacion?.whatsappHint || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                personalizacion: {
                  ...(h.personalizacion || {}),
                  whatsappHint: e.target.value,
                },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Posición de la imagen</label>
            <select
              className="auth-field__input"
              value={
                home.personalizacion?.imageOnLeft === false ? "right" : "left"
              }
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  personalizacion: {
                    ...(h.personalizacion || {}),
                    imageOnLeft: e.target.value === "left",
                  },
                }))
              }
            >
              <option value="left">Izquierda (texto a la derecha)</option>
              <option value="right">Derecha (texto a la izquierda)</option>
            </select>
          </div>
        </>
      )}

      {section === "pormayor" && (
        <>
          <h2>Pedido al por mayor</h2>
          <AuthFormField
            label="Eyebrow"
            name="mayorEyebrow"
            value={home.porMayor?.eyebrow || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                porMayor: { ...(h.porMayor || {}), eyebrow: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="mayorTitle"
            value={home.porMayor?.title || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                porMayor: { ...(h.porMayor || {}), title: e.target.value },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Texto</label>
            <textarea
              className="auth-field__input"
              rows={3}
              value={home.porMayor?.body || ""}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  porMayor: { ...(h.porMayor || {}), body: e.target.value },
                }))
              }
            />
          </div>
          <div className="auth-field">
            <label className="auth-field__label">
              Bullets (uno por línea, máx. {MAX_BULLETS}) ·{" "}
              {filledBulletCount(home.porMayor?.bullets)}/{MAX_BULLETS}
            </label>
            <textarea
              className="auth-field__input"
              rows={5}
              value={(home.porMayor?.bullets || []).join("\n")}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  porMayor: {
                    ...(h.porMayor || {}),
                    bullets: parseBullets(e.target.value),
                  },
                }))
              }
            />
          </div>
          <AuthFormField
            label="CTA"
            name="mayorCta"
            value={home.porMayor?.ctaLabel || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                porMayor: { ...(h.porMayor || {}), ctaLabel: e.target.value },
              }))
            }
          />
          <AuthFormField
            label="Enlace CTA"
            name="mayorHref"
            value={home.porMayor?.ctaHref || "/pedido-mayor"}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                porMayor: { ...(h.porMayor || {}), ctaHref: e.target.value },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Posición de la imagen</label>
            <select
              className="auth-field__input"
              value={home.porMayor?.imageOnLeft === false ? "right" : "left"}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  porMayor: {
                    ...(h.porMayor || {}),
                    imageOnLeft: e.target.value === "left",
                  },
                }))
              }
            >
              <option value="left">Izquierda (texto a la derecha)</option>
              <option value="right">Derecha (texto a la izquierda)</option>
            </select>
          </div>
        </>
      )}

      {section === "voces" && (
        <>
          <h2>Voces / reseñas</h2>
          <AuthFormField
            label="Eyebrow"
            name="revEyebrow"
            value={home.reseñasSection?.eyebrow || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                reseñasSection: {
                  ...(h.reseñasSection || {}),
                  eyebrow: e.target.value,
                },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="revTitle"
            value={home.reseñasSection?.title || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                reseñasSection: {
                  ...(h.reseñasSection || {}),
                  title: e.target.value,
                },
              }))
            }
          />
        </>
      )}

      {section === "seleccion" && (
        <>
          <h2>Selección del día</h2>
          <AuthFormField
            label="Eyebrow"
            name="randEyebrow"
            value={home.randomProductsSection?.eyebrow || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                randomProductsSection: {
                  ...(h.randomProductsSection || {}),
                  eyebrow: e.target.value,
                },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="randTitle"
            value={home.randomProductsSection?.title || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                randomProductsSection: {
                  ...(h.randomProductsSection || {}),
                  title: e.target.value,
                },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Subtítulo</label>
            <textarea
              className="auth-field__input"
              rows={2}
              value={home.randomProductsSection?.subtitle || ""}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  randomProductsSection: {
                    ...(h.randomProductsSection || {}),
                    subtitle: e.target.value,
                  },
                }))
              }
            />
          </div>
        </>
      )}

      {section === "inspiracion" && (
        <>
          <h2>Inspiración</h2>
          <AuthFormField
            label="Eyebrow"
            name="inspEyebrow"
            value={home.inspiracion?.eyebrow || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                inspiracion: {
                  ...(h.inspiracion || {}),
                  eyebrow: e.target.value,
                },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="inspTitle"
            value={home.inspiracion?.title || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                inspiracion: {
                  ...(h.inspiracion || {}),
                  title: e.target.value,
                },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Subtítulo</label>
            <textarea
              className="auth-field__input"
              rows={2}
              value={home.inspiracion?.subtitle || ""}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  inspiracion: {
                    ...(h.inspiracion || {}),
                    subtitle: e.target.value,
                  },
                }))
              }
            />
          </div>
          <AuthFormField
            label="URL Instagram"
            name="igUrl"
            value={home.inspiracion?.instagramUrl || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                inspiracion: {
                  ...(h.inspiracion || {}),
                  instagramUrl: e.target.value,
                },
              }))
            }
          />
          <AuthFormField
            label="Texto botón Instagram"
            name="igCta"
            value={home.inspiracion?.ctaLabel || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                inspiracion: {
                  ...(h.inspiracion || {}),
                  ctaLabel: e.target.value,
                },
              }))
            }
          />
        </>
      )}

      {section === "newsletter" && (
        <>
          <h2>Newsletter</h2>
          <AuthFormField
            label="Eyebrow"
            name="nlEyebrow"
            value={home.newsletterSection?.eyebrow || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                newsletterSection: {
                  ...(h.newsletterSection || {}),
                  eyebrow: e.target.value,
                },
              }))
            }
          />
          <AuthFormField
            label="Título"
            name="nlTitle"
            value={home.newsletterSection?.title || ""}
            onChange={(e) =>
              setHome((h) => ({
                ...h,
                newsletterSection: {
                  ...(h.newsletterSection || {}),
                  title: e.target.value,
                },
              }))
            }
          />
          <div className="auth-field">
            <label className="auth-field__label">Subtítulo</label>
            <textarea
              className="auth-field__input"
              rows={2}
              value={home.newsletterSection?.subtitle || ""}
              onChange={(e) =>
                setHome((h) => ({
                  ...h,
                  newsletterSection: {
                    ...(h.newsletterSection || {}),
                    subtitle: e.target.value,
                  },
                }))
              }
            />
          </div>
        </>
      )}

      <div className="cms-section-actions cms-section-actions--end">
        <AuthSubmitButton loading={saving}>Guardar inicio</AuthSubmitButton>
      </div>
    </form>
  );
}

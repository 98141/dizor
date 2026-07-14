import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentPage } from "@/services/cmsService";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/seo/Breadcrumbs";

// Sin imagen de marketing dedicada en el repo: se reutiliza el ícono real
// del sitio para que OpenGraph/Twitter nunca queden sin imagen.
const DEFAULT_OG_IMAGE = "/icon-512.png";
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"
).replace(/\/$/, "");

// Detecta el tipo de página CMS a partir del slug, sin asumir su contenido.
// Solo se usan tipos que realmente aplican con la información disponible
// (no se genera FAQPage: requeriría pares pregunta/respuesta estructurados
// que el CMS no provee, el body es texto libre).
const ABOUT_SLUGS = ["nosotros", "sobre-nosotros", "quienes-somos", "acerca-de"];
const CONTACT_SLUGS = ["contacto"];

function detectPageType(slug) {
  if (ABOUT_SLUGS.includes(slug)) return "AboutPage";
  if (CONTACT_SLUGS.includes(slug)) return "ContactPage";
  return "WebPage";
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getContentPage(slug);
  if (!data?.page) return { title: "Página" };

  const { page } = data;
  const title = page.seoTitle || page.title;
  const description = page.seoDescription || page.excerpt || "";
  const ogImage = page.imageUrl || DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    ...(description && {
      keywords: [page.title, "Dizor", "sombreros artesanales", "Sandoná", "Nariño"].filter(Boolean),
    }),
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: ogImage, alt: page.imageAlt || page.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `/pagina/${slug}`,
    },
  };
}

function renderBlock(block, index) {
  const trimmed = block.trim();
  if (!trimmed) return null;

  // Section heading: starts with "# "
  if (trimmed.startsWith("# ")) {
    return (
      <h2 key={index} className="content-page__section-title">
        {trimmed.slice(2)}
      </h2>
    );
  }

  const lines = trimmed.split("\n").filter(Boolean);

  // Size table: all lines match "Talla X — ..."
  const sizePattern = /^Talla\s+\S+\s+[—–-]/i;
  if (lines.length >= 2 && lines.every((l) => sizePattern.test(l.trim()))) {
    return (
      <div key={index} className="content-page__size-grid">
        {lines.map((line) => {
          const parts = line.replace(/[—–-]+/, "—").split("—");
          const label = parts[0]?.trim();
          const value = parts[1]?.trim();
          return (
            <div key={line} className="content-page__size-card">
              <span className="content-page__size-label">{label}</span>
              <span className="content-page__size-value">{value}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // List: all lines start with "- "
  if (lines.every((l) => l.trimStart().startsWith("- "))) {
    return (
      <ul key={index} className="content-page__list">
        {lines.map((l) => (
          <li key={l}>{l.replace(/^-\s+/, "")}</li>
        ))}
      </ul>
    );
  }

  // Default paragraph
  return (
    <p key={index} className="content-page__body-p">
      {trimmed}
    </p>
  );
}

export default async function ContentPageRoute({ params }) {
  const { slug } = await params;
  const data = await getContentPage(slug);

  if (!data?.page) notFound();

  const { page } = data;
  const blocks = (page.body || "").split("\n\n");

  const pageSchema = {
    "@context": "https://schema.org",
    "@type": detectPageType(slug),
    "@id": `${SITE_URL}/pagina/${slug}#page`,
    name: page.title,
    url: `${SITE_URL}/pagina/${slug}`,
    ...(page.seoDescription || page.excerpt
      ? { description: page.seoDescription || page.excerpt }
      : {}),
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  const breadcrumbItems = [
    { name: "Inicio", href: "/" },
    { name: page.title },
  ];

  return (
    <article className="content-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
      <Breadcrumbs
        items={breadcrumbItems}
        as="nav"
        className="content-page__breadcrumb"
      />

      <div className="content-page__header">
        <div className="content-page__header-text">
          <h1 className="content-page__title">{page.title}</h1>
          {page.excerpt && (
            <p className="content-page__excerpt">{page.excerpt}</p>
          )}
        </div>
        {page.imageUrl && (
          <div className="content-page__header-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.imageUrl}
              alt={page.imageAlt || page.title}
              className="content-page__image"
            />
          </div>
        )}
      </div>

      <div className="content-page__body">
        {blocks.map((block, i) => renderBlock(block, i))}
      </div>

      <div className="content-page__back">
        <Link href="/catalogo" className="content-page__back-link">
          ← Ver productos
        </Link>
      </div>
    </article>
  );
}

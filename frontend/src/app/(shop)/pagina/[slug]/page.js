import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentPage } from "@/services/cmsService";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getContentPage(slug);
  if (!data?.page) return { title: "Página" };
  return {
    title: data.page.seoTitle || data.page.title,
    description: data.page.seoDescription || data.page.excerpt,
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

  return (
    <article className="content-page">
      <nav className="content-page__breadcrumb">
        <Link href="/">Inicio</Link> / {page.title}
      </nav>

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

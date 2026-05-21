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

export default async function ContentPageRoute({ params }) {
  const { slug } = await params;
  const data = await getContentPage(slug);

  if (!data?.page) {
    notFound();
  }

  const { page } = data;
  const paragraphs = page.body.split("\n\n").filter(Boolean);

  return (
    <article className="content-page">
      <nav className="content-page__breadcrumb">
        <Link href="/">Inicio</Link> / {page.title}
      </nav>
      <h1 className="content-page__title">{page.title}</h1>
      {page.excerpt && <p className="content-page__excerpt">{page.excerpt}</p>}
      <div className="content-page__body">
        {paragraphs.map((para) => (
          <p key={para.slice(0, 40)}>{para}</p>
        ))}
      </div>
    </article>
  );
}

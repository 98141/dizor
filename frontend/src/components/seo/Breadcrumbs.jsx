import Link from "next/link";

// items: [{ name: string, href?: string }] — el último elemento (la página
// actual) normalmente no lleva href.
export function buildBreadcrumbSchema(items, siteUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.href && { item: `${siteUrl}${item.href}` }),
    })),
  };
}

// Solo emite el <script> JSON-LD, sin ningún elemento visual. Seguro de usar
// en cualquier página sin afectar el diseño existente.
export function BreadcrumbJsonLd({ items, siteUrl }) {
  if (!items?.length) return null;
  const schema = buildBreadcrumbSchema(items, siteUrl);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Breadcrumb visual reutilizable. `as` permite conservar el tag original
// (p, nav) de cada página para no alterar el CSS/espaciado existente.
export function Breadcrumbs({ items, as: Tag = "nav", className }) {
  if (!items?.length) return null;
  return (
    <Tag className={className} aria-label={Tag === "nav" ? "Breadcrumb" : undefined}>
      {items.map((item, i) => (
        <span key={`${item.name}-${i}`}>
          {item.href ? <Link href={item.href}>{item.name}</Link> : item.name}
          {i < items.length - 1 ? " / " : ""}
        </span>
      ))}
    </Tag>
  );
}

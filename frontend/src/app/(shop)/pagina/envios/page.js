import Link from "next/link";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/seo/Breadcrumbs";
import { BUSINESS, LEGAL_DOCS } from "@/lib/businessInfo";
import LegalDocMeta from "@/components/legal/LegalDocMeta";

// "Envíos y entregas" (mismo título, ruta y diseño que la página del CMS).
// Es estática para que el texto revisado no dependa del contenido guardado
// en la base de datos, que anunciaba "envío gratis" y transportadoras que ya
// no se usan. Ver backend/src/config/deliveryTerms.js: el plazo de entrega
// NO se publica mientras no esté definido.

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://sombrerosdizor.com.co"
).replace(/\/$/, "");

const TITLE = "Envíos y entregas";
const EXCERPT = "Cobertura nacional, transportadoras y envío incluido en el precio.";

export const metadata = {
  title: TITLE,
  description: EXCERPT,
  alternates: {
    canonical: "/pagina/envios",
  },
};

export default function EnviosPage() {
  const breadcrumbItems = [{ name: "Inicio", href: "/" }, { name: TITLE }];
  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/pagina/envios#page`,
    name: TITLE,
    url: `${SITE_URL}/pagina/envios`,
    description: EXCERPT,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  return (
    <article className="content-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
      <Breadcrumbs items={breadcrumbItems} as="nav" className="content-page__breadcrumb" />

      <div className="content-page__header">
        <div className="content-page__header-text">
          <h1 className="content-page__title">{TITLE}</h1>
          <p className="content-page__excerpt">{EXCERPT}</p>
        </div>
      </div>

      <div className="content-page__body">
        <LegalDocMeta version={LEGAL_DOCS.shipping.version} />

        <h2 className="content-page__section-title">Cobertura</h2>
        <p className="content-page__body-p">
          Vendemos y enviamos únicamente dentro de Colombia, con cobertura
          nacional.
        </p>

        <h2 className="content-page__section-title">Transportadoras</h2>
        <p className="content-page__body-p">
          Enviamos tus pedidos con Inter Rapidísimo o Servientrega. Cuando
          despachamos el pedido, te informamos la transportadora y el número de
          guía para que puedas seguirlo.
        </p>

        <h2 className="content-page__section-title">Costo del envío</h2>
        <p className="content-page__body-p">
          El valor del envío ya está incluido en el precio de cada producto. No
          se cobra un cargo adicional por envío en el checkout.
        </p>

        <h2 className="content-page__section-title">Retrasos e incidencias en el transporte</h2>
        <ul className="content-page__list">
          <li>
            Si tu pedido se retrasa, se pierde o llega dañado, escríbenos: somos
            tu canal para resolverlo y nosotros gestionamos el caso con la
            transportadora. No necesitas reclamarle directamente.
          </li>
          <li>
            Si no podemos entregar en el plazo acordado, te avisaremos. Podrás
            ejercer los derechos que te reconoce la ley, incluida la terminación
            de la compra con la devolución del dinero cuando proceda.
          </li>
          <li>
            Solo los hechos de fuerza mayor o caso fortuito, en los términos de la
            ley y debidamente verificables, pueden justificar un retraso.
          </li>
        </ul>

        <h2 className="content-page__section-title">Productos dañados o equivocados</h2>
        <p className="content-page__body-p">
          Si recibes un producto equivocado o dañado por el transporte, los
          costos de la solución corren por nuestra cuenta. Consulta{" "}
          <Link href="/garantias-y-devoluciones">Garantías, retracto y devoluciones</Link>.
        </p>

        <h2 className="content-page__section-title">Contacto</h2>
        <p className="content-page__body-p">
          Escríbenos a <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>{" "}
          indicando tu número de pedido. Atención: {BUSINESS.attentionHours}.
        </p>
      </div>

      <div className="content-page__back">
        <Link href="/catalogo" className="content-page__back-link">
          ← Ver productos
        </Link>
      </div>
    </article>
  );
}

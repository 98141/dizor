import Link from "next/link";
import { BUSINESS, LEGAL_DOCS } from "@/lib/businessInfo";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import LegalDocMeta from "@/components/legal/LegalDocMeta";
import PrintButton from "@/components/legal/PrintButton";

export const metadata = {
  title: "Garantías, retracto y devoluciones",
  description:
    "Garantía legal, derecho de retracto, reversión del pago y cambios voluntarios en DIZOR: qué cubre cada uno y cómo solicitarlo.",
  alternates: {
    canonical: "/garantias-y-devoluciones",
  },
};

const pqrEnabled = process.env.NEXT_PUBLIC_PQR_ENABLED === "true";

function Channels() {
  return (
    <>
      escríbenos a <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
      {pqrEnabled ? (
        <>
          , usa el <Link href="/pqr">formulario de peticiones, quejas y reclamos</Link>
        </>
      ) : null}{" "}
      o por{" "}
      <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
    </>
  );
}

export default function GarantiasPage() {
  return (
    <article className="content-page">
      <nav className="content-page__breadcrumb">
        <Link href="/">Inicio</Link> / Garantías, retracto y devoluciones
      </nav>

      <div className="content-page__header">
        <div className="content-page__header-text">
          <h1 className="content-page__title">Garantías, retracto y devoluciones</h1>
          <p className="content-page__excerpt">
            Garantía, retracto, reversión del pago y cambios voluntarios son
            figuras distintas. Aquí te explicamos cada una y cómo solicitarla.
          </p>
        </div>
      </div>

      <div className="content-page__body">
        <LegalDocMeta version={LEGAL_DOCS.guarantees.version} />
        <PrintButton />

        <h2 className="content-page__section-title">Cómo hacer cualquier solicitud</h2>
        <p className="content-page__body-p">
          Para cualquiera de estos trámites, <Channels />, indicando tu número de
          pedido y lo que solicitas. Puedes usar el canal que prefieras: ninguno
          es obligatorio frente a los demás. Te pediremos solo la información
          necesaria para identificar el pedido y entender la situación; no
          exigimos video, factura impresa ni empaque original como condición
          para atender tu solicitud.
        </p>
        <p className="content-page__body-p">
          La atención personal es de {BUSINESS.attentionHours}. Si debes enviarnos
          un producto, te indicaremos la dirección y la forma de envío antes de
          que lo despaches.
        </p>

        <h2 className="content-page__section-title">1. Garantía legal</h2>
        <p className="content-page__body-p">
          Respondemos por la calidad, idoneidad, seguridad y buen estado de los
          productos que vendemos, incluidos los que compres en promoción o con
          descuento, durante el término de garantía legal, que se cuenta desde
          la entrega (Ley 1480 de 2011, arts. 7 y 8).
        </p>
        <ul className="content-page__list">
          <li>
            Si el producto presenta un defecto, te ofreceremos su reparación sin
            costo y, cuando corresponda según la ley, su cambio por otro igual o
            la devolución del dinero.
          </li>
          <li>Los costos de transporte asociados a la garantía corren por nuestra cuenta.</li>
          <li>
            Las variaciones propias del trabajo artesanal (pequeñas diferencias de
            tono, tejido o medida) no son defectos. El desgaste por uso normal y
            los daños por uso indebido no están cubiertos por la garantía.
          </li>
        </ul>

        <h2 className="content-page__section-title">2. Producto equivocado o dañado en el transporte</h2>
        <p className="content-page__body-p">
          Si recibes un producto distinto al que pediste, o llega dañado por el
          transporte, nosotros asumimos los costos de recogerlo y de enviarte el
          producto correcto o en buen estado. No necesitas reclamar a la
          transportadora: nosotros gestionamos el caso con ella. Este derecho no
          se limita a un plazo de pocos días; te recomendamos avisarnos tan pronto
          lo notes para resolverlo más rápido.
        </p>

        <h2 className="content-page__section-title">3. Derecho de retracto</h2>
        <p className="content-page__body-p">
          Por ser una compra a distancia, puedes retractarte dentro de los cinco
          (5) días hábiles siguientes a la entrega del producto, sin indicar el
          motivo (Ley 1480 de 2011, art. 47).
        </p>
        <ol className="content-page__steps">
          <li>Avísanos dentro de ese plazo por cualquiera de los canales indicados.</li>
          <li>
            Devuelve el producto por los mismos medios y en las mismas condiciones
            en que lo recibiste. Los costos de transporte de la devolución corren
            por tu cuenta.
          </li>
          <li>
            Te devolveremos la totalidad del dinero pagado, sin descuentos ni
            retenciones, en un plazo máximo de quince (15) días calendario desde
            que ejerciste el derecho.
          </li>
        </ol>
        <p className="content-page__body-p">
          <strong>Productos personalizados.</strong>{" "}El retracto no aplica a los
          productos confeccionados conforme a tus especificaciones o claramente
          personalizados (art. 47, num. 3), es decir, los encargos que
          acordamos contigo mediante &quot;Solicitar personalización&quot;. Elegir
          talla, color u otra variante del catálogo <strong>no</strong> convierte
          el producto en personalizado, y tampoco lo hace que el producto sea
          artesanal o que admita personalización si lo compraste tal como aparece
          en el catálogo. La garantía legal aplica también a los productos
          personalizados.
        </p>

        <h2 className="content-page__section-title">4. Reversión del pago</h2>
        <p className="content-page__body-p">
          Si pagaste en línea con tarjeta u otro instrumento de pago electrónico
          (por ejemplo, a través de Wompi), puedes solicitar la reversión del
          pago cuando hayas sido objeto de fraude, la operación no haya sido
          solicitada, no hayas recibido el producto, el producto entregado no
          corresponda a lo que pediste o esté defectuoso (Ley 1480 de 2011,
          art. 51).
        </p>
        <ol className="content-page__steps">
          <li>
            Preséntanos la queja dentro de los cinco (5) días hábiles siguientes a
            la fecha en que tuviste noticia de la situación.
          </li>
          <li>
            En el mismo plazo, informa al emisor de tu tarjeta o instrumento de
            pago para que reverse la transacción.
          </li>
          <li>Cuando corresponda, devuélvenos el producto; te indicaremos cómo.</li>
        </ol>
        <p className="content-page__body-p">
          Si pagaste contra entrega, puedes usar la garantía, el retracto o las
          demás opciones de esta página.
        </p>

        <h2 className="content-page__section-title">5. Cambios voluntarios de talla</h2>
        <p className="content-page__body-p">
          Si recibiste el producto correcto y en buen estado pero quieres otra
          talla, puedes solicitarnos el cambio. En ese caso, los costos de
          transporte del cambio corren por tu cuenta. Si la talla que necesitas
          no está disponible, te informaremos las alternativas.
        </p>
        <p className="content-page__body-p">
          Este cambio es una opción adicional que te ofrecemos: no reemplaza ni
          limita la garantía, el retracto ni la reversión del pago. Si el producto
          llegó equivocado o con un defecto, aplican las secciones 1 y 2, y no
          asumes ningún costo.
        </p>
      </div>

      <div className="content-page__back">
        <Link href="/" className="content-page__back-link">
          ← Volver al inicio
        </Link>
      </div>
    </article>
  );
}

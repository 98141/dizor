import Link from "next/link";
import { BUSINESS, LEGAL_DOCS } from "@/lib/businessInfo";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import LegalDocMeta from "@/components/legal/LegalDocMeta";
import PrintButton from "@/components/legal/PrintButton";

export const metadata = {
  title: "Términos y condiciones de compra",
  description:
    "Condiciones de compra en la tienda en línea de DIZOR: vendedor, precios, pagos, envíos, garantía, retracto y atención.",
  alternates: {
    canonical: "/terminos-y-condiciones",
  },
};

const pqrEnabled = process.env.NEXT_PUBLIC_PQR_ENABLED === "true";

export default function TerminosPage() {
  return (
    <article className="content-page">
      <nav className="content-page__breadcrumb">
        <Link href="/">Inicio</Link> / Términos y condiciones
      </nav>

      <div className="content-page__header">
        <div className="content-page__header-text">
          <h1 className="content-page__title">Términos y condiciones de compra</h1>
          <p className="content-page__excerpt">
            Condiciones que aplican a las compras realizadas en este sitio.
            Antes de confirmar tu pedido te pediremos aceptarlas.
          </p>
        </div>
      </div>

      <div className="content-page__body">
        <LegalDocMeta version={LEGAL_DOCS.terms.version} />
        <PrintButton />

        <h2 className="content-page__section-title">1. Quién vende</h2>
        <p className="content-page__body-p">
          {BUSINESS.brand} es una marca de <strong>{BUSINESS.legalName}</strong>,
          NIT {BUSINESS.nit}, con domicilio registrado en {BUSINESS.registeredAddress}.
          Esta sociedad es quien vende los productos y emite la factura.
        </p>
        <ul className="content-page__list">
          <li>Correo: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></li>
          <li>
            WhatsApp:{" "}
            <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer">
              {BUSINESS.whatsappDisplay}
            </a>
          </li>
          <li>Atención personal: {BUSINESS.attentionHours}.</li>
        </ul>

        <h2 className="content-page__section-title">2. Alcance</h2>
        <p className="content-page__body-p">
          Vendemos y entregamos únicamente dentro de Colombia. Estos términos
          aplican a las compras hechas en este sitio; la versión que aceptas
          queda registrada con tu pedido.
        </p>

        <h2 className="content-page__section-title">3. Productos</h2>
        <p className="content-page__body-p">
          Nuestros productos son elaborados a mano. Por eso pueden presentar
          pequeñas variaciones de tono, tejido o medida entre una pieza y otra,
          propias del trabajo artesanal; esas variaciones no son un defecto. Las
          fotografías y descripciones buscan mostrar el producto de la forma más
          fiel posible.
        </p>
        <p className="content-page__body-p">
          Distinguimos tres situaciones, que tienen efectos distintos sobre el
          derecho de retracto (ver{" "}
          <Link href="/garantias-y-devoluciones">Garantías, retracto y devoluciones</Link>):
        </p>
        <ul className="content-page__list">
          <li>
            <strong>Variante de catálogo:</strong> eliges talla, color u otra
            opción entre las que ofrece la ficha del producto. Es un producto
            estándar.
          </li>
          <li>
            <strong>Producto que admite personalización:</strong>{" "}su ficha
            muestra la opción &quot;Solicitar personalización&quot; (por ejemplo,
            pines, color de cinta, o colores y tejidos en bolsos y sombreros). Si
            lo compras tal como aparece en el catálogo, sigue siendo un producto
            estándar.
          </li>
          <li>
            <strong>Producto personalizado:</strong>{" "}el que fabricamos o
            modificamos según especificaciones particulares que nos pides a través
            de &quot;Solicitar personalización&quot;. Te enviamos una cotización
            con el detalle de lo acordado, en la que te indicamos que se trata de
            un producto personalizado, antes de que confirmes el encargo.
          </li>
        </ul>

        <h2 className="content-page__section-title">4. Precios</h2>
        <p className="content-page__body-p">
          Los precios están en pesos colombianos (COP) e incluyen los impuestos
          aplicables. El valor del envío también está incluido en el precio de
          cada producto: no se cobra un cargo adicional por envío. El precio que
          pagas es el que aparece en el resumen del pedido antes de confirmarlo.
        </p>

        <h2 className="content-page__section-title">5. Cómo se hace un pedido</h2>
        <ol className="content-page__steps">
          <li>Agregas los productos al carrito y revisas cantidades y variantes.</li>
          <li>Indicas tus datos de contacto y la dirección de entrega en Colombia.</li>
          <li>Eliges el medio de pago.</li>
          <li>
            Revisas el resumen: productos, cantidades, precio unitario, subtotal
            y total. Puedes volver atrás para corregir cualquier dato.
          </li>
          <li>
            Aceptas estos términos y autorizas el tratamiento de tus datos para
            gestionar el pedido, y confirmas.
          </li>
          <li>
            Te mostramos el número de pedido y te enviamos por correo un acuse
            de recibo con el detalle de la compra.
          </li>
        </ol>

        <h2 className="content-page__section-title">6. Medios de pago</h2>
        <ul className="content-page__list">
          <li>
            <strong>Wompi:</strong> pago en línea con los medios que Wompi ofrece
            en su página de pago (por ejemplo, tarjeta, PSE o Nequi). El pago se
            entiende confirmado cuando Wompi nos notifica que fue aprobado; volver
            a nuestro sitio desde la pasarela no basta para confirmarlo.
          </li>
          <li>
            <strong>Pago contra entrega:</strong> pagas al recibir el pedido.
            Hasta ese momento el pedido figura con pago pendiente.
          </li>
        </ul>
        <p className="content-page__body-p">
          No te pediremos transferencias a cuentas personales ni comprobantes de
          pago por WhatsApp. Si recibes una solicitud así a nombre de{" "}
          {BUSINESS.brand}, no la atiendas y escríbenos a {BUSINESS.email}.
        </p>

        <h2 className="content-page__section-title">7. Envíos y entregas</h2>
        <p className="content-page__body-p">
          Las condiciones de envío, las transportadoras y lo que ocurre ante un
          retraso o un problema en el transporte están en{" "}
          <Link href="/pagina/envios">Envíos y entregas</Link>.
        </p>

        <h2 className="content-page__section-title">8. Garantía, retracto, reversión del pago y cambios</h2>
        <p className="content-page__body-p">
          Son cuatro figuras distintas y las explicamos por separado en{" "}
          <Link href="/garantias-y-devoluciones">Garantías, retracto y devoluciones</Link>.
          Ninguna condición de estos términos limita los derechos que la ley te
          reconoce como consumidor.
        </p>

        <h2 className="content-page__section-title">9. Atención, peticiones, quejas y reclamos</h2>
        <p className="content-page__body-p">
          Puedes escribirnos a <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          {pqrEnabled ? (
            <>
              {" "}o usar el <Link href="/pqr">formulario de peticiones, quejas y reclamos</Link>,
              que te entrega un número de radicado con fecha y hora para hacer
              seguimiento
            </>
          ) : null}
          . También puedes escribirnos por WhatsApp. La atención personal es de{" "}
          {BUSINESS.attentionHours}.
        </p>

        <h2 className="content-page__section-title">10. Datos personales</h2>
        <p className="content-page__body-p">
          El tratamiento de tus datos se rige por la{" "}
          <Link href="/politica-de-privacidad">Política de Tratamiento de Datos Personales</Link>{" "}
          y el uso de cookies por la{" "}
          <Link href="/politica-de-cookies">Política de Cookies</Link>.
        </p>

        <h2 className="content-page__section-title">11. Cambios a estos términos</h2>
        <p className="content-page__body-p">
          Podemos actualizar estos términos. Cada pedido se rige por la versión
          que aceptaste al confirmarlo.
        </p>

        <h2 className="content-page__section-title">12. Ley aplicable y autoridad</h2>
        <p className="content-page__body-p">
          Estas condiciones se rigen por las leyes de Colombia, en especial el
          Estatuto del Consumidor (Ley 1480 de 2011). La autoridad de protección
          al consumidor es la{" "}
          <a href="https://www.sic.gov.co/" target="_blank" rel="noopener noreferrer">
            Superintendencia de Industria y Comercio
          </a>.
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

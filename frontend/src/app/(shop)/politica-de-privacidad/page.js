import Link from "next/link";
import { BUSINESS, LEGAL_DOCS } from "@/lib/businessInfo";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import LegalDocMeta from "@/components/legal/LegalDocMeta";

export const metadata = {
  title: "Política de Tratamiento de Datos Personales",
  description:
    "Quién trata tus datos personales en DIZOR, para qué, con quién se comparten y cómo ejercer tus derechos.",
  alternates: {
    canonical: "/politica-de-privacidad",
  },
};

const pqrEnabled = process.env.NEXT_PUBLIC_PQR_ENABLED === "true";

// Inventario de tratamientos comprobado en el código. Si se añade un
// formulario o una finalidad, actualizar esta tabla y subir la versión.
const TREATMENTS = [
  {
    what: "Compras",
    data: "Nombre, correo, teléfono, dirección de entrega, ciudad, departamento y notas del pedido.",
    purpose: "Confirmar, cobrar, facturar, preparar y entregar tu pedido; enviarte el acuse de recibo y los avisos del pedido; atender garantías, retractos, reversiones y cambios.",
  },
  {
    what: "Cuenta de cliente",
    data: "Nombre, correo, contraseña (guardada cifrada), teléfono, direcciones, favoritos e historial de pedidos.",
    purpose: "Crear y administrar tu cuenta y mostrarte tus pedidos.",
  },
  {
    what: "Encargos personalizados y pedidos por mayor",
    data: "Datos de contacto, empresa (si la indicas) y detalles de la solicitud.",
    purpose: "Responder y cotizar tu solicitud.",
  },
  {
    what: "Reseñas",
    data: "Nombre que indiques, ciudad (si la indicas), calificación y comentario.",
    purpose: "Publicar la reseña en el sitio, solo si la apruebas al enviarla y tras su revisión.",
  },
  {
    what: "Peticiones, quejas, reclamos y solicitudes sobre tus datos",
    data: "Datos de contacto, número de pedido (si aplica) y la descripción de la solicitud.",
    purpose: "Registrar, tramitar y responder la solicitud, y conservar su trazabilidad.",
  },
  {
    what: "Novedades por correo",
    data: "Correo y, si lo indicas, tu nombre.",
    purpose: "Enviarte novedades y ofertas, solo si lo autorizas. Puedes darte de baja cuando quieras.",
  },
  {
    what: "Prueba de tus autorizaciones",
    data: "Finalidad autorizada, versión del texto aceptado, fecha, formulario de origen y correo.",
    purpose: "Demostrar cuándo y para qué diste tu autorización, y respetar tus bajas y revocaciones.",
  },
  {
    what: "Seguridad del sitio",
    data: "Dirección IP, navegador y páginas solicitadas (registros técnicos del servidor).",
    purpose: "Operar el sitio, prevenir abusos y diagnosticar errores.",
  },
];

const PROVIDERS = [
  { name: "HostingLabs (cPanel)", role: "Alojamiento del sitio y del servidor de la tienda." },
  { name: "MongoDB Atlas", role: "Base de datos de la tienda." },
  { name: "Servicio de envío de correos transaccionales", role: "Envío del acuse de recibo, avisos del pedido y respuestas." },
  { name: "Servicio de alojamiento de imágenes", role: "Publicación de las imágenes de los productos." },
  { name: "Wompi", role: "Procesamiento de pagos en línea. Los datos de tu tarjeta o cuenta los ingresas directamente en Wompi; DIZOR no los recibe ni los guarda." },
  { name: "Inter Rapidísimo o Servientrega", role: "Transporte y entrega del pedido (nombre, dirección y teléfono de entrega)." },
];

export default function PoliticaPrivacidadPage() {
  return (
    <article className="content-page">
      <nav className="content-page__breadcrumb">
        <Link href="/">Inicio</Link> / Política de privacidad
      </nav>

      <div className="content-page__header">
        <div className="content-page__header-text">
          <h1 className="content-page__title">Política de Tratamiento de Datos Personales</h1>
          <p className="content-page__excerpt">
            Qué datos personales tratamos, para qué, con quién los compartimos
            y cómo puedes ejercer tus derechos.
          </p>
        </div>
      </div>

      <div className="content-page__body">
        <LegalDocMeta version={LEGAL_DOCS.privacy.version} />

        <h2 className="content-page__section-title">1. Responsable del tratamiento</h2>
        <ul className="content-page__list">
          <li><strong>{BUSINESS.legalName}</strong>, titular de la marca {BUSINESS.brand}.</li>
          <li>NIT {BUSINESS.nit}.</li>
          <li>Domicilio registrado: {BUSINESS.registeredAddress}.</li>
          <li>
            Correo: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> · WhatsApp:{" "}
            <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer">
              {BUSINESS.whatsappDisplay}
            </a>
          </li>
        </ul>

        <h2 className="content-page__section-title">2. Qué datos tratamos y para qué</h2>
        <p className="content-page__body-p">
          Solo pedimos los datos necesarios para cada trámite. Cada formulario
          te muestra, antes de enviarlo, la finalidad concreta y te pide tu
          autorización.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="content-page__table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.4rem" }}>Tratamiento</th>
                <th style={{ textAlign: "left", padding: "0.4rem" }}>Datos</th>
                <th style={{ textAlign: "left", padding: "0.4rem" }}>Finalidad</th>
              </tr>
            </thead>
            <tbody>
              {TREATMENTS.map((t) => (
                <tr key={t.what}>
                  <td style={{ padding: "0.4rem", verticalAlign: "top" }}>{t.what}</td>
                  <td style={{ padding: "0.4rem", verticalAlign: "top" }}>{t.data}</td>
                  <td style={{ padding: "0.4rem", verticalAlign: "top" }}>{t.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="content-page__body-p">
          No pedimos datos sensibles ni datos de niñas, niños o adolescentes.
          Te pedimos no incluirlos en notas, reseñas o solicitudes.
        </p>
        <p className="content-page__body-p">
          El sitio no usa analítica de terceros ni publicidad personalizada. Las
          estadísticas propias de visitas solo se activan si las aceptas; el detalle está en la{" "}
          <Link href="/politica-de-cookies">Política de Cookies</Link>.
        </p>

        <h2 className="content-page__section-title">3. Con quién compartimos tus datos</h2>
        <p className="content-page__body-p">
          No vendemos tus datos. Los compartimos únicamente con los proveedores
          que nos prestan los servicios necesarios para operar la tienda, y solo
          en la medida necesaria para cada servicio:
        </p>
        <ul className="content-page__list">
          {PROVIDERS.map((p) => (
            <li key={p.name}>
              <strong>{p.name}:</strong> {p.role}
            </li>
          ))}
        </ul>
        <p className="content-page__body-p">
          Algunos de estos proveedores pueden almacenar o procesar información
          fuera de Colombia. Puedes pedirnos información sobre el proveedor y
          el lugar en que se tratan tus datos por los canales del punto 5.
        </p>
        <p className="content-page__body-p">
          Si nos escribes por WhatsApp, esa conversación se rige además por las
          condiciones de ese servicio.
        </p>

        <h2 className="content-page__section-title">4. Tus derechos</h2>
        <p className="content-page__body-p">
          De acuerdo con la Ley 1581 de 2012, puedes:
        </p>
        <ul className="content-page__list">
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>Solicitar prueba de la autorización que nos diste.</li>
          <li>Ser informado sobre el uso que damos a tus datos.</li>
          <li>
            Revocar tu autorización o pedir la supresión de tus datos, salvo
            cuando exista un deber legal o contractual de conservarlos (por
            ejemplo, la información de una compra que debemos guardar por
            obligaciones contables, tributarias o de garantía).
          </li>
          <li>Acceder gratuitamente a tus datos.</li>
          <li>
            Presentar quejas ante la{" "}
            <a href="https://www.sic.gov.co/" target="_blank" rel="noopener noreferrer">
              Superintendencia de Industria y Comercio
            </a>{" "}
            después de haber agotado el trámite ante nosotros.
          </li>
        </ul>
        <p className="content-page__body-p">
          Darte de baja de las novedades por correo es inmediato desde el
          enlace incluido en cada mensaje y no afecta tus compras.
        </p>

        <h2 className="content-page__section-title">5. Cómo ejercer tus derechos</h2>
        <ol className="content-page__steps">
          <li>
            Escríbenos a <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
            {pqrEnabled ? (
              <>
                {" "}o usa el <Link href="/pqr">formulario de solicitudes</Link>{" "}(categoría
                &quot;Solicitud sobre mis datos personales&quot;)
              </>
            ) : null}
            , indicando tu nombre, el correo con el que te registraste o
            compraste y lo que solicitas.
          </li>
          <li>
            Si es necesario, te pediremos información adicional para verificar
            tu identidad antes de entregar o modificar datos.
          </li>
          <li>
            Responderemos las consultas en un máximo de diez (10) días hábiles,
            prorrogables hasta cinco (5) días hábiles más, y los reclamos en un
            máximo de quince (15) días hábiles, prorrogables hasta ocho (8) días
            hábiles más. Si necesitamos la prórroga, te informaremos el motivo.
          </li>
        </ol>
        <p className="content-page__body-p">
          Atiende estas solicitudes el equipo de atención al cliente de{" "}
          {BUSINESS.brand}, de {BUSINESS.attentionHours}. Los mensajes que
          recibamos fuera de ese horario se tramitan el siguiente día hábil.
        </p>

        <h2 className="content-page__section-title">6. Conservación y seguridad</h2>
        <p className="content-page__body-p">
          Conservamos los datos mientras sean necesarios para la finalidad para
          la que se recogieron y para cumplir obligaciones legales o
          contractuales, como las contables, tributarias, de garantía y de
          atención de reclamos. Aplicamos medidas técnicas y organizativas para
          protegerlos, como conexiones cifradas, contraseñas cifradas y acceso
          restringido al panel de administración.
        </p>

        <h2 className="content-page__section-title">7. Cambios a esta política</h2>
        <p className="content-page__body-p">
          Si cambiamos esta política, publicaremos la nueva versión en esta
          página con su número de versión. Si el cambio afecta las finalidades
          para las que nos diste tu autorización, te la pediremos de nuevo.
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

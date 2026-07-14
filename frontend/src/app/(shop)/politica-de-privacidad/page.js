import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo Dizor recopila, usa y protege los datos personales de sus clientes.",
  alternates: {
    canonical: "/politica-de-privacidad",
  },
};

export default function PoliticaPrivacidadPage() {
  return (
    <article className="content-page">
      <nav className="content-page__breadcrumb">
        <Link href="/">Inicio</Link> / Política de privacidad
      </nav>

      <div className="content-page__header">
        <div className="content-page__header-text">
          <h1 className="content-page__title">Política de Privacidad</h1>
          <p className="content-page__excerpt">
            Esta página explica qué datos personales recopila Dizor, para
            qué se usan y qué derechos tienes sobre ellos.
          </p>
        </div>
      </div>

      <div className="content-page__body">
        <p className="content-page__body-p">
          <strong>
            [PLACEHOLDER — pendiente de revisión legal: razón social, NIT y
            domicilio del responsable del tratamiento de datos]
          </strong>
        </p>

        <h2 className="content-page__section-title">Qué datos recopilamos</h2>
        <p className="content-page__body-p">
          Cuando realizas un pedido o creas una cuenta, recopilamos los datos
          que nos proporcionas directamente: nombre, correo electrónico,
          teléfono y dirección de envío. No almacenamos los datos de tu
          tarjeta ni de tu método de pago: esa información la procesan
          directamente las pasarelas de pago (Wompi, Nequi).
        </p>
        <p className="content-page__body-p">
          Si aceptas cookies analíticas, también recopilamos datos de uso
          anónimos y agregados (páginas visitadas, productos vistos) a
          través de Google Analytics. Esta analítica está configurada para
          no enviar nombres, correos, teléfonos, direcciones ni el contenido
          de tus pedidos — solo activa si das tu consentimiento explícito.
          Más detalle en la{" "}
          <Link href="/politica-de-cookies">Política de Cookies</Link>.
        </p>

        <h2 className="content-page__section-title">
          Para qué usamos tus datos
        </h2>
        <ul className="content-page__list">
          <li>Procesar y confirmar tus pedidos.</li>
          <li>Coordinar el envío con la transportadora elegida.</li>
          <li>Responder tus solicitudes de contacto, personalización o pedidos al por mayor.</li>
          <li>Con tu consentimiento, entender el uso general del sitio para mejorarlo.</li>
        </ul>
        <p className="content-page__body-p">
          <strong>
            [PLACEHOLDER — pendiente de revisión legal: base jurídica
            detallada del tratamiento y plazos de conservación de los datos]
          </strong>
        </p>

        <h2 className="content-page__section-title">
          Con quién compartimos datos
        </h2>
        <p className="content-page__body-p">
          Compartimos únicamente los datos necesarios para completar tu
          pedido: la pasarela de pago que elijas (Wompi/Nequi) para procesar
          el cobro, y la transportadora asignada (Interrapidísimo, Envía o
          Coordinadora) para la entrega. Si aceptaste cookies analíticas,
          Google Analytics recibe datos de uso anónimos, nunca tus datos de
          contacto ni de pedido.
        </p>

        <h2 className="content-page__section-title">Tus derechos</h2>
        <p className="content-page__body-p">
          Como titular de tus datos personales, tienes derecho a conocer,
          actualizar, rectificar y solicitar la eliminación de tu
          información, conforme a la Ley 1581 de 2012 (Colombia) sobre
          protección de datos personales.
        </p>
        <p className="content-page__body-p">
          <strong>
            [PLACEHOLDER — pendiente de revisión legal: canal y
            procedimiento formal para ejercer estos derechos]
          </strong>
        </p>

        <h2 className="content-page__section-title">Cambios a esta política</h2>
        <p className="content-page__body-p">
          Podemos actualizar esta política cuando cambien nuestras prácticas
          o la normativa aplicable. Publicaremos cualquier cambio relevante
          en esta misma página.
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

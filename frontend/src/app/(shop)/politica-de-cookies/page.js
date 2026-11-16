import Link from "next/link";
import { isAnalyticsConfigured } from "@/lib/analytics/config";

export const metadata = {
  title: "Política de Cookies",
  description:
    "Qué cookies y almacenamiento local usa Dizor, para qué sirven y cómo puedes gestionar tus preferencias.",
  alternates: {
    canonical: "/politica-de-cookies",
  },
};

// Inventario basado en el código (informe de auditoría 2026-11-16, B.5,
// actualizado tras las correcciones H-06/H-07/H-10). Debe revisarse cada vez
// que se añada o elimine una cookie o clave de almacenamiento.
const NECESSARY = [
  { name: "accessToken", type: "Cookie (servidor de la API, httpOnly)", purpose: "Mantener tu sesión iniciada.", duration: "15 minutos" },
  { name: "refreshToken", type: "Cookie (servidor de la API, httpOnly)", purpose: "Renovar la sesión sin pedirte la contraseña.", duration: "7 días" },
  { name: "dizor_cart_v1, dizor_coupon_v1", type: "Almacenamiento local", purpose: "Recordar tu carrito y el cupón aplicado.", duration: "Hasta que vacíes el carrito o borres los datos del navegador" },
  { name: "dizor_pending_popup_coupon", type: "Almacenamiento local", purpose: "Aplicar en el carrito el cupón mostrado en una promoción.", duration: "Hasta que se aplica" },
  { name: "dizor_favorites_v1", type: "Almacenamiento local", purpose: "Guardar tus favoritos cuando navegas sin iniciar sesión.", duration: "Hasta que los quites o borres los datos del navegador" },
  { name: "dizor_order_access", type: "Almacenamiento de sesión", purpose: "Mostrarte la confirmación del pedido que acabas de hacer. Contiene el número de pedido y un código de acceso temporal; no contiene tu nombre ni tu correo.", duration: "Hasta cerrar la pestaña (el código vence en el servidor a las 72 horas)" },
  { name: "dizor_cookie_preferences", type: "Almacenamiento local", purpose: "Recordar tu decisión sobre las cookies opcionales.", duration: "Hasta que la cambies o borres los datos del navegador" },
];

const PREFERENCES_AND_STATS = [
  { name: "dizor_promo_popup_seen", type: "Almacenamiento de sesión", purpose: "No volver a mostrarte la ventana promocional en la misma visita.", duration: "Hasta cerrar la pestaña" },
  { name: "dizor_visit_day", type: "Cookie (servidor de la API)", purpose: "Contar tu visita una sola vez al día en el contador total del pie de página. Solo guarda la fecha.", duration: "1 día" },
  { name: "dizor_last_visit_day", type: "Almacenamiento local", purpose: "Lo mismo que la anterior, en el navegador. Solo guarda la fecha.", duration: "Hasta borrar los datos del navegador" },
];

function InventoryTable({ rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="content-page__table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Nombre</th>
            <th style={{ textAlign: "left" }}>Tipo</th>
            <th style={{ textAlign: "left" }}>Finalidad</th>
            <th style={{ textAlign: "left" }}>Duración</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td><code>{r.name}</code></td>
              <td>{r.type}</td>
              <td>{r.purpose}</td>
              <td>{r.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PoliticaCookiesPage() {
  const analyticsActive = isAnalyticsConfigured();

  return (
    <article className="content-page">
      <nav className="content-page__breadcrumb">
        <Link href="/">Inicio</Link> / Política de cookies
      </nav>

      <div className="content-page__header">
        <div className="content-page__header-text">
          <h1 className="content-page__title">Política de Cookies</h1>
          <p className="content-page__excerpt">
            Qué cookies y almacenamiento del navegador usa este sitio y para qué.
          </p>
        </div>
      </div>

      <div className="content-page__body">
        <h2 className="content-page__section-title">¿Qué son?</h2>
        <p className="content-page__body-p">
          Las cookies y mecanismos equivalentes (almacenamiento local y de
          sesión del navegador) guardan pequeñas piezas de información en tu
          dispositivo para recordar datos entre páginas o visitas, como el
          contenido de tu carrito.
        </p>

        <h2 className="content-page__section-title">Necesarias para el funcionamiento</h2>
        <p className="content-page__body-p">
          Se usan para prestarte el servicio que solicitas (carrito, sesión,
          compra). No requieren que aceptes nada en el aviso de cookies.
        </p>
        <InventoryTable rows={NECESSARY} />

        <h2 className="content-page__section-title">Preferencias y conteo de visitas</h2>
        <InventoryTable rows={PREFERENCES_AND_STATS} />

        <h2 className="content-page__section-title">Cookies analíticas</h2>
        {analyticsActive ? (
          <p className="content-page__body-p">
            Solo se activan si las aceptas en el aviso o en el panel de
            preferencias. Usamos Google Analytics 4, que puede crear cookies
            como <code>_ga</code> y <code>_ga_&lt;id&gt;</code> para distinguir
            visitas y medir el uso del sitio. No le enviamos tu nombre,
            correo, teléfono ni dirección. Si retiras el permiso, eliminamos
            esas cookies de este sitio. Más información en la{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              política de privacidad de Google
            </a>
            .
          </p>
        ) : (
          <p className="content-page__body-p">
            Actualmente no usamos cookies analíticas. Si en el futuro las
            usamos, solo se activarán con tu permiso y esta página se
            actualizará antes.
          </p>
        )}

        <h2 className="content-page__section-title">Cookies de marketing</h2>
        <p className="content-page__body-p">
          No usamos cookies de publicidad ni de remarketing.
        </p>

        <h2 className="content-page__section-title">Contenido de terceros</h2>
        <p className="content-page__body-p">
          Las imágenes de productos se sirven desde Cloudinary, un servicio de
          alojamiento de imágenes; al cargarlas, tu navegador se conecta a sus
          servidores (como ocurre con cualquier imagen alojada fuera del
          sitio). Los enlaces a WhatsApp e Instagram solo te llevan a esos
          servicios si haces clic.
        </p>

        <h2 className="content-page__section-title">Cómo gestionar tus preferencias</h2>
        <p className="content-page__body-p">
          Puedes revisar tus preferencias en cualquier momento desde{" "}
          <strong>&quot;Configurar cookies&quot;</strong> en el pie de página.
          También puedes borrar las cookies y el almacenamiento desde la
          configuración de tu navegador; si lo haces, se vaciará tu carrito.
        </p>

        <p className="content-page__body-p">
          <strong>
            [PLACEHOLDER — pendiente de revisión legal: datos de contacto
            formales para consultas sobre esta política]
          </strong>
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

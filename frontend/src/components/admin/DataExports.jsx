"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { HiOutlineDocumentText } from "react-icons/hi2";
import { exportNewsletterCsv, exportOrdersCsv, exportAbandonedCartsCsv } from "@/services/adminMarketingService";

const TOOLS = [
  { id: "orders", label: "Exportar pedidos (CSV)", action: exportOrdersCsv, href: "/admin/pedidos", context: "Pedidos" },
  { id: "newsletter", label: "Exportar newsletter (CSV)", action: exportNewsletterCsv, href: "/admin/marketing?tab=newsletter", context: "Newsletter" },
  { id: "carts", label: "Exportar carritos (CSV)", action: exportAbandonedCartsCsv, href: "/admin/marketing?tab=carritos", context: "Carritos" },
];

const COPY = {
  orders: {
    title: "Pedidos en CSV",
    text: "Número, nombre, correo, total, método de pago, estado del pago, estado del pedido y fecha.",
    scope: "Conjunto general autorizado. No aplica la bandeja ni los filtros del listado.",
    limit: "Hasta 5.000 pedidos, del más reciente al más antiguo.",
  },
  newsletter: {
    title: "Newsletter en CSV",
    text: "Correo, nombre, origen y evidencia de autorización de suscriptores activos.",
    scope: "Exportación histórica de newsletter.",
    limit: "Hasta 10.000 registros.",
  },
  carts: {
    title: "Carritos en CSV",
    text: "Correo, nombre, cantidad, subtotal, recordatorios y fecha de carritos no recuperados.",
    scope: "Exportación histórica de carritos.",
    limit: "Hasta 5.000 registros.",
  },
};

export default function DataExports({ scope = "all", embedded = false }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const tools = TOOLS.filter((tool) => scope === "all" || tool.id === scope);
  const run = async (tool) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(tool.id);
    setError("");
    try { await tool.action(); }
    catch { setError("No se pudo descargar la exportación. Inténtalo de nuevo."); }
    finally { lock.current = false; setBusy(null); }
  };
  if (embedded) {
    return <section aria-label="Exportaciones autorizadas">
      <p className="admin-muted">Contienen datos personales. Descárgalos solo para una tarea autorizada y consérvalos de forma segura. Se mantienen los límites de 5.000–10.000 registros.</p>
      {tools.map((tool) => <div key={tool.id} className="admin-context-nav">
        <button type="button" className="admin-btn" disabled={!!busy} onClick={() => run(tool)}>{busy === tool.id ? "Preparando archivo…" : tool.label}</button>
      </div>)}
      {error && <p role="alert">{error}</p>}
    </section>;
  }
  return <section aria-label="Exportaciones autorizadas" className="op-exports">
    <ul className="op-export-list">
      {tools.map((tool) => {
        const copy = COPY[tool.id];
        return <li key={tool.id} className="op-export-card">
          <span className="op-export-icon" aria-hidden="true"><HiOutlineDocumentText /></span>
          <div className="op-export-copy">
            <h2>{copy.title}</h2>
            <p>{copy.text}</p>
            <p className="op-export-meta">{copy.scope} {copy.limit}</p>
          </div>
          <div className="op-export-actions">
            <button type="button" className="op-btn op-btn--primary" disabled={!!busy} onClick={() => run(tool)}>{busy === tool.id ? "Preparando archivo…" : tool.label}</button>
            <Link href={tool.href}>Volver a {tool.context}</Link>
          </div>
        </li>;
      })}
    </ul>
    <p className="op-export-warn">Incluyen datos personales. Descárgalos solo para una tarea autorizada y consérvalos de forma segura.</p>
    {error && <p role="alert" className="op-notice op-notice--error">{error}</p>}
  </section>;
}

export function OrdersExportScreen() {
  return <div className="op-export">
    <header className="op-hero">
      <div className="op-hero__titles">
        <p className="op-eyebrow">Exportaciones de pedidos</p>
        <h1>Exportar pedidos</h1>
        <p className="op-lead">Descarga los registros autorizados de tu tienda.</p>
      </div>
    </header>
    <DataExports scope="orders" />
  </div>;
}

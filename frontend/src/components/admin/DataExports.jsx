"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { exportNewsletterCsv, exportOrdersCsv, exportAbandonedCartsCsv } from "@/services/adminMarketingService";
const TOOLS = [
  { id: "orders", label: "Exportar pedidos (CSV)", action: exportOrdersCsv, href: "/admin/pedidos", context: "Pedidos" },
  { id: "newsletter", label: "Exportar newsletter (CSV)", action: exportNewsletterCsv, href: "/admin/marketing?tab=newsletter", context: "Newsletter" },
  { id: "carts", label: "Exportar carritos (CSV)", action: exportAbandonedCartsCsv, href: "/admin/marketing?tab=carritos", context: "Carritos" },
];
export default function DataExports({ scope = "all", embedded = false }) {
  const [busy, setBusy] = useState(null), [error, setError] = useState("");
  const lock = useRef(false);
  const tools = TOOLS.filter(t => scope === "all" || t.id === scope);
  return <section aria-label="Exportaciones autorizadas" className={embedded ? undefined : "marketing-admin__card"}>
    {!embedded && <h2>Exportaciones{scope === "orders" ? " de pedidos" : ""}</h2>}
    <p className="admin-muted">Contienen datos personales. Descárgalos solo para una tarea autorizada y consérvalos de forma segura. Se mantienen los límites de 5.000–10.000 registros.</p>
    {tools.map(t => <div key={t.id} className="admin-context-nav"><button type="button" className="admin-btn" disabled={!!busy} onClick={async () => {
      if (lock.current) return; lock.current = true; setBusy(t.id); setError("");
      try { await t.action(); } catch { setError("No se pudo descargar la exportación. Inténtalo de nuevo."); }
      finally { lock.current = false; setBusy(null); }
    }}>{busy === t.id ? "Preparando archivo…" : t.label}</button>{!embedded && <Link href={t.href}>Volver a {t.context}</Link>}</div>)}
    {error && <p role="alert">{error}</p>}
  </section>;
}

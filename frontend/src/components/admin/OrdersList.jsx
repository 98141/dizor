"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getAdminOrders, exportOrdersPdf } from "@/services/orderAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, CARRIER_LABELS, SOURCE_LABELS, CHANNEL_ORIGIN_LABELS } from "@/lib/orderLabels";
import { TRAYS, formatOrderDate } from "@/lib/orderWorkspace";
import styles from "./OrderWorkspace.module.css";

export default function OrdersList(props) {
  return <Suspense fallback={<p role="status">Cargando pedidos…</p>}><OrdersWorkspace {...props} /></Suspense>;
}
function OrdersWorkspace({ basePath = "/admin/pedidos" }) {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const tray = params.get("tray") || "all";
  const [version, setVersion] = useState(0);
  const key = `${query}:${version}`;
  const [state, setState] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => {
    let active = true;
    getAdminOrders(Object.fromEntries(new URLSearchParams(query))).then((data) => {
      if (active) setState({ key, data });
    }).catch(() => { if (active) setState({ key, error: "No se pudieron cargar los pedidos. Tus filtros se conservaron." }); });
    return () => { active = false; };
  }, [key, query]);
  const loading = state?.key !== key;
  const data = loading ? null : state?.data;
  const error = !loading && state?.error;
  const href = (changes) => {
    const next = new URLSearchParams(query);
    Object.entries(changes).forEach(([name, value]) => value ? next.set(name, value) : next.delete(name));
    return `${basePath}${next.size ? `?${next}` : ""}`;
  };
  const applyFilters = (e) => {
    e.preventDefault();
    router.push(href({ ...Object.fromEntries(new FormData(e.currentTarget)), page: "" }));
  };
  const filtered = [...params.keys()].some((name) => !["tray", "page", "limit"].includes(name));
  const trays = { ...TRAYS, ...(data?.counts?.communications !== undefined || tray === "communications" ? { communications: "Comunicaciones" } : {}) };
  return <div className={styles.workspace}>
    <nav className={styles.trays} aria-label="Bandejas de pedidos">
      {Object.entries(trays).map(([name, label]) => <Link key={name} href={href({ tray: name, page: "" })} className={styles.tray} aria-current={tray === name ? "page" : undefined}>
        {label}<span>{data?.counts?.[name] ?? "—"}</span>
      </Link>)}
    </nav>
    <form key={query} className={styles.filters} onSubmit={applyFilters} aria-label="Filtrar pedidos">
      <label className={styles.search}>Número, cliente, correo o teléfono<input name="q" type="search" maxLength={160} defaultValue={params.get("q") || ""} placeholder="Ej. DIZ-20261120 o nombre" /></label>
      <label>Método de pago<select name="paymentMethod" defaultValue={params.get("paymentMethod") || ""}><option value="">Todos los métodos</option>{Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <details className={styles.advanced} open={["orderStatus", "paymentStatus", "from", "to", "carrier"].some((name) => params.get(name))}>
        <summary>Más filtros · estados, fechas y transportadora</summary><div className={styles.advancedFields}>
      <label>Estado del pedido<select name="orderStatus" defaultValue={params.get("orderStatus") || ""}><option value="">Todos los estados</option>{Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Estado del pago<select name="paymentStatus" defaultValue={params.get("paymentStatus") || ""}><option value="">Todos los pagos</option>{Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Desde (Colombia)<input name="from" type="date" defaultValue={params.get("from") || ""} /></label>
      <label>Hasta (Colombia)<input name="to" type="date" defaultValue={params.get("to") || ""} /></label>
      <label>Transportadora<select name="carrier" defaultValue={params.get("carrier") || ""}><option value="">Todas</option>{Object.entries(CARRIER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
      </details>
      <div className={styles.actions}><button className="admin-btn admin-btn--primary" type="submit">Aplicar filtros</button><Link className="admin-btn" href={`${basePath}?tray=${encodeURIComponent(tray)}`}>Limpiar filtros</Link></div>
    </form>
    <div className={styles.header}>
      <p className={styles.muted}>{data ? `${data.total} pedido${data.total === 1 ? "" : "s"} · ${trays[tray] || "Bandeja"}` : "Pedidos"}</p>
      <div className={styles.actions}>
        <button type="button" className="admin-btn" disabled={loading} onClick={() => setVersion((v) => v + 1)}>Actualizar pedidos</button>
        <button type="button" className="admin-btn" disabled={exporting || !data} onClick={async () => {
          setExporting(true); setExportError("");
          try { await exportOrdersPdf(Object.fromEntries(new URLSearchParams(query))); }
          catch { setExportError("No se pudo exportar el PDF. Inténtalo de nuevo."); }
          finally { setExporting(false); }
        }}>{exporting ? "Exportando…" : "Exportar PDF (máx. 500)"}</button>
      </div>
    </div>
    {exportError && <p role="alert" className={`${styles.notice} ${styles.error}`}>{exportError}</p>}
    {loading && <p role="status" className={styles.notice}>Cargando pedidos…</p>}
    {data && version > 0 && <p role="status" className={styles.muted}>Pedidos actualizados.</p>}
    {error && <div role="alert" className={`${styles.notice} ${styles.error}`}><p>{error}</p><button type="button" className="admin-btn" onClick={() => setVersion((v) => v + 1)}>Reintentar carga</button></div>}
    {data && data.orders.length === 0 && <p role="status" className={styles.notice}>{filtered ? "No hay coincidencias para estos filtros." : tray === "all" ? "Todavía no hay pedidos registrados." : "No hay pedidos pendientes en esta bandeja."}</p>}
    {data?.orders.length > 0 && <table className={styles.table}>
      <caption className={styles.eyebrow}>Pedidos · fechas en Colombia</caption>
      <thead><tr><th>Pedido / fecha</th><th>Cliente</th><th>Total / método</th><th>Operación / pago</th><th>Envío</th><th>Siguiente paso</th></tr></thead>
      <tbody>{data.orders.map((o) => <tr key={o.id}>
        <td><strong>{o.orderNumber}</strong><small>{formatOrderDate(o.createdAt)}</small>{o.source !== "web" && <small>{SOURCE_LABELS[o.source] || o.source}{o.channelOrigin ? ` · ${CHANNEL_ORIGIN_LABELS[o.channelOrigin] || o.channelOrigin}` : ""}</small>}</td>
        <td data-label="Cliente">{o.buyer?.name}<small className={styles.optional}>{o.buyer?.phone}</small></td>
        <td data-label="Total">{formatCOP(o.total)}<small>{PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod}</small></td>
        <td><span className={styles.badge}>{ORDER_STATUS_LABELS[o.orderStatus] || o.orderStatus}</span><small>Pago: {PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus}</small>{o.requiresReview && <span className={`${styles.badge} ${styles.attention}`}>Requiere revisión</span>}{o.communicationFailure && <span className={`${styles.badge} ${styles.attention}`}>Revisar comunicación</span>}</td>
        <td className={styles.optional}>{CARRIER_LABELS[o.carrier] || "Sin asignar"}<small>{o.trackingNumber || "Sin guía"}</small></td>
        <td><Link className="admin-btn" href={`${basePath}/${o.id}?returnTo=${encodeURIComponent(`${basePath}${query ? `?${query}` : ""}`)}`}>{o.operation?.primary?.label || "Ver pedido"}<span className="sr-only"> · {o.orderNumber}</span></Link></td>
      </tr>)}</tbody>
    </table>}
    {data?.totalPages > 1 && <nav className={styles.pagination} aria-label="Paginación de pedidos">
      {data.page > 1 ? <Link className="admin-btn" href={href({ page: data.page - 1 })}>Anterior</Link> : <span>Anterior</span>}
      <span>Página {data.page} de {data.totalPages}</span>
      {data.page < data.totalPages ? <Link className="admin-btn" href={href({ page: data.page + 1 })}>Siguiente</Link> : <span>Siguiente</span>}
    </nav>}
  </div>;
}

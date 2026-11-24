"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HiOutlineArrowPath, HiOutlineCheck, HiOutlineDocumentDuplicate } from "react-icons/hi2";
import { getAdminOrders, exportOrdersPdf } from "@/services/orderAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, CARRIER_LABELS, SOURCE_LABELS, CHANNEL_ORIGIN_LABELS } from "@/lib/orderLabels";
import { TRAYS } from "@/lib/orderWorkspace";
import { financePresentation, formatOrderListDate, isOperationalAction, orderStatusTone, shortenOrderNumber } from "@/lib/orderListPresentation.mjs";

const ADVANCED = ["orderStatus", "paymentStatus", "from", "to", "carrier"];

function OrderFilterForm({ params, advancedCount, filtered, clearHref, onApply }) {
  const [filtersOpen, setFiltersOpen] = useState(advancedCount > 0);
  return <form className={`op-filters${filtersOpen ? " is-open" : ""}`} onSubmit={onApply} aria-label="Filtrar pedidos">
    <div className="op-filterbar">
      <label className="op-field op-search">
        <span className="op-field__label">Buscar</span>
        <input name="q" type="search" maxLength={160} defaultValue={params.get("q") || ""} placeholder="Número, cliente, correo o teléfono" aria-label="Número, cliente, correo o teléfono" />
      </label>
      <label className="op-field op-pay">
        <span className="op-field__label">Método de pago</span>
        <select name="paymentMethod" defaultValue={params.get("paymentMethod") || ""}>
          <option value="">Todos los métodos</option>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <button type="button" className="op-btn" aria-expanded={filtersOpen} aria-controls="order-advanced-filters" onClick={() => setFiltersOpen((open) => !open)}>
        Filtros{advancedCount ? ` (${advancedCount})` : ""}
      </button>
      <button className="op-btn op-btn--primary op-apply" type="submit">Aplicar filtros</button>
    </div>
    <div id="order-advanced-filters" className={`op-advanced${filtersOpen ? " is-open" : ""}`}>
      <label className="op-field">Estado del pedido<select name="orderStatus" defaultValue={params.get("orderStatus") || ""}><option value="">Todos los estados</option>{Object.entries(ORDER_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="op-field">Estado del pago<select name="paymentStatus" defaultValue={params.get("paymentStatus") || ""}><option value="">Todos los pagos</option>{Object.entries(PAYMENT_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="op-field">Desde (Colombia)<input name="from" type="date" defaultValue={params.get("from") || ""} /></label>
      <label className="op-field">Hasta (Colombia)<input name="to" type="date" defaultValue={params.get("to") || ""} /></label>
      <label className="op-field">Transportadora<select name="carrier" defaultValue={params.get("carrier") || ""}><option value="">Todas</option>{Object.entries(CARRIER_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    {filtered && <p className="op-active"><span>Filtros activos</span><Link href={clearHref}>Limpiar filtros</Link></p>}
  </form>;
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const advancedCount = ADVANCED.filter((name) => params.get(name)).length;
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
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
  const applyFilters = (event) => {
    event.preventDefault();
    router.push(href({ ...Object.fromEntries(new FormData(event.currentTarget)), page: "" }));
  };
  const filtered = [...params.keys()].some((name) => !["tray", "page", "limit"].includes(name));
  const trays = { ...TRAYS, ...(data?.counts?.communications !== undefined || tray === "communications" ? { communications: "Comunicaciones" } : {}) };
  const allowCsv = basePath.startsWith("/admin");
  const listHref = `${basePath}${query ? `?${query}` : ""}`;
  const clearHref = `${basePath}?tray=${encodeURIComponent(tray)}`;
  const exportPdf = async () => {
    setExporting(true);
    setExportError("");
    try { await exportOrdersPdf(Object.fromEntries(new URLSearchParams(query))); }
    catch { setExportError("No se pudo exportar el PDF. Inténtalo de nuevo."); }
    finally { setExporting(false); setMenuOpen(false); }
  };
  return <div className="op-orders">
    <header className="op-hero">
      <div className="op-hero__titles">
        <h1>Pedidos</h1>
        <p className="op-lead">Gestiona, prepara y realiza seguimiento a las compras de tu tienda.</p>
      </div>
      <div className="op-hero__actions">
        <button type="button" className="op-btn" disabled={loading} onClick={() => setVersion((value) => value + 1)}>
          <HiOutlineArrowPath aria-hidden="true" />Actualizar
        </button>
        <div className="op-menu" ref={menuRef}>
          <button type="button" className="op-btn" aria-expanded={menuOpen} aria-controls="order-export-menu" onClick={() => setMenuOpen((open) => !open)}>Exportar</button>
          {menuOpen && <div id="order-export-menu" className="op-menu__panel" role="group" aria-label="Tipos de exportación">
            <button type="button" className="op-btn op-btn--primary" disabled={exporting || !data} onClick={exportPdf}>
              {exporting ? "Exportando…" : "Exportar PDF"}
            </button>
            <p>PDF operativo. Usa la bandeja y los filtros de esta pantalla. Máximo 500 pedidos.</p>
            {allowCsv && <>
              <Link className="op-btn" href="/admin/contenido?tab=exports&scope=orders">CSV general</Link>
              <p>Historial general autorizado. No usa la bandeja ni los filtros de este listado. Hasta 5.000 pedidos.</p>
            </>}
          </div>}
        </div>
      </div>
    </header>

    <div className="op-traybar">
      <nav className="op-trays" aria-label="Bandejas de pedidos">
        {Object.entries(trays).map(([name, label]) => <Link key={name} href={href({ tray: name, page: "" })} className="op-tray" aria-current={tray === name ? "page" : undefined}>
          <span>{label}</span><span className="op-tray__count">{data?.counts?.[name] ?? "—"}</span>
        </Link>)}
      </nav>
      <label className="op-field op-tray-select">
        <span className="op-field__label">Bandeja</span>
        <select aria-label="Bandeja de pedidos" value={trays[tray] ? tray : "all"} onChange={(event) => router.push(href({ tray: event.target.value, page: "" }))}>
          {Object.entries(trays).map(([name, label]) => <option key={name} value={name}>{label} ({data?.counts?.[name] ?? "—"})</option>)}
        </select>
      </label>
    </div>

    <OrderFilterForm key={query} params={params} advancedCount={advancedCount} filtered={filtered} clearHref={clearHref} onApply={applyFilters} />

    <div className="op-meta">
      <p>{data ? `${data.total} pedido${data.total === 1 ? "" : "s"} · ${trays[tray] || "Bandeja"}` : "Pedidos"}</p>
      {data && version > 0 && <p role="status">Pedidos actualizados.</p>}
    </div>
    {exportError && <p role="alert" className="op-notice op-notice--error">{exportError}</p>}
    {loading && <p role="status" className="op-notice">Cargando pedidos…</p>}
    {error && <div role="alert" className="op-notice op-notice--error"><p>{error}</p><button type="button" className="op-btn" onClick={() => setVersion((value) => value + 1)}>Reintentar carga</button></div>}
    {data && data.orders.length === 0 && <p role="status" className="op-notice">{filtered ? "No hay coincidencias para estos filtros." : tray === "all" ? "Todavía no hay pedidos registrados." : "No hay pedidos pendientes en esta bandeja."}</p>}
    {data?.orders.length > 0 && <div className="op-table-wrap">
      <table className="op-table">
        <caption>Pedidos · fechas en Colombia</caption>
        <thead><tr>
          <th scope="col">Pedido y fecha</th>
          <th scope="col">Cliente</th>
          <th scope="col">Total y método</th>
          <th scope="col">Estado</th>
          <th scope="col">Envío</th>
          <th scope="col">Siguiente acción</th>
        </tr></thead>
        <tbody>
          {data.orders.map((order) => {
            const finance = financePresentation(order);
            const statusLabel = ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus;
            const showFinance = finance.label.toLowerCase() !== String(statusLabel).toLowerCase();
            const detailHref = `${basePath}/${order.id}?returnTo=${encodeURIComponent(listHref)}`;
            const primary = order.operation?.primary;
            const actionable = isOperationalAction(primary?.code);
            const actionLabel = primary?.label || "Ver pedido";
            return <tr key={order.id}>
              <td className="op-cell op-cell--order">
                <span className="op-ref">
                  <Link className="op-ref__link" href={detailHref} title={order.orderNumber}>
                    <span aria-hidden="true">{shortenOrderNumber(order.orderNumber)}</span>
                    <span className="sr-only">Pedido {order.orderNumber}</span>
                  </Link>
                  <OrderRefButton value={order.orderNumber} />
                </span>
                <small className="op-date">{formatOrderListDate(order.createdAt)}</small>
                {order.source && order.source !== "web" && <small className="op-source">{SOURCE_LABELS[order.source] || order.source}{order.channelOrigin ? ` · ${CHANNEL_ORIGIN_LABELS[order.channelOrigin] || order.channelOrigin}` : ""}</small>}
              </td>
              <td className="op-cell op-cell--client" data-label="Cliente">
                <span className="op-buyer">{order.buyer?.name}</span>
                {order.buyer?.phone && <small className="op-phone">{order.buyer.phone}</small>}
              </td>
              <td className="op-cell op-cell--money" data-label="Total">
                <div className="op-cluster">
                  <strong className="op-total">{formatCOP(order.total)}</strong>
                  <span className="op-method">{PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</span>
                  {showFinance && <span className={`op-chip op-chip--${finance.tone} op-only-mobile`}>{finance.label}</span>}
                </div>
              </td>
              <td className="op-cell op-cell--status">
                <div className="op-cluster">
                  <span className={`op-chip op-chip--${orderStatusTone(order.orderStatus)}`}>{statusLabel}</span>
                  {showFinance && <span className={`op-chip op-chip--${finance.tone} op-only-desktop`}>{finance.label}</span>}
                  {order.requiresReview && <span className="op-chip op-chip--review">En revisión</span>}
                  {order.communicationFailure && <span className="op-chip op-chip--warn">Revisar comunicación</span>}
                </div>
              </td>
              <td className="op-cell op-cell--ship">
                <div className="op-cluster">
                  <span>{CARRIER_LABELS[order.carrier] || "Sin asignar"}</span>
                  <small>{order.trackingNumber || "Sin guía"}</small>
                </div>
              </td>
              <td className="op-cell op-cell--next">
                {actionable ? <Link className="op-action" href={detailHref}>{actionLabel}<span className="sr-only"> · {order.orderNumber}</span></Link>
                  : <span className="op-note"><span>{actionLabel}</span><Link href={detailHref}>Ver pedido<span className="sr-only"> · {order.orderNumber}</span></Link></span>}
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}
    {data?.totalPages > 1 && <nav className="op-pagination" aria-label="Paginación de pedidos">
      {data.page > 1 ? <Link className="op-btn" href={href({ page: String(data.page - 1) })}>Anterior</Link> : <span className="op-page-muted">Anterior</span>}
      <span>Página {data.page} de {data.totalPages}</span>
      {data.page < data.totalPages ? <Link className="op-btn" href={href({ page: String(data.page + 1) })}>Siguiente</Link> : <span className="op-page-muted">Siguiente</span>}
    </nav>}
  </div>;
}

function OrderRefButton({ value }) {
  const [copied, setCopied] = useState("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied("ok"); }
    catch { setCopied("error"); }
    window.setTimeout(() => setCopied(""), 2000);
  };
  return <>
    <button type="button" className="op-icon-btn" onClick={copy} aria-label={`Copiar número de pedido ${value}`} title="Copiar número completo">
      {copied === "ok" ? <HiOutlineCheck aria-hidden="true" /> : <HiOutlineDocumentDuplicate aria-hidden="true" />}
    </button>
    <span className="sr-only" role="status">{copied === "ok" ? "Número copiado" : copied === "error" ? "No se pudo copiar el número" : ""}</span>
  </>;
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminDashboard } from "@/services/adminDashboardService";
import { getOrderStats } from "@/services/orderAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import { formatOrderDate } from "@/lib/orderWorkspace";
import { ORDER_STATUS_LABELS } from "@/lib/orderLabels";
import styles from "./OrderWorkspace.module.css";
const TASKS = [
  ["prepare", "Listos para preparar", "Iniciar preparación"],
  ["dispatch", "Pendientes de despacho", "Registrar transportadora y guía"],
  ["review", "Pedidos con incidencias", "Revisar antes de continuar"],
  ["collection", "Entregados por recaudar", "Confirmación de la transportadora"],
  ["communications", "Comunicaciones por revisar", "Recuperar mensajes pendientes"],
];
export default function AdminDashboard({ vendor = false }) {
  const [version, setVersion] = useState(0);
  const key = `${vendor}:${version}`;
  const [state, setState] = useState(null);
  useEffect(() => {
    let active = true;
    (vendor ? getOrderStats() : getAdminDashboard()).then((result) => {
      if (active) setState({ key, data: vendor ? { attention: result.counts } : result.dashboard });
    }).catch(() => { if (active) setState({ key, error: "No se pudo cargar la operación de pedidos. Los contadores no están disponibles." }); });
    return () => { active = false; };
  }, [key, vendor]);
  const data = state?.key === key && state?.data;
  const error = state?.key === key && state?.error;
  const loading = state?.key !== key;
  const base = vendor ? "/vendedor/pedidos" : "/admin/pedidos";
  return <div className={styles.workspace}>
    <header className={styles.header}><div><p className={styles.eyebrow}>DIZOR · Operación diaria</p><h1>{vendor ? "Panel vendedor" : "Resumen de pedidos"}</h1><p className={styles.muted}>Empieza por los pedidos que necesitan una acción.</p></div><div className={styles.actions}><Link href={base} className="admin-btn">Todos los pedidos</Link><button type="button" className="admin-btn" disabled={loading} onClick={() => setVersion((v) => v + 1)}>Actualizar resumen</button></div></header>
    {loading && <p className={styles.notice} role="status">Cargando operación de pedidos…</p>}
    {error && <div className={`${styles.notice} ${styles.error}`} role="alert"><p>{error}</p><button className="admin-btn" type="button" onClick={() => setVersion((v) => v + 1)}>Reintentar carga</button></div>}
    {data && <>
      <section aria-labelledby="attention-title"><h2 id="attention-title">Requieren atención</h2><p className={styles.muted}>Un pedido puede requerir más de una revisión. Cada tarjeta lo cuenta una sola vez.</p><div className={styles.tasks}>
        {TASKS.filter(([key]) => !vendor || key !== "communications").map(([key, label, hint]) => <Link key={key} className={styles.task} href={`${base}?tray=${key}`}><strong>{data.attention[key]}</strong><span>{label}</span><small>{vendor && key === "collection" ? "Consulta; el recaudo lo registra un administrador" : hint}</small></Link>)}
      </div></section>
      <div className={styles.actions}><Link className="admin-btn" href={`${base}?tray=transit`}>Ver pedidos en camino</Link><Link className="admin-btn" href={vendor ? "/admin/solicitudes" : "/admin/alertas"}>{vendor ? "Gestionar solicitudes especiales" : "Otras alertas"}</Link>{!vendor && <Link className="admin-btn" href="/admin/auditoria">Historial de auditoría</Link>}</div>
      {!vendor && <section aria-labelledby="activity-title"><h2 id="activity-title">Actividad comercial</h2><p className={styles.muted}>Fechas en Colombia. Las ventas del mes excluyen pedidos cerrados e incidencias activas.</p><div className={styles.metrics}>
        <div><strong>{data.orders.ordersToday}</strong><span>Pedidos de hoy</span></div>
        <div><strong>{formatCOP(data.orders.revenueMonth)}</strong><span>Ventas conciliadas del mes</span></div>
        <div><strong>{data.orders.shippedToday}</strong><span>Despachos registrados hoy</span></div>
        <div><strong>{data.deliveredToday}</strong><span>Entregas registradas hoy</span></div>
      </div></section>}
      {!vendor && <section className={styles.panel} aria-labelledby="recent-title"><div className={styles.header}><h2 id="recent-title">Pedidos recientes</h2><Link href={base}>Consultar todos</Link></div>{data.operationalOrders.length ? <ul className={styles.list}>{data.operationalOrders.map((o) => <li key={o.id}><div className={styles.header}><div><strong>{o.orderNumber}</strong> · {o.buyer?.name}<p className={styles.muted}>{formatOrderDate(o.createdAt)} · {ORDER_STATUS_LABELS[o.orderStatus]}</p></div><Link className="admin-btn" href={`${base}/${o.id}?returnTo=${encodeURIComponent(base)}`}>{o.operation.primary.label}</Link></div></li>)}</ul> : <p>No hay pedidos registrados.</p>}</section>}
    </>}
  </div>;
}

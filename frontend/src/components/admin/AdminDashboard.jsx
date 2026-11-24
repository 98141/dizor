"use client";
// Admin home (Sprint 01 · Operativo Premium Híbrido).
// - Operational tasks: current state from the backend classification (never the period).
// - Commercial analytics: read-only endpoint, admins only; the vendor never requests it.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HiOutlineArchiveBox, HiOutlineTruck, HiOutlineExclamationTriangle, HiOutlineBanknotes, HiOutlineEnvelope, HiOutlineArrowPath,
  HiOutlineReceiptPercent, HiOutlineShoppingBag, HiOutlineCube, HiOutlineArrowRight } from "react-icons/hi2";
import { getAdminDashboard, getDashboardAnalytics } from "@/services/adminDashboardService";
import { getOrderStats } from "@/services/orderAdminService";
import { formatCOP } from "@/lib/formatCurrency";
import { readPeriod, apiParams, periodQuery, PERIOD_STORAGE_KEY, formatRange, formatCivilDate, formatNumber } from "@/lib/dashboardPeriod";
import { DashboardSection, DashboardCard, DashboardMetricCard, DashboardStateNotice, DeltaBadge } from "./dashboard/DashboardUI";
import DashboardPeriodFilter from "./dashboard/DashboardPeriodFilter";
import { SalesTrendChart, OrderDistribution } from "./dashboard/DashboardCharts";
import ProductPerformance from "./dashboard/ProductPerformance";
import RecentOrders from "./dashboard/RecentOrders";

const TASKS = [
  { key: "prepare", label: "Listos para preparar", hint: "Pago verificado o contraentrega", icon: HiOutlineArchiveBox, tone: "accent", badge: "Por hacer" },
  { key: "dispatch", label: "Pendientes de despacho", hint: "Registrar transportadora y guía", icon: HiOutlineTruck, tone: "accent", badge: "Por hacer" },
  { key: "review", label: "Pedidos con incidencias", hint: "Revisar antes de continuar", icon: HiOutlineExclamationTriangle, tone: "danger", badge: "Prioridad alta" },
  { key: "collection", label: "Entregados por recaudar", hint: "Confirmación de la transportadora", icon: HiOutlineBanknotes, tone: "warning", badge: "Seguimiento" },
  { key: "communications", label: "Comunicaciones por revisar", hint: "Recuperar mensajes pendientes", icon: HiOutlineEnvelope, tone: "warning", badge: "Revisar" },
];
const GRANULARITY = { hour: "por hora", day: "por día", week: "por semana (lunes a domingo)", month: "por mes" };
const validAnalytics = (a) => !!(a && a.period && a.sales && Array.isArray(a.series) && a.distribution && a.products && a.inventory);
// Stored period of this browser session, only when it differs from the default one.
const storedPeriod = () => {
  let stored = null;
  try { stored = sessionStorage.getItem(PERIOD_STORAGE_KEY); } catch { /* storage unavailable */ }
  return stored && stored !== periodQuery(readPeriod(new URLSearchParams(""))) ? periodQuery(readPeriod(new URLSearchParams(stored))) : null;
};
const timeText = (d) => d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });

export default function AdminDashboard({ vendor = false }) {
  const params = useSearchParams(), router = useRouter(), pathname = usePathname();
  const base = vendor ? "/vendedor/pedidos" : "/admin/pedidos";
  const hasPeriod = params.has("periodo");
  const period = readPeriod(params), query = periodQuery(period);

  // Restore the last period of this session when returning to Inicio without one in the URL.
  useEffect(() => {
    if (vendor) return;
    if (hasPeriod) { try { sessionStorage.setItem(PERIOD_STORAGE_KEY, query); } catch { /* storage unavailable */ } return; }
    const stored = storedPeriod();
    if (stored) router.replace(`${pathname}?${stored}`, { scroll: false });
  }, [vendor, hasPeriod, query, pathname, router]);

  const [opsVersion, setOpsVersion] = useState(0), [anVersion, setAnVersion] = useState(0);
  const opsKey = `${vendor}:${opsVersion}`, anKey = `${query}:${anVersion}`;
  const [ops, setOps] = useState(null), [an, setAn] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => (vendor ? getOrderStats() : getAdminDashboard())).then((result) => {
      const data = vendor ? { attention: result?.counts } : result?.dashboard;
      if (!data?.attention) throw new Error("Respuesta incompleta");
      if (active) setOps({ key: opsKey, data, at: new Date() });
    }).catch(() => { if (active) setOps({ key: opsKey, error: "No se pudo cargar la operación de pedidos. Los contadores no están disponibles." }); });
    return () => { active = false; };
  }, [opsKey, vendor]);
  useEffect(() => {
    if (vendor || (!hasPeriod && storedPeriod())) return undefined; // the stored period is restored first
    let active = true;
    // Promise wrapper: even a synchronous failure becomes the error state of this block only.
    Promise.resolve().then(() => getDashboardAnalytics(apiParams(readPeriod(new URLSearchParams(anKey.split(":")[0]))))).then((result) => {
      if (!validAnalytics(result?.analytics)) throw new Error("Respuesta incompleta");
      if (active) setAn({ key: anKey, data: result.analytics, at: new Date() });
    }).catch((error) => { if (active) setAn({ key: anKey, error: error?.response?.status === 400 && error.response.data?.message ? error.response.data.message : "No se pudieron cargar los indicadores comerciales. Las tareas operativas no se ven afectadas." }); });
    return () => { active = false; };
  }, [anKey, vendor, hasPeriod]);

  const opsData = ops?.key === opsKey ? ops.data : null, opsError = ops?.key === opsKey ? ops.error : null, opsLoading = ops?.key !== opsKey;
  const anCurrent = an?.key === anKey ? an : null;
  const analytics = anCurrent?.data || null, anError = anCurrent?.error || null, anLoading = !anCurrent;
  const stale = anLoading ? (an?.data || null) : null; // previous render kept, dimmed, while refetching
  const shown = analytics || stale;
  const refresh = () => { setOpsVersion((v) => v + 1); if (!vendor) setAnVersion((v) => v + 1); };
  const changePeriod = (next) => router.replace(`${pathname}?${periodQuery(next)}`, { scroll: false });
  const updatedAt = [ops?.at, an?.at].filter(Boolean).sort((a, b) => b - a)[0];

  const periodText = shown ? `${shown.period.key === "custom" ? "Rango personalizado" : shown.period.label} · ${formatRange(shown.period.from, shown.period.to)}` : "";
  const comparison = shown?.sales.comparison;
  const previousLabel = comparison?.available ? formatRange(comparison.previousFrom, comparison.previousTo) : "";

  return <div className="dz-page">
    <header className="dz-hero">
      <div className="dz-hero__titles">
        <p className="dz-eyebrow">{vendor ? "Inicio · Vendedor" : "Inicio · Operación y ventas"}</p>
        <h1>{vendor ? "Panel vendedor" : "Resumen general"}</h1>
        <p className="dz-lead">{vendor ? "Empieza por los pedidos que necesitan una acción." : "Pedidos, ventas y actividad de tu tienda en un solo lugar."}</p>
      </div>
      <div className="dz-hero__actions">
        <Link href={base} className="dz-btn"><HiOutlineShoppingBag aria-hidden="true" />Ver pedidos</Link>
        <button type="button" className="dz-btn dz-btn--primary" disabled={opsLoading && !opsError} onClick={refresh}><HiOutlineArrowPath aria-hidden="true" />Actualizar resumen</button>
      </div>
      {!vendor && <div className="dz-hero__period">
        <DashboardPeriodFilter key={query} period={period} onChange={changePeriod} />
        <p className="dz-hero__meta">
          {periodText ? <><strong>{periodText}</strong> · aplica a ventas, gráficas y productos</> : "Aplica a ventas, gráficas y productos"}
          {updatedAt && <span> · Actualizado {timeText(updatedAt)}</span>}
        </p>
      </div>}
    </header>

    <DashboardSection id="dz-attention" eyebrow="Resumen de pedidos · estado actual" title="Requieren atención"
      description={`Estado actual de la operación; no depende del periodo seleccionado. Un pedido puede requerir más de una revisión.`}
      actions={<>
        {opsData?.attention?.transit !== undefined && <Link className="dz-link" href={`${base}?tray=transit`}>En camino · {formatNumber(opsData.attention.transit)}</Link>}
        {vendor ? <Link className="dz-link" href="/admin/solicitudes">Gestionar solicitudes especiales</Link>
          : <><Link className="dz-link" href="/admin/alertas">Otras alertas</Link><Link className="dz-link" href="/admin/auditoria">Historial de auditoría</Link></>}
      </>}>
      {opsLoading && !opsError && <div className="dz-tasks" aria-busy="true">{TASKS.filter((t) => !vendor || t.key !== "communications").map((t) => <div key={t.key} className="dz-metric dz-skeleton" />)}<p className="dz-sr-only" role="status">Cargando operación de pedidos…</p></div>}
      {opsError && <DashboardStateNotice tone="error" onRetry={() => setOpsVersion((v) => v + 1)} retryLabel="Reintentar carga">{opsError}</DashboardStateNotice>}
      {opsData && <div className={`dz-tasks ${vendor ? "dz-tasks--four" : ""}`}>
        {TASKS.filter((t) => !vendor || t.key !== "communications").map((t) => {
          const count = opsData.attention[t.key] ?? 0;
          return <DashboardMetricCard key={t.key} href={`${base}?tray=${t.key}`} icon={t.icon} value={formatNumber(count)} label={t.label}
            hint={vendor && t.key === "collection" ? "Consulta; el recaudo lo registra un administrador" : t.hint}
            tone={count ? t.tone : "calm"} badge={count ? t.badge : "Al día"} className="dz-task" />;
        })}
      </div>}
    </DashboardSection>

    {!vendor && <DashboardSection id="dz-commerce" eyebrow={periodText || "Periodo de análisis"} title="Indicadores comerciales"
      description="Ventas conciliadas: pedidos pagados, sin cancelación, devolución, reembolso ni incidencias activas. Se asignan a la fecha de creación del pedido (hora de Colombia), igual que en Finanzas.">
      {anError && <DashboardStateNotice tone="error" onRetry={() => setAnVersion((v) => v + 1)} retryLabel="Reintentar indicadores">{anError}</DashboardStateNotice>}
      {!shown && anLoading && <div className="dz-kpis" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="dz-metric dz-skeleton" />)}<p className="dz-sr-only" role="status">Cargando indicadores comerciales…</p></div>}
      {shown && !anError && <div className={`dz-commerce ${stale ? "is-stale" : ""}`} aria-busy={stale ? "true" : undefined}>
        <div className="dz-kpis" aria-busy={stale ? "true" : undefined}>
          <DashboardMetricCard icon={HiOutlineBanknotes} label="Ventas conciliadas" value={formatCOP(shown.sales.reconciledSales)}
            hint={`${formatNumber(shown.sales.reconciledOrders)} ${shown.sales.reconciledOrders === 1 ? "pedido conciliado" : "pedidos conciliados"}`}
            delta={<DeltaBadge metric={comparison?.metrics?.reconciledSales} previousLabel={previousLabel} />} />
          <DashboardMetricCard icon={HiOutlineShoppingBag} label="Pedidos registrados" value={formatNumber(shown.sales.ordersRegistered)}
            hint="Creados en el periodo, en cualquier estado" delta={<DeltaBadge metric={comparison?.metrics?.ordersRegistered} previousLabel={previousLabel} />} />
          <DashboardMetricCard icon={HiOutlineReceiptPercent} label="Ticket promedio" value={shown.sales.averageTicket == null ? "Sin ventas conciliadas" : formatCOP(shown.sales.averageTicket)}
            hint="Ventas conciliadas ÷ pedidos conciliados" className={shown.sales.averageTicket == null ? "dz-metric--novalue" : ""}
            delta={<DeltaBadge metric={comparison?.metrics?.averageTicket} previousLabel={previousLabel} />} />
          <DashboardMetricCard icon={HiOutlineCube} label="Unidades vendidas" value={formatNumber(shown.sales.unitsSold)}
            hint="En pedidos conciliados" delta={<DeltaBadge metric={comparison?.metrics?.unitsSold} previousLabel={previousLabel} />} />
        </div>
        <p className="dz-footnote">{comparison?.available
          ? `Variación frente a ${previousLabel}: mismo número de días y horas transcurridas.`
          : `Sin comparación: ${(comparison?.reason || "no hay un periodo anterior equivalente.").replace(/^./, (c) => c.toLowerCase())}`}
          {shown.history?.firstOrderAt && shown.history.firstOrderAt > shown.period.start && ` El historial de pedidos comienza el ${formatCivilDate(new Date(shown.history.firstOrderAt).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }))}.`}
        </p>
        <div className="dz-charts">
          <DashboardCard id="dz-trend-title" title="Evolución de ventas conciliadas" subtitle={`COP ${GRANULARITY[shown.period.granularity]} · ${periodText}`} className="dz-charts__main">
            <SalesTrendChart key={shown.period.from + shown.period.to + shown.period.granularity} series={shown.series} granularity={shown.period.granularity} />
          </DashboardCard>
          <DashboardCard id="dz-dist-title" title="Pedidos por estado" subtitle="Creados en el periodo · estado actual">
            <OrderDistribution distribution={shown.distribution} />
          </DashboardCard>
        </div>
      </div>}
    </DashboardSection>}

    {!vendor && shown && !anError && <DashboardSection id="dz-products" eyebrow="Catálogo" title="Rendimiento de productos"
      description="Ventas por producto a partir de los pedidos conciliados del periodo (todas sus variantes juntas). El inventario muestra el estado actual de cada variante.">
      <div className={stale ? "is-stale" : ""}><ProductPerformance products={shown.products} inventory={shown.inventory} periodText={periodText} /></div>
    </DashboardSection>}

    {!vendor && opsData && <DashboardSection id="dz-recent" eyebrow="Actividad reciente" title="Pedidos recientes"
      description="Los más recientes primero. La acción indicada es la siguiente operación que permite el sistema."
      actions={<Link className="dz-link" href={base}>Consultar todos<HiOutlineArrowRight aria-hidden="true" /></Link>}>
      <RecentOrders orders={opsData.operationalOrders || []} base={base} />
    </DashboardSection>}
  </div>;
}

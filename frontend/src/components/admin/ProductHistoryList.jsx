"use client";
import { Fragment, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getProductHistory, getProductHistoryStats, exportProductHistoryPdf } from "@/services/productHistoryService";
import { movementLabel } from "@/lib/catalogWorkspace";
import { formatOrderDate } from "@/lib/orderWorkspace";
import { getProductEventLabel } from "@/lib/productHistoryLabels";

const shortDate = (value) => value ? new Date(value).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" }) : "Sin fecha registrada";
const units = (n) => `${n > 0 ? "+" : ""}${n || "—"} ${Math.abs(n) === 1 ? "unidad" : "unidades"}`;

export default function ProductHistoryList(){return <Suspense fallback={<p role="status">Cargando movimientos…</p>}><History /></Suspense>;}
function History(){
  const params=useSearchParams(),pathname=usePathname(),router=useRouter(),query=params.toString();
  const [version,setVersion]=useState(0),[state,setState]=useState(null),[stats,setStats]=useState(null),[statsError,setStatsError]=useState(false),[exporting,setExporting]=useState(false),[exportError,setExportError]=useState(""),[openId,setOpenId]=useState(null);
  const key=`${query}:${version}`;
  useEffect(()=>{let active=true;getProductHistory(Object.fromEntries(new URLSearchParams(query))).then(data=>{if(active)setState({key,data});}).catch(()=>{if(active)setState({key,error:"No se pudieron cargar los movimientos. Conservamos tus filtros."});});return()=>{active=false;};},[key,query]);
  useEffect(()=>{let active=true;getProductHistoryStats().then(r=>{if(active){setStats(r.stats);setStatsError(false);}}).catch(()=>{if(active)setStatsError(true);});return()=>{active=false;};},[version]);
  const loading=state?.key!==key,data=loading?null:state?.data;
  const href=(changes)=>{const next=new URLSearchParams(query);Object.entries(changes).forEach(([k,v])=>v?next.set(k,v):next.delete(k));return `${pathname}?${next}`;};
  return <section className="op-history" aria-labelledby="movement-title">
    <div className="op-toolbar"><h2 id="movement-title">Historial</h2><button type="button" className="op-btn" disabled={loading} onClick={()=>setVersion(n=>n+1)}>Actualizar movimientos</button></div>
    <HistoryFilters key={query} params={params} data={data} pathname={pathname} onSubmit={(values) => router.push(href({ ...values, page: "", ...(values.productId !== (params.get("productId") || "") ? { variantId: "" } : {}) }))} />
    {params.get("variantId")&&<p className="op-notice">Historial de la variante seleccionada. <Link href={href({variantId:""})}>Ver todas las variantes del producto</Link></p>}
    <div className="op-toolbar"><p>{data?`${data.total} registros`:"Registros"}</p><button type="button" className="op-btn" disabled={exporting||!data} onClick={async()=>{setExporting(true);setExportError("");try{await exportProductHistoryPdf(Object.fromEntries(new URLSearchParams(query)));}catch{setExportError("No se pudo generar el PDF. Puedes volver a intentarlo.");}finally{setExporting(false);}}}>{exporting?"Generando PDF…":"Exportar PDF (máx. 5000)"}</button></div>
    {exportError&&<p role="alert" className="op-alert">{exportError}</p>}
    {loading&&<p role="status" className="op-notice">Cargando movimientos…</p>}
    {!loading&&state?.error&&<div role="alert" className="op-notice op-notice--bad"><p>{state.error}</p><button type="button" className="op-btn" onClick={()=>setVersion(n=>n+1)}>Reintentar movimientos</button></div>}
    {data?.history.length===0&&<p role="status" className="op-notice">{data.total>0?<>No hay registros en esta página. <Link href={href({page:"1"})}>Volver a primera página</Link></>:"No hay movimientos registrados con estos filtros. No se reconstruyen movimientos antiguos que no tengan evidencia."}</p>}
    {data?.history.length>0&&<div className="op-table-wrap"><table className="op-move-table"><caption>Movimientos registrados · no modificables</caption><thead><tr><th>Movimiento</th><th>Cantidad</th><th>Fecha</th><th>Detalle</th></tr></thead><tbody>{data.history.map(row=>{
      const open=openId===row.id;
      const who=row.userEmail||(row.userId?"Responsable registrado":row.role==="system"?"Sistema":"Responsable no registrado");
      return <Fragment key={row.id}>
        <tr className={open?"is-open":undefined}>
          <td data-label="Movimiento"><strong>{row.productName}</strong><small>{movementLabel(row)} · {[row.sizeName,row.colorName].filter(Boolean).join(" / ")||"Sin talla/color registrados"}</small><small>{row.summary}</small><small>{who}</small></td>
          <td data-label="Cantidad"><strong className={row.quantityChange<0?"op-delta op-delta--down":"op-delta"}>{units(row.quantityChange)}</strong></td>
          <td data-label="Fecha">{shortDate(row.createdAt)}</td>
          <td data-label="Detalle"><button type="button" className="op-btn" aria-expanded={open} aria-controls={`movement-${row.id}`} onClick={()=>setOpenId(open?null:row.id)}>{open?"Ocultar detalle":"Ver detalle"}</button></td>
        </tr>
        {open&&<tr className="op-move-detail"><td id={`movement-${row.id}`} colSpan={4}>
          <dl>
            <div><dt>SKU histórico</dt><dd>{row.sku||"Sin SKU registrado"}</dd></div>
            <div><dt>Saldo anterior</dt><dd>{row.stockBefore??"sin registro"}</dd></div>
            <div><dt>Saldo posterior</dt><dd>{row.stockAfter??"sin registro"}</dd></div>
            <div><dt>Responsable</dt><dd>{who}</dd></div>
            <div><dt>Motivo</dt><dd>{row.summary}</dd></div>
            <div><dt>Origen</dt><dd>{row.referenceLabel||row.referenceType||"Sin origen registrado"}</dd></div>
            <div><dt>Fecha completa</dt><dd>{formatOrderDate(row.createdAt)}</dd></div>
          </dl>
          {row.productId&&<Link className="op-quiet" href={`/admin/productos?view=stock&productId=${row.productId}${row.variantId?`&variantId=${row.variantId}`:""}`}>Consultar existencias</Link>}
        </td></tr>}
      </Fragment>;
    })}</tbody></table></div>}
    {data?.totalPages>1&&<nav className="op-pager" aria-label="Páginas de movimientos">{data.page>1&&<Link className="op-btn" href={href({page:data.page-1})}>Anterior</Link>}<span>Página {data.page} de {data.totalPages}</span>{data.page<data.totalPages&&<Link className="op-btn" href={href({page:data.page+1})}>Siguiente</Link>}</nav>}
    <details className="op-stats"><summary>Resumen general de registros</summary>{statsError?<p>Los indicadores generales no están disponibles.</p>:stats?<div className="op-metrics"><div><strong>{stats.total}</strong><span>Registros totales</span></div><div><strong>{stats.today}</strong><span>Registros de hoy</span></div><div><strong>{stats.unitsSoldToday}</strong><span>Unidades vendidas hoy</span></div><div><strong>{stats.stockAdjustmentsToday}</strong><span>Ajustes registrados hoy</span></div></div>:<p role="status">Cargando indicadores…</p>}</details>
  </section>;
}

function HistoryFilters({ params, data, pathname, onSubmit }) {
  const advancedKeys = ["productId", "eventType", "userId", "from", "to"];
  const [draft, setDraft] = useState(() => Object.fromEntries(["term", "productId", "movementKind", "eventType", "userId", "from", "to"].map((key) => [key, params.get(key) || ""])));
  const [advanced, setAdvanced] = useState(advancedKeys.some((key) => params.get(key)));
  const field = (key) => ({ name: key, value: draft[key], onChange: (e) => setDraft((old) => ({ ...old, [key]: e.target.value })) });
  const active = ["term", "movementKind", ...advancedKeys].some((key) => params.get(key));
  return <form className={`op-filters${advanced ? " is-open" : ""}`} aria-label="Filtrar movimientos" onSubmit={(e) => { e.preventDefault(); onSubmit(draft); }}>
    <div className="op-filterbar">
      <label className="op-field op-search">Producto, SKU, pedido o motivo<input type="search" {...field("term")} maxLength={160} /></label>
      <label className="op-field">Tipo de movimiento<select {...field("movementKind")}><option value="">Todos</option><option value="restock">Reposición</option><option value="withdrawal">Retiro administrativo</option><option value="sale">Venta</option><option value="restoration">Restauración por pedido</option><option value="other">Otros registros</option></select></label>
      <button type="button" className="op-btn" aria-expanded={advanced} aria-controls="history-advanced-filters" onClick={() => setAdvanced((open) => !open)}>Filtros</button>
      <button type="submit" className="op-btn op-btn--primary">Aplicar filtros de movimientos</button>
    </div>
    <div id="history-advanced-filters" className={`op-advanced${advanced ? " is-open" : ""}`}>
      <label className="op-field">Producto<select {...field("productId")}><option value="">Todos</option>{draft.productId && !(data?.filters.products || []).some((p) => p.id === draft.productId) && <option value={draft.productId}>Producto seleccionado</option>}{(data?.filters.products || []).filter((p) => p.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="op-field">Tipo de registro histórico<select {...field("eventType")}><option value="">Todos</option>{(data?.filters.eventTypes || []).map((t) => <option key={t} value={t}>{getProductEventLabel(t)}</option>)}</select></label>
      <label className="op-field">Responsable<select {...field("userId")}><option value="">Todos</option>{draft.userId && !(data?.filters.actors || []).some((a) => a.id === draft.userId) && <option value={draft.userId}>Responsable seleccionado</option>}{(data?.filters.actors || []).map((a) => <option key={a.id} value={a.id}>{a.email || "Personal registrado"}</option>)}</select></label>
      <label className="op-field">Desde (Colombia)<input type="date" {...field("from")} /></label>
      <label className="op-field">Hasta (Colombia)<input type="date" {...field("to")} /></label>
    </div>
    {active && <p className="op-active"><span>Filtros activos</span><Link href={`${pathname}?view=movements`}>Limpiar filtros</Link></p>}
  </form>;
}

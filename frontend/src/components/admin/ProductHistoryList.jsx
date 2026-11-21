"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getProductHistory, getProductHistoryStats, exportProductHistoryPdf } from "@/services/productHistoryService";
import { movementLabel } from "@/lib/catalogWorkspace";
import { formatOrderDate } from "@/lib/orderWorkspace";
import { getProductEventLabel } from "@/lib/productHistoryLabels";
import styles from "./CatalogWorkspace.module.css";
export default function ProductHistoryList(){return <Suspense fallback={<p role="status">Cargando movimientos…</p>}><History /></Suspense>;}
function History(){
  const params=useSearchParams(),pathname=usePathname(),router=useRouter(),query=params.toString();
  const [version,setVersion]=useState(0),[state,setState]=useState(null),[stats,setStats]=useState(null),[statsError,setStatsError]=useState(false),[exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
  const key=`${query}:${version}`;
  useEffect(()=>{let active=true;getProductHistory(Object.fromEntries(new URLSearchParams(query))).then(data=>{if(active)setState({key,data});}).catch(()=>{if(active)setState({key,error:"No se pudieron cargar los movimientos. Conservamos tus filtros."});});return()=>{active=false;};},[key,query]);
  useEffect(()=>{let active=true;getProductHistoryStats().then(r=>{if(active){setStats(r.stats);setStatsError(false);}}).catch(()=>{if(active)setStatsError(true);});return()=>{active=false;};},[version]);
  const loading=state?.key!==key,data=loading?null:state?.data;
  const href=(changes)=>{const next=new URLSearchParams(query);Object.entries(changes).forEach(([k,v])=>v?next.set(k,v):next.delete(k));return `${pathname}?${next}`;};
  return <section className={styles.stack} aria-labelledby="movement-title">
    <div className={styles.header}><div><h2 id="movement-title">Movimientos e historial</h2><p className={styles.muted}>Solo lectura · conserva ventas, ajustes y registros históricos. Fechas en Colombia.</p></div><button type="button" className="admin-btn" disabled={loading} onClick={()=>setVersion(n=>n+1)}>Actualizar movimientos</button></div>
    <HistoryFilters key={query} params={params} data={data} pathname={pathname} onSubmit={(values) => router.push(href({ ...values, page: "", ...(values.productId !== (params.get("productId") || "") ? { variantId: "" } : {}) }))} />
    {params.get("variantId")&&<p className={styles.notice}>Historial de la variante seleccionada. <Link href={href({variantId:""})}>Ver todas las variantes del producto</Link></p>}
    <div className={styles.header}><p>{data?`${data.total} registros`:"Registros"}</p><button type="button" className="admin-btn" disabled={exporting||!data} onClick={async()=>{setExporting(true);setExportError("");try{await exportProductHistoryPdf(Object.fromEntries(new URLSearchParams(query)));}catch{setExportError("No se pudo generar el PDF. Puedes volver a intentarlo.");}finally{setExporting(false);}}}>{exporting?"Generando PDF…":"Exportar PDF (máx. 5000)"}</button></div>
    {exportError&&<p role="alert" className={styles.error}>{exportError}</p>}
    {loading&&<p role="status">Cargando movimientos…</p>}
    {!loading&&state?.error&&<div role="alert" className={styles.error}><p>{state.error}</p><button type="button" className="admin-btn" onClick={()=>setVersion(n=>n+1)}>Reintentar movimientos</button></div>}
    {data?.history.length===0&&<p role="status">{data.total>0?<>No hay registros en esta página. <Link href={href({page:"1"})}>Volver a primera página</Link></>:"No hay movimientos registrados con estos filtros. No se reconstruyen movimientos antiguos que no tengan evidencia."}</p>}
    {data?.history.length>0&&<table className={styles.table}><caption>Movimientos registrados · no modificables</caption><thead><tr><th>Fecha y tipo</th><th>Producto / variante</th><th>Cantidad / stock</th><th>Responsable y origen</th></tr></thead><tbody>{data.history.map(row=><tr key={row.id}>
      <td>{formatOrderDate(row.createdAt)}<small><strong>{movementLabel(row)}</strong></small></td>
      <td>{row.productName}<small>{[row.sizeName,row.colorName].filter(Boolean).join(" / ")||"Sin talla/color registrados"} · {row.sku||"Sin SKU registrado"}</small>{row.productId&&<Link className="admin-btn" href={`/admin/productos?view=stock&productId=${row.productId}${row.variantId?`&variantId=${row.variantId}`:""}`}>Consultar existencias</Link>}</td>
      <td>{row.quantityChange>0?"+":""}{row.quantityChange||"—"} uds<small>Stock: {row.stockBefore??"sin registro"} → {row.stockAfter??"sin registro"}</small></td>
      <td>{row.userEmail||(row.userId?"Responsable registrado":row.role==="system"?"Sistema":"Responsable no registrado")}<small>{row.referenceLabel||row.referenceType||"Sin origen registrado"}</small><p>{row.summary}</p></td>
    </tr>)}</tbody></table>}
    {data?.totalPages>1&&<nav className={styles.pagination} aria-label="Páginas de movimientos">{data.page>1&&<Link className="admin-btn" href={href({page:data.page-1})}>Anterior</Link>}<span>Página {data.page} de {data.totalPages}</span>{data.page<data.totalPages&&<Link className="admin-btn" href={href({page:data.page+1})}>Siguiente</Link>}</nav>}
    <details><summary>Resumen general de registros</summary>{statsError?<p>Los indicadores generales no están disponibles.</p>:stats?<div className={styles.metrics}><div><strong>{stats.total}</strong><span>Registros totales</span></div><div><strong>{stats.today}</strong><span>Registros de hoy</span></div><div><strong>{stats.unitsSoldToday}</strong><span>Unidades vendidas hoy</span></div><div><strong>{stats.stockAdjustmentsToday}</strong><span>Ajustes registrados hoy</span></div></div>:<p role="status">Cargando indicadores…</p>}</details>
  </section>;
}

function HistoryFilters({ params, data, pathname, onSubmit }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(["term", "productId", "movementKind", "eventType", "userId", "from", "to"].map((key) => [key, params.get(key) || ""])));
  const field = (key) => ({ name: key, value: draft[key], onChange: (e) => setDraft((old) => ({ ...old, [key]: e.target.value })) });
  return <form className={styles.filters} aria-label="Filtrar movimientos" onSubmit={(e) => { e.preventDefault(); onSubmit(draft); }}>
    <label className={styles.search}>Producto, SKU, pedido o motivo<input type="search" {...field("term")} maxLength={160} /></label>
    <label>Producto<select {...field("productId")}><option value="">Todos</option>{draft.productId && !data?.filters.products.some((p) => p.id === draft.productId) && <option value={draft.productId}>Producto seleccionado</option>}{data?.filters.products.filter((p) => p.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Tipo de movimiento<select {...field("movementKind")}><option value="">Todos</option><option value="restock">Reposición</option><option value="withdrawal">Retiro administrativo</option><option value="sale">Venta</option><option value="restoration">Restauración por pedido</option><option value="other">Otros registros</option></select></label>
    <label>Tipo de registro histórico<select {...field("eventType")}><option value="">Todos</option>{data?.filters.eventTypes.map((t) => <option key={t} value={t}>{getProductEventLabel(t)}</option>)}</select></label>
    <label>Responsable<select {...field("userId")}><option value="">Todos</option>{draft.userId && !data?.filters.actors?.some((a) => a.id === draft.userId) && <option value={draft.userId}>Responsable seleccionado</option>}{data?.filters.actors?.map((a) => <option key={a.id} value={a.id}>{a.email || "Personal registrado"}</option>)}</select></label>
    <label>Desde (Colombia)<input type="date" {...field("from")} /></label><label>Hasta (Colombia)<input type="date" {...field("to")} /></label>
    <div className={styles.actions}><button type="submit" className="admin-btn admin-btn--primary">Aplicar filtros de movimientos</button><Link className="admin-btn" href={`${pathname}?view=movements`}>Limpiar filtros</Link></div>
  </form>;
}

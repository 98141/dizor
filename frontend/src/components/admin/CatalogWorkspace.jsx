"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAdminProducts, getCatalogMeta, updateAdminProduct } from "@/services/adminCatalogService";
import { formatCOP } from "@/lib/formatCurrency";
import { STOCK_LABELS, variantName } from "@/lib/catalogWorkspace";
import ProductHistoryList from "./ProductHistoryList";
import QuickStockAdjustment from "./QuickStockAdjustment";
import styles from "./CatalogWorkspace.module.css";

export default function CatalogWorkspace(props) { return <Suspense fallback={<p role="status">Cargando productos…</p>}><Workspace {...props} /></Suspense>; }
function ProductRow({ product: p, view, admin, returnTo, actorId, focusedVariant, onRecorded, onToggle }) {
  const [expanded, setExpanded] = useState(view === "stock" || !!focusedVariant);
  const [adjust, setAdjust] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false), focusRef = useRef(null);
  useEffect(() => { if (focusedVariant) focusRef.current?.focus(); }, [focusedVariant]);
  const inventory = p.inventory;
  return <article className={styles.productCard}>
    <div className={styles.productHeader}>
      <div className={styles.productIdentity}>{p.mainImage && <Image src={p.mainImage} width={64} height={64} alt="" unoptimized />}<div><h2>{p.name}</h2><p className={styles.muted}>{p.category?.name || "Sin categoría disponible"} {p.weaveType?.name && ` · ${p.weaveType.name}`}</p><span className={styles.badge}>{p.isActive ? "Publicado" : "No publicado"}</span><span className={`${styles.badge} ${inventory.stockStatus !== "healthy" ? styles.attention : ""}`}>{inventory.unavailable ? "Sin variantes disponibles" : inventory.stockStatus === "out" ? "Hay variantes agotadas" : STOCK_LABELS[inventory.stockStatus]}</span></div></div>
      <div><strong>{formatCOP(p.effectivePrice)}</strong><p className={styles.muted}>{p.variants.length} presentaciones · {inventory.reviewCount ? "Existencias por revisar" : `${inventory.totalStock} uds en variantes activas`}</p>{!p.isActive && <small>No disponibles para venta mientras no se publique.</small>}{admin && p.internalCost != null && <p className={styles.muted}>Costo interno: {formatCOP(p.internalCost)}</p>}</div>
    </div>
    <div className={styles.actions}>
      <button type="button" className="admin-btn" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>{expanded ? "Ocultar variantes" : "Consultar variantes y stock"}</button>
      {admin && <Link className="admin-btn" href={`/admin/productos/${p.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}>Editar datos</Link>}
      {admin && <button type="button" className="admin-btn" disabled={busy} onClick={() => setConfirm(true)}>{p.isActive ? "Desactivar publicación" : "Publicar producto"}</button>}
      {admin && <Link className="admin-btn" href={`/admin/productos?view=movements&productId=${p.id}`}>Ver movimientos</Link>}
      {p.slug && <a className="admin-btn" href={`/producto/${encodeURIComponent(p.slug)}`} target="_blank" rel="noopener noreferrer">Vista pública</a>}
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {confirm && <fieldset className={styles.confirm}><legend>{p.isActive ? "Confirmar desactivación" : "Confirmar publicación"}</legend><p>{p.isActive ? "El producto dejará de ofrecerse para nuevas ventas. Se conservan las variantes, las existencias y los pedidos históricos. Los pedidos abiertos pendientes de inventario deben revisarse primero." : "El producto volverá a mostrarse en la tienda. Solo sus variantes activas con existencias estarán disponibles."}</p><div className={styles.actions}><button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={async () => {
      if (lock.current) return; lock.current = true; setBusy(true); setError("");
      try { await onToggle(p.id, !p.isActive); setConfirm(false); } catch (err) { setError(err.response?.data?.message || "No se pudo confirmar el cambio. Actualiza la lista antes de intentarlo otra vez."); }
      finally { lock.current = false; setBusy(false); }
    }}>{busy ? "Registrando…" : "Confirmar publicación"}</button><button type="button" className="admin-btn" disabled={busy} onClick={() => setConfirm(false)}>Volver sin cambiar</button></div></fieldset>}
    {expanded && <div className={styles.variantList}>
      {p.variants.length === 0 && <p>Este registro histórico no tiene variantes disponibles. No se crearon presentaciones adicionales.</p>}
      {p.variants.map((v) => <section key={v.id} ref={focusedVariant === v.id ? focusRef : undefined} tabIndex={focusedVariant === v.id ? -1 : undefined} className={`${styles.variantCard} ${focusedVariant === v.id ? styles.target : ""}`}>
        <div><h3>{variantName(v)}</h3><p className={styles.muted}>SKU: {v.sku || "Sin SKU registrado"}</p></div><div><strong>{v.stock == null ? "Sin stock registrado" : `${v.stock} uds`}</strong><p><span className={`${styles.badge} ${["out", "low", "review"].includes(v.stockStatus) ? styles.attention : ""}`}>{STOCK_LABELS[v.stockStatus]}</span></p>{v.price != null && <small>Precio de la presentación: {formatCOP(v.price)}</small>}</div>
        <div className={styles.actions}>{admin && v.stockStatus !== "review" && <button type="button" className="admin-btn" onClick={() => setAdjust(v.id)}>Ajustar existencias · {v.sku}</button>}{admin && <Link className="admin-btn" href={`/admin/productos?view=movements&productId=${p.id}&variantId=${v.id}`}>Movimientos de esta variante</Link>}</div>
        {adjust === v.id && <QuickStockAdjustment product={p} variant={v} actorId={actorId} onRecorded={onRecorded} onClose={() => setAdjust(null)} />}
      </section>)}
    </div>}
  </article>;
}
function Workspace({ initialView = "products" }) {
  const { user } = useAuth(), router = useRouter(), params = useSearchParams(), pathname = usePathname();
  const query = params.toString(), view = params.get("view") || initialView;
  const admin = ["admin", "superadmin"].includes(user?.role);
  const [meta, setMeta] = useState(null), [metaError, setMetaError] = useState(false), [metaAttempt, setMetaAttempt] = useState(0);
  const [version, setVersion] = useState(0), [state, setState] = useState(null), [message, setMessage] = useState("");
  const key = `${query}:${view}:${version}`;
  useEffect(() => { let active = true; getCatalogMeta().then((r) => { if (active) { setMeta(r.meta); setMetaError(false); } }).catch(() => { if (active) setMetaError(true); }); return () => { active = false; }; }, [metaAttempt]);
  useEffect(() => {
    let active = true;
    if (view !== "movements") getAdminProducts(Object.fromEntries(new URLSearchParams(query))).then((data) => { if (active) setState({ key, data }); }).catch(() => { if (active) setState({ key, error: "No se pudieron cargar los productos. Los filtros se conservaron." }); });
    return () => { active = false; };
  }, [key, query, view]);
  const loading = state?.key !== key, data = !loading ? state?.data : null;
  const href = (changes, base = pathname) => { const next = new URLSearchParams(query); Object.entries(changes).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k)); return `${base}${next.size ? `?${next}` : ""}`; };
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;
  const recorded = (stock) => { setMessage(Number.isSafeInteger(stock) ? `Ajuste confirmado. Stock actual consultado: ${stock} unidades.` : "El ajuste consta registrado; las existencias actuales requieren revisión."); setVersion((v) => v + 1); };
  return <div className={styles.workspace}>
    <header className={styles.header}><div><p className={styles.eyebrow}>DIZOR · Catálogo e inventario</p><h1>Productos</h1><p className={styles.muted}>Consulta presentaciones, ajusta existencias y revisa su origen desde este lugar.</p></div>{admin && <Link className="admin-btn admin-btn--primary" href={`/admin/productos/nuevo?returnTo=${encodeURIComponent(returnTo)}`}>Nuevo producto</Link>}</header>
    <nav className={styles.trays} aria-label="Gestión de productos">{[["products", "Productos"], ["stock", "Existencias"], ...(admin ? [["movements", "Movimientos"]] : [])].map(([name, label]) => <Link key={name} className={styles.tray} aria-current={view === name ? "page" : undefined} href={href({ view: name, page: "" }, "/admin/productos")}>{label}</Link>)}<Link className={styles.tray} href="/admin/catalogo">Configuración del catálogo</Link></nav>
    {message && <p className={`${styles.notice} ${styles.success}`} role="status">{message}</p>}
    {view === "movements" ? admin ? <ProductHistoryList /> : <p role="alert">El historial de movimientos está reservado al administrador.</p> : <>
      {metaError && <p role="alert">No se pudieron cargar las categorías y tejidos. <button type="button" className="admin-btn" onClick={() => setMetaAttempt((n) => n + 1)}>Reintentar opciones</button></p>}
      {params.get("productId") && <p className={styles.muted}>Producto seleccionado desde un enlace. <Link href={href({ productId: "", variantId: "", page: "" })}>Quitar selección de producto</Link></p>}
      <CatalogFilters key={query} params={params} meta={meta} view={view} onSubmit={(values) => { setMessage(""); router.push(href({ ...values, page: "" })); }} />
      <div className={styles.header}><p className={styles.muted}>{data ? `${data.total} producto${data.total === 1 ? "" : "s"} · umbral bajo: ${data.threshold} uds por variante` : "Productos"}</p><button type="button" className="admin-btn" disabled={loading} onClick={() => setVersion((n) => n + 1)}>Actualizar productos</button></div>
      {loading && <p role="status">Cargando productos…</p>}
      {!loading && state?.error && <div className={`${styles.notice} ${styles.error}`} role="alert"><p>{state.error}</p><button type="button" className="admin-btn" onClick={() => setVersion((n) => n + 1)}>Reintentar carga</button></div>}
      {data?.products.length === 0 && <p role="status" className={styles.notice}>{data.total > 0 ? <>No hay productos en esta página. <Link href={href({ page: "1" })}>Volver a primera página</Link></> : [...params.keys()].some((k) => !["view", "page", "limit"].includes(k)) ? "No hay coincidencias para estos filtros." : "No hay productos registrados."}</p>}
      {data?.products.map((p) => <ProductRow key={`${p.id}:${params.get("variantId") || ""}`} product={p} view={view} admin={admin} returnTo={returnTo} actorId={user?.id || user?._id || user?.email} focusedVariant={params.get("productId") === p.id ? params.get("variantId") : null} onRecorded={recorded} onToggle={async (id, isActive) => { await updateAdminProduct(id, { isActive }); setMessage(isActive ? "Producto publicado." : "Publicación desactivada; datos y pedidos conservados."); setVersion((n) => n + 1); }} />)}
      {data?.totalPages > 1 && <nav className={styles.pagination} aria-label="Páginas de productos">{data.page > 1 && <Link className="admin-btn" href={href({ page: data.page - 1 })}>Anterior</Link>}<span>Página {data.page} de {data.totalPages}</span>{data.page < data.totalPages && <Link className="admin-btn" href={href({ page: data.page + 1 })}>Siguiente</Link>}</nav>}
    </>}
  </div>;
}

function CatalogFilters({ params, meta, view, onSubmit }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(["q", "category", "weaveType", "isActive", "stock"].map((key) => [key, params.get(key) || ""])));
  const field = (key) => ({ name: key, value: draft[key], onChange: (e) => setDraft((old) => ({ ...old, [key]: e.target.value })) });
  return <form className={styles.filters} aria-label="Filtrar productos" onSubmit={(e) => { e.preventDefault(); onSubmit(draft); }}>
    <label className={styles.search}>Nombre o SKU<input type="search" {...field("q")} maxLength={160} /></label>
    <label>Existencias<select {...field("stock")}><option value="">Todas</option><option value="available">Con existencias activas</option><option value="low">Stock bajo (sin agotados)</option><option value="out">Con agotados / sin variantes</option><option value="healthy">Stock suficiente</option><option value="review">Requieren revisión</option></select></label>
    <div className={styles.actions}><button type="submit" className="admin-btn admin-btn--primary">Aplicar filtros</button><Link className="admin-btn" href={`/admin/productos?view=${view}`}>Limpiar filtros</Link></div>
    <details className={styles.advanced} open={["category", "weaveType", "isActive"].some((key) => params.get(key))}>
      <summary>Más filtros · categoría, tejido y publicación</summary><div className={styles.advancedFields}>
        <label>Categoría<select {...field("category")}><option value="">Todas</option>{meta?.categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        <label>Tejido<select {...field("weaveType")}><option value="">Todos</option>{meta?.weaveTypes?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        <label>Publicación<select {...field("isActive")}><option value="">Todos</option><option value="true">Publicados</option><option value="false">No publicados</option></select></label>
      </div>
    </details>
    <p className={`${styles.muted} ${styles.wide}`}>Si hay variantes agotadas y bajas, el producto aparece en Agotados. Las variantes inactivas se consultan por separado.</p>
  </form>;
}

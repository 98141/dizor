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

const TONE = { healthy: "ok", low: "warn", out: "bad", inactive: "muted", review: "warn" };
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function CatalogWorkspace(props) { return <Suspense fallback={<p role="status">Cargando productos…</p>}><Workspace {...props} /></Suspense>; }

function ProductRow({ product: p, view, admin, returnTo, actorId, expanded, focusedVariant, onToggle, onRecorded, onTogglePublication }) {
  const [adjust, setAdjust] = useState(null);
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false), focusRef = useRef(null);
  const inventory = p.inventory || {};
  const panelId = `catalog-variants-${p.id}`;
  const activeCount = inventory.activeVariantCount ?? p.variants.length;
  const inactiveCount = Math.max(0, (inventory.variantCount ?? p.variants.length) - activeCount);
  const available = Number.isSafeInteger(inventory.availableStock) ? inventory.availableStock : inventory.totalStock;
  const stockLine = `${count(activeCount, "variante", "variantes")} · ${count(available || 0, "unidad disponible", "unidades disponibles")}`;
  const signals = [
    inventory.outCount ? count(inventory.outCount, "variante agotada", "variantes agotadas") : "",
    inventory.lowCount ? count(inventory.lowCount, "con stock bajo", "con stock bajo") : "",
    inventory.reviewCount ? count(inventory.reviewCount, "por revisar", "por revisar") : "",
    inactiveCount ? count(inactiveCount, "inactiva", "inactivas") : "",
  ].filter(Boolean);
  const availability = inventory.unavailable ? "Sin variantes disponibles" : inventory.stockStatus === "out" ? "Hay variantes agotadas" : STOCK_LABELS[inventory.stockStatus] || "Disponible";
  const toggleLabel = view === "stock" ? (expanded ? "Ocultar existencias" : "Ver existencias") : (expanded ? "Ocultar variantes" : "Consultar variantes y stock");
  useEffect(() => { if (focusedVariant && expanded) focusRef.current?.focus(); }, [focusedVariant, expanded]);
  return <article className={`op-cat-card${expanded ? " is-open" : ""}`}>
    <div className="op-cat-summary">
      {p.mainImage ? <Image className="op-cat-thumb" src={p.mainImage} width={48} height={48} alt="" unoptimized /> : <span className="op-cat-thumb op-cat-thumb--empty" aria-hidden="true" />}
      <div className="op-cat-copy">
        <h2>{p.name}</h2>
        <p className="op-muted">{p.category?.name || "Sin categoría disponible"}{p.weaveType?.name ? ` · ${p.weaveType.name}` : ""}</p>
        {view === "stock" ? <>
          <p className="op-stockline">{stockLine}</p>
          {signals.length > 0 && <p className="op-signals">{signals.join(" · ")}</p>}
        </> : <p className="op-stockline">{count(p.variants.length, "variante", "variantes")} · {available || 0} uds disponibles{inventory.reviewCount ? " · existencias por revisar" : ""}</p>}
        <p className="op-badges">
          <span className={`op-chip op-chip--${p.isActive ? "ok" : "muted"}`}>{p.isActive ? "Publicado" : "No publicado"}</span>
          <span className={`op-chip op-chip--${TONE[inventory.stockStatus] || "muted"}`}>{availability}</span>
        </p>
        {!p.isActive && <small className="op-muted">No disponibles para venta mientras no se publique.</small>}
      </div>
      <div className="op-cat-side">
        {view !== "stock" && <strong className="op-price">{formatCOP(p.effectivePrice)}</strong>}
        <button type="button" className="op-btn op-btn--primary" aria-expanded={expanded} aria-controls={panelId} onClick={() => onToggle(p)}>{toggleLabel}</button>
      </div>
    </div>
    <div className="op-secondary">
      <button type="button" className="op-btn op-more" aria-expanded={more} aria-controls={`catalog-more-${p.id}`} onClick={() => setMore((open) => !open)}>Más opciones</button>
      <div id={`catalog-more-${p.id}`} className={`op-secondary-links${more ? " is-open" : ""}`}>
        {admin && <Link className="op-quiet" href={`/admin/productos/${p.id}/editar?returnTo=${encodeURIComponent(returnTo)}`}>Editar datos</Link>}
        {admin && <Link className="op-quiet" href={`/admin/productos?view=movements&productId=${p.id}`}>Ver movimientos</Link>}
        {p.slug && <a className="op-quiet" href={`/producto/${encodeURIComponent(p.slug)}`} target="_blank" rel="noopener noreferrer">Vista pública</a>}
        {admin && <button type="button" className="op-quiet" disabled={busy} onClick={() => setConfirm(true)}>{p.isActive ? "Desactivar publicación" : "Publicar producto"}</button>}
        {admin && p.internalCost != null && <span className="op-muted">Costo interno: {formatCOP(p.internalCost)}</span>}
      </div>
    </div>
    {error && <p role="alert" className="op-alert">{error}</p>}
    {confirm && <fieldset className="op-confirm"><legend>{p.isActive ? "Confirmar desactivación" : "Confirmar publicación"}</legend><p>{p.isActive ? "El producto dejará de ofrecerse para nuevas ventas. Se conservan las variantes, las existencias y los pedidos históricos. Los pedidos abiertos pendientes de inventario deben revisarse primero." : "El producto volverá a mostrarse en la tienda. Solo sus variantes activas con existencias estarán disponibles."}</p><div className="op-confirm-actions"><button type="button" className="op-btn op-btn--primary" disabled={busy} onClick={async () => {
      if (lock.current) return; lock.current = true; setBusy(true); setError("");
      try { await onTogglePublication(p.id, !p.isActive); setConfirm(false); } catch (err) { setError(err.response?.data?.message || "No se pudo confirmar el cambio. Actualiza la lista antes de intentarlo otra vez."); }
      finally { lock.current = false; setBusy(false); }
    }}>{busy ? "Registrando…" : "Confirmar publicación"}</button><button type="button" className="op-btn" disabled={busy} onClick={() => setConfirm(false)}>Volver sin cambiar</button></div></fieldset>}
    {expanded && <div id={panelId} className="op-variants" role="region" aria-label={`Variantes de ${p.name}`}>
      {p.variants.length === 0 && <p>Este registro histórico no tiene variantes disponibles. No se crearon presentaciones adicionales.</p>}
      {p.variants.map((v) => <section key={v.id} ref={focusedVariant === v.id ? focusRef : undefined} tabIndex={focusedVariant === v.id ? -1 : undefined} className={`op-variant${focusedVariant === v.id ? " is-target" : ""}`}>
        <div className="op-variant-id"><strong>{variantName(v)}</strong><span className="op-muted">SKU: {v.sku || "Sin SKU registrado"}</span></div>
        <div className="op-variant-stock"><strong>{v.stock == null ? "Sin stock registrado" : `${v.stock} uds`}</strong><span className={`op-chip op-chip--${TONE[v.stockStatus] || "muted"}`}>{STOCK_LABELS[v.stockStatus]}</span>{v.price != null && <small className="op-muted">Precio de la presentación: {formatCOP(v.price)}</small>}</div>
        <div className="op-variant-actions">{admin && v.stockStatus !== "review" && <button type="button" className="op-btn" onClick={() => setAdjust(v.id)}>Ajustar existencias · {v.sku}</button>}{admin && <Link className="op-quiet" href={`/admin/productos?view=movements&productId=${p.id}&variantId=${v.id}`}>Movimientos de esta variante</Link>}</div>
        {adjust === v.id && <QuickStockAdjustment product={p} variant={v} actorId={actorId} onRecorded={onRecorded} onClose={() => setAdjust(null)} />}
      </section>)}
    </div>}
  </article>;
}

function Workspace({ initialView = "products" }) {
  const { user } = useAuth(), router = useRouter(), params = useSearchParams(), pathname = usePathname();
  const query = params.toString(), view = params.get("view") || initialView;
  const admin = ["admin", "superadmin"].includes(user?.role);
  const deepId = params.get("variantId") ? params.get("productId") || "" : "";
  const [meta, setMeta] = useState(null), [metaError, setMetaError] = useState(false), [metaAttempt, setMetaAttempt] = useState(0);
  const [version, setVersion] = useState(0), [state, setState] = useState(null), [message, setMessage] = useState("");
  const [openState, setOpenState] = useState({ deepId, openId: deepId || null });
  const [notice, setNotice] = useState("");
  if (openState.deepId !== deepId) setOpenState({ deepId, openId: deepId || null });
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
  const titles = { products: ["Productos", "Consulta el catálogo, su publicación y la disponibilidad."], stock: ["Existencias", "Revisa el resumen y abre solo el producto que vas a ajustar."], movements: ["Movimientos", "Historial de ventas, ajustes y cambios. Fechas en Colombia."] };
  const [title, lead] = titles[view] || titles.products;
  const trays = [["products", "Productos"], ["stock", "Existencias"], ...(admin ? [["movements", "Movimientos"]] : [])];
  const toggleProduct = (product) => {
    const next = openState.openId === product.id ? null : product.id;
    setOpenState({ deepId, openId: next });
    setNotice(next ? `${view === "stock" ? "Existencias" : "Variantes"} de ${product.name} visibles.` : `${view === "stock" ? "Existencias" : "Variantes"} de ${product.name} ocultas.`);
  };
  const recorded = (stock) => { setMessage(Number.isSafeInteger(stock) ? `Ajuste confirmado. Stock actual consultado: ${stock} unidades.` : "El ajuste consta registrado; las existencias actuales requieren revisión."); setVersion((v) => v + 1); };
  return <div className="op-catalog">
    <header className="op-hero">
      <div><h1>{title}</h1><p className="op-lead">{lead}</p></div>
      {admin && <Link className="op-btn op-btn--primary" href={`/admin/productos/nuevo?returnTo=${encodeURIComponent(returnTo)}`}>Nuevo producto</Link>}
    </header>
    <nav className="op-trays" aria-label="Gestión de productos">
      {trays.map(([name, label]) => <Link key={name} className="op-tray" aria-current={view === name ? "page" : undefined} href={href({ view: name, page: "" }, "/admin/productos")}>{label}</Link>)}
      <Link className="op-tray" href="/admin/catalogo">Configuración del catálogo</Link>
    </nav>
    <label className="op-field op-section-select">Sección
      <select aria-label="Sección del catálogo" value={view} onChange={(event) => { const value = event.target.value; if (value === "taxonomy") router.push("/admin/catalogo"); else router.push(href({ view: value, page: "" }, "/admin/productos")); }}>
        {trays.map(([name, label]) => <option key={name} value={name}>{label}</option>)}
        <option value="taxonomy">Configuración del catálogo</option>
      </select>
    </label>
    <p className="sr-only" role="status" aria-live="polite">{notice}</p>
    {message && <p className="op-notice op-notice--ok" role="status">{message}</p>}
    {view === "movements" ? admin ? <ProductHistoryList /> : <p role="alert">El historial de movimientos está reservado al administrador.</p> : <>
      {metaError && <p role="alert" className="op-alert">No se pudieron cargar las categorías y tejidos. <button type="button" className="op-btn" onClick={() => setMetaAttempt((n) => n + 1)}>Reintentar opciones</button></p>}
      {params.get("productId") && <p className="op-muted">Producto seleccionado desde un enlace. <Link href={href({ productId: "", variantId: "", page: "" })}>Quitar selección de producto</Link></p>}
      <CatalogFilters key={query} params={params} meta={meta} view={view} onSubmit={(values) => { setMessage(""); router.push(href({ ...values, page: "" })); }} />
      <div className="op-toolbar"><p className="op-muted">{data ? `${data.total} producto${data.total === 1 ? "" : "s"} · umbral bajo: ${data.threshold} uds por variante` : "Productos"}</p><button type="button" className="op-btn" disabled={loading} onClick={() => setVersion((n) => n + 1)}>Actualizar productos</button></div>
      {loading && <p role="status" className="op-notice">Cargando productos…</p>}
      {!loading && state?.error && <div className="op-notice op-notice--bad" role="alert"><p>{state.error}</p><button type="button" className="op-btn" onClick={() => setVersion((n) => n + 1)}>Reintentar carga</button></div>}
      {data?.products.length === 0 && <p role="status" className="op-notice">{data.total > 0 ? <>No hay productos en esta página. <Link href={href({ page: "1" })}>Volver a primera página</Link></> : [...params.keys()].some((k) => !["view", "page", "limit"].includes(k)) ? "No hay coincidencias para estos filtros." : "No hay productos registrados."}</p>}
      <div className="op-cat-list">{data?.products.map((p) => <ProductRow key={`${p.id}:${params.get("variantId") || ""}`} product={p} view={view} admin={admin} returnTo={returnTo} actorId={user?.id || user?._id || user?.email} expanded={openState.openId === p.id} focusedVariant={params.get("productId") === p.id ? params.get("variantId") : null} onToggle={toggleProduct} onRecorded={recorded} onTogglePublication={async (id, isActive) => { await updateAdminProduct(id, { isActive }); setMessage(isActive ? "Producto publicado." : "Publicación desactivada; datos y pedidos conservados."); setVersion((n) => n + 1); }} />)}</div>
      {data?.totalPages > 1 && <nav className="op-pager" aria-label="Páginas de productos">{data.page > 1 && <Link className="op-btn" href={href({ page: data.page - 1 })}>Anterior</Link>}<span>Página {data.page} de {data.totalPages}</span>{data.page < data.totalPages && <Link className="op-btn" href={href({ page: data.page + 1 })}>Siguiente</Link>}</nav>}
    </>}
  </div>;
}

function CatalogFilters({ params, meta, view, onSubmit }) {
  const advancedKeys = ["category", "weaveType", "isActive"];
  const [draft, setDraft] = useState(() => Object.fromEntries(["q", "category", "weaveType", "isActive", "stock"].map((key) => [key, params.get(key) || ""])));
  const [advanced, setAdvanced] = useState(advancedKeys.some((key) => params.get(key)));
  const field = (key) => ({ name: key, value: draft[key], onChange: (e) => setDraft((old) => ({ ...old, [key]: e.target.value })) });
  const active = ["q", "stock", ...advancedKeys].some((key) => params.get(key));
  return <form className={`op-filters${advanced ? " is-open" : ""}`} aria-label="Filtrar productos" onSubmit={(e) => { e.preventDefault(); onSubmit(draft); }}>
    <div className="op-filterbar">
      <label className="op-field op-search">Nombre o SKU<input type="search" {...field("q")} maxLength={160} /></label>
      <label className="op-field">Existencias<select {...field("stock")}><option value="">Todas</option><option value="available">Con existencias activas</option><option value="low">Stock bajo (sin agotados)</option><option value="out">Con agotados / sin variantes</option><option value="healthy">Stock suficiente</option><option value="review">Requieren revisión</option></select></label>
      <button type="button" className="op-btn" aria-expanded={advanced} aria-controls="catalog-advanced-filters" onClick={() => setAdvanced((open) => !open)}>Filtros</button>
      <button type="submit" className="op-btn op-btn--primary">Aplicar filtros</button>
    </div>
    <div id="catalog-advanced-filters" className={`op-advanced${advanced ? " is-open" : ""}`}>
      <label className="op-field">Categoría<select {...field("category")}><option value="">Todas</option>{meta?.categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
      <label className="op-field">Tejido<select {...field("weaveType")}><option value="">Todos</option>{meta?.weaveTypes?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
      <label className="op-field">Publicación<select {...field("isActive")}><option value="">Todos</option><option value="true">Publicados</option><option value="false">No publicados</option></select></label>
    </div>
    {active && <p className="op-active"><span>Filtros activos</span><Link href={`/admin/productos?view=${view}`}>Limpiar filtros</Link></p>}
    <p className="op-hint">Si hay variantes agotadas y bajas, el producto aparece en Agotados. Las variantes inactivas se consultan por separado.</p>
  </form>;
}

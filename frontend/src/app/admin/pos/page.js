"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import { formatCOP } from "@/lib/formatCurrency";
import {
  searchPosProducts,
  createPosSale,
  getPosSales,
  voidPosSale,
  getCashClose,
  downloadCashClosePdf,
} from "@/services/adminPosService";

const PM_LABELS = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  nequi: "Nequi",
  transferencia: "Transferencia",
};

const ONLINE_PM_LABELS = {
  wompi: "Wompi (PSE / Tarjeta)",
  nequi_manual: "Nequi (transferencia)",
  contra_entrega: "Contraentrega pagada",
};

const todayStr = () => new Date().toISOString().split("T")[0];

/* ─── ProductSearch ─────────────────────────────────── */
function ProductSearch({ onAdd }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await searchPosProducts(q);
      setResults(data.products || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 350);
    return () => clearTimeout(timerRef.current);
  }, [query, search]);

  return (
    <div className="pos-search">
      <input
        className="pos-search__input"
        placeholder="Buscar producto o SKU..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {searching && <p className="pos-search__hint">Buscando…</p>}
      {!searching && results.length === 0 && query.trim() && (
        <p className="pos-search__hint">Sin resultados</p>
      )}
      <div className="pos-search__results">
        {results.map((r) => (
          <button
            key={`${r.productId}-${r.variantId}`}
            type="button"
            className="pos-result"
            onClick={() => onAdd(r)}
          >
            <span className="pos-result__name">{r.productName}</span>
            <span className="pos-result__meta">
              {[r.sizeName, r.colorName, r.sku].filter(Boolean).join(" · ")}
            </span>
            <span className="pos-result__right">
              <span className="pos-result__price">{formatCOP(r.unitPrice)}</span>
              <span className="pos-result__stock">stock {r.stock}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── CashClose ─────────────────────────────────────── */
function CashCloseView() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getCashClose(date);
      setData(d);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { await downloadCashClosePdf(date); }
    catch { alert("No se pudo exportar el PDF"); }
    finally { setExporting(false); }
  };

  const online = data?.online;

  return (
    <div className="pos-close">
      <div className="pos-close__header">
        <h2 className="pos-close__title">Cierre del día</h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="date"
            className="auth-field__input"
            style={{ width: "auto" }}
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
          <button type="button" className="admin-btn admin-btn--primary" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Ver"}
          </button>
          {data && (
            <button type="button" className="admin-btn" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exportando…" : "⬇ PDF"}
            </button>
          )}
        </div>
      </div>

      {loading && <p className="auth-loading">Cargando cierre…</p>}

      {!loading && data && (
        <>
          <p className="pos-close__date-label">{data.label}</p>

          {/* ── Resumen combinado ── */}
          <div className="admin-stats admin-stats--compact" style={{ marginBottom: "1.5rem" }}>
            <div className="admin-stat-card admin-stat-card--highlight">
              <p className="admin-stat-card__value">{formatCOP(data.combinedTotal ?? data.grandTotal)}</p>
              <p className="admin-stat-card__label">Ingreso total del día</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-card__value">{formatCOP(data.grandTotal)}</p>
              <p className="admin-stat-card__label">POS · {data.salesCount} venta(s)</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-card__value">{formatCOP(online?.total ?? 0)}</p>
              <p className="admin-stat-card__label">Online · {online?.salesCount ?? 0} pedido(s)</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-card__value">{formatCOP(data.expectedCash)}</p>
              <p className="admin-stat-card__label">Efectivo en caja</p>
            </div>
          </div>

          {/* ── Sección POS ── */}
          <div className="pos-close__section">
            <h3 className="pos-close__section-title">Ventas presenciales (POS)</h3>

            {data.salesCount === 0 ? (
              <p className="pos-close__empty">Sin ventas POS para este día.</p>
            ) : (
              <>
                <div className="pos-close__methods">
                  {Object.entries(data.byMethod).map(([pm, info]) => (
                    <div key={pm} className="pos-close__method-row">
                      <span>{PM_LABELS[pm] || pm}</span>
                      <span>{info.count} vta(s)</span>
                      <span style={{ fontWeight: 600 }}>{formatCOP(info.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="admin-table-wrap" style={{ marginTop: "0.75rem" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Nro.</th>
                        <th>Hora</th>
                        <th>Cliente</th>
                        <th>Método</th>
                        <th>Total</th>
                        <th>Vendedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales.map((s) => (
                        <tr key={s._id}>
                          <td><span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{s.posOrderNumber}</span></td>
                          <td>{new Date(s.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td>{s.customerName}</td>
                          <td>{PM_LABELS[s.paymentMethod] || s.paymentMethod}</td>
                          <td>{formatCOP(s.total)}</td>
                          <td>{s.soldBy?.name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ── Sección Online ── */}
          <div className="pos-close__section">
            <h3 className="pos-close__section-title">
              Pedidos online confirmados
              <span className="pos-close__section-badge">pagados</span>
            </h3>

            {!online || online.salesCount === 0 ? (
              <p className="pos-close__empty">Sin pedidos online pagados para este día.</p>
            ) : (
              <>
                <div className="pos-close__methods">
                  {Object.entries(online.byMethod).map(([pm, info]) => (
                    <div key={pm} className="pos-close__method-row">
                      <span>{ONLINE_PM_LABELS[pm] || pm}</span>
                      <span>{info.count} pedido(s)</span>
                      <span style={{ fontWeight: 600 }}>{formatCOP(info.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="admin-table-wrap" style={{ marginTop: "0.75rem" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Hora</th>
                        <th>Cliente</th>
                        <th>Canal de pago</th>
                        <th>Und.</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {online.orders.map((o) => (
                        <tr key={o._id}>
                          <td><span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{o.orderNumber}</span></td>
                          <td>{new Date(o.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td>{o.customerName}</td>
                          <td>{ONLINE_PM_LABELS[o.paymentMethod] || o.paymentMethod}</td>
                          <td style={{ textAlign: "center" }}>{o.itemCount}</td>
                          <td>{formatCOP(o.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── RecentSales ───────────────────────────────────── */
function RecentSales({ refreshKey }) {
  const [sales, setSales] = useState([]);
  const [voidingId, setVoidingId] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  const loadSales = useCallback(async () => {
    try {
      const d = await getPosSales();
      setSales(d.sales || []);
    } catch { setSales([]); }
  }, []);

  useEffect(() => { loadSales(); }, [loadSales, refreshKey]);

  const handleVoid = async (id) => {
    if (!voidReason.trim()) { alert("Ingresa el motivo de anulación"); return; }
    try {
      await voidPosSale(id, voidReason);
      setVoidingId(null);
      setVoidReason("");
      await loadSales();
    } catch (err) {
      alert(err.response?.data?.message || "No se pudo anular");
    }
  };

  return (
    <div className="pos-recent">
      <h3 className="pos-recent__title">Ventas de hoy</h3>
      {sales.length === 0 ? (
        <p className="pos-search__hint">Sin ventas aún</p>
      ) : (
        <div className="pos-recent__list">
          {sales.map((s) => (
            <div key={s._id} className="pos-recent__item">
              <div className="pos-recent__item-head">
                <span className="pos-recent__num">{s.posOrderNumber}</span>
                <span className="pos-recent__time">
                  {new Date(s.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="pos-recent__total">{formatCOP(s.total)}</span>
                <span className="pos-recent__pm">{PM_LABELS[s.paymentMethod]}</span>
              </div>
              <p className="pos-recent__customer">{s.customerName}</p>
              {voidingId === s._id ? (
                <div className="pos-void-row">
                  <input
                    className="auth-field__input"
                    placeholder="Motivo de anulación"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm admin-btn--danger"
                    onClick={() => handleVoid(s._id)}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--sm"
                    onClick={() => { setVoidingId(null); setVoidReason(""); }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  style={{ marginTop: "0.3rem" }}
                  onClick={() => setVoidingId(s._id)}
                >
                  Anular
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main POS content ──────────────────────────────── */
function AdminPosContent() {
  const [tab, setTab] = useState("pos");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastSale, setLastSale] = useState(null);

  // Cart state lifted to parent so ProductSearch can add items
  const [cartItems, setCartItems] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [cashReceived, setCashReceived] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [cartError, setCartError] = useState("");

  const handleAddProduct = (product) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => String(i.variantId) === String(product.variantId));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(next[idx].stock, next[idx].quantity + 1) };
        return next;
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (variantId, qty) => {
    setCartItems((prev) =>
      prev
        .map((i) =>
          String(i.variantId) === String(variantId)
            ? { ...i, quantity: Math.max(1, Math.min(i.stock, qty)) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (variantId) =>
    setCartItems((prev) => prev.filter((i) => String(i.variantId) !== String(variantId)));

  const subtotal = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discount = Number(discountAmount) || 0;
  const total = Math.max(0, subtotal - discount);
  const change =
    paymentMethod === "efectivo" ? Math.max(0, (Number(cashReceived) || 0) - total) : 0;

  const resetCart = () => {
    setCartItems([]);
    setCustomerName("");
    setPaymentMethod("efectivo");
    setCashReceived("");
    setDiscountAmount("");
    setNotes("");
    setCartError("");
  };

  const handleComplete = async () => {
    if (!cartItems.length) { setCartError("Agrega al menos un producto"); return; }
    setSaving(true);
    setCartError("");
    try {
      const data = await createPosSale({
        customerName: customerName || "Cliente mostrador",
        items: cartItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          sizeName: i.sizeName,
          colorName: i.colorName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
        paymentMethod,
        cashReceived: Number(cashReceived) || total,
        discountAmount: discount,
        notes,
      });
      setLastSale(data.sale);
      setRefreshKey((k) => k + 1);
      resetCart();
      setTimeout(() => setLastSale(null), 6000);
    } catch (err) {
      setCartError(err.response?.data?.message || "No se pudo registrar la venta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page__header-row">
        <div>
          <h1 className="admin-page__title">Punto de venta (POS)</h1>
          <p className="admin-page__subtitle">
            Registra ventas presenciales y consulta el cierre del día.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className={`admin-btn${tab === "pos" ? " admin-btn--primary" : ""}`}
            onClick={() => setTab("pos")}
          >
            Nueva venta
          </button>
          <button
            type="button"
            className={`admin-btn${tab === "close" ? " admin-btn--primary" : ""}`}
            onClick={() => setTab("close")}
          >
            Cierre del día
          </button>
        </div>
      </div>

      {lastSale && (
        <div className="pos-success-banner">
          Venta <strong>{lastSale.posOrderNumber}</strong> registrada —{" "}
          {formatCOP(lastSale.total)}
          {lastSale.paymentMethod === "efectivo" && lastSale.changeGiven > 0
            ? ` · Cambio: ${formatCOP(lastSale.changeGiven)}`
            : ""}
        </div>
      )}

      {tab === "pos" && (
        <div className="pos-layout">
          {/* ── Carrito ── */}
          <div className="pos-cart">
            <h3 className="pos-cart__title">Venta actual</h3>

            <div className="pos-cart__items">
              {cartItems.length === 0 ? (
                <p className="pos-cart__empty">Busca y agrega productos a la derecha</p>
              ) : (
                cartItems.map((item) => (
                  <div key={String(item.variantId)} className="pos-cart__item">
                    <div className="pos-cart__item-info">
                      <span className="pos-cart__item-name">{item.productName}</span>
                      <span className="pos-cart__item-meta">
                        {[item.sizeName, item.colorName].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <div className="pos-cart__item-controls">
                      <button
                        type="button"
                        className="pos-qty-btn"
                        onClick={() => updateQty(item.variantId, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="pos-qty-val">{item.quantity}</span>
                      <button
                        type="button"
                        className="pos-qty-btn"
                        onClick={() => updateQty(item.variantId, item.quantity + 1)}
                      >
                        +
                      </button>
                      <span className="pos-cart__item-price">
                        {formatCOP(item.unitPrice * item.quantity)}
                      </span>
                      <button
                        type="button"
                        className="pos-cart__item-remove"
                        onClick={() => removeItem(item.variantId)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <>
                <div className="pos-cart__summary">
                  <div className="pos-cart__row">
                    <span>Subtotal</span>
                    <span>{formatCOP(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="pos-cart__row pos-cart__row--discount">
                      <span>Descuento</span>
                      <span>−{formatCOP(discount)}</span>
                    </div>
                  )}
                  <div className="pos-cart__row pos-cart__row--total">
                    <span>Total</span>
                    <span>{formatCOP(total)}</span>
                  </div>
                </div>

                <div className="pos-cart__fields">
                  <input
                    className="auth-field__input"
                    placeholder="Nombre del cliente (opcional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={80}
                  />

                  <div className="pos-pay-row">
                    {Object.entries(PM_LABELS).map(([pm, label]) => (
                      <button
                        key={pm}
                        type="button"
                        className={`pos-pm-btn${paymentMethod === pm ? " pos-pm-btn--active" : ""}`}
                        onClick={() => setPaymentMethod(pm)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === "efectivo" && (
                    <div className="pos-cash-row">
                      <input
                        className="auth-field__input"
                        type="number"
                        placeholder="Efectivo recibido"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        min={total}
                        step={1000}
                      />
                      {Number(cashReceived) > 0 && (
                        <span className="pos-change">
                          Cambio: <strong>{formatCOP(change)}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  <input
                    className="auth-field__input"
                    type="number"
                    placeholder="Descuento ($) — opcional"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    min={0}
                    step={1000}
                  />

                  <input
                    className="auth-field__input"
                    placeholder="Notas (opcional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={200}
                  />
                </div>

                {cartError && (
                  <p style={{ color: "var(--color-error)", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                    {cartError}
                  </p>
                )}

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="pos-complete-btn"
                    onClick={handleComplete}
                    disabled={saving}
                  >
                    {saving ? "Registrando..." : `Completar · ${formatCOP(total)}`}
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={resetCart}
                    disabled={saving}
                  >
                    Limpiar
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Derecha: búsqueda + ventas recientes ── */}
          <div className="pos-right">
            <ProductSearch onAdd={handleAddProduct} />
            <RecentSales refreshKey={refreshKey} />
          </div>
        </div>
      )}

      {tab === "close" && <CashCloseView />}
    </div>
  );
}

export default function AdminPosPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin", "vendedor"]}>
      <AdminShell variant="admin">
        <AdminPosContent />
      </AdminShell>
    </RoleRoute>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getAdminOrders,
  exportOrdersPdf,
  createManualOrder,
} from "@/services/orderAdminService";
import { searchPosProducts, getPosSales } from "@/services/adminPosService";
import { formatCOP } from "@/lib/formatCurrency";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  CHANNEL_ORIGIN_LABELS,
  getStatusBadgeClass,
} from "@/lib/orderLabels";

const MANUAL_PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "nequi_presencial", label: "Nequi" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "wompi", label: "Wompi / PSE" },
  { value: "nequi_manual", label: "Nequi (enlace)" },
];

const CHANNEL_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "telefono", label: "Teléfono" },
  { value: "otro", label: "Otro" },
];

function SourceBadge({ source, channelOrigin }) {
  if (source === "manual") {
    const ch = CHANNEL_ORIGIN_LABELS[channelOrigin] || channelOrigin || "Manual";
    return (
      <span style={{
        display: "inline-block", padding: "0.1rem 0.45rem",
        background: "#f3e8ff", color: "#6b21a8",
        borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700,
        whiteSpace: "nowrap",
      }}>
        {ch}
      </span>
    );
  }
  if (source === "pos") {
    return (
      <span style={{
        display: "inline-block", padding: "0.1rem 0.45rem",
        background: "#e0e7ff", color: "#3730a3",
        borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700,
      }}>POS</span>
    );
  }
  return (
    <span style={{
      display: "inline-block", padding: "0.1rem 0.45rem",
      background: "#f0fdf4", color: "#166534",
      borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700,
    }}>Web</span>
  );
}

/* ── Manual order form ──────────────────────────────── */
function ManualOrderForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    channelOrigin: "presencial",
    paymentMethod: "efectivo",
    paymentStatus: "pagado",
    shippingRequired: false,
    shippingAddress: { address: "", city: "", department: "" },
    discountAmount: "",
    notes: "",
  });
  const [cartItems, setCartItems] = useState([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setAddr = (field, value) =>
    setForm((f) => ({ ...f, shippingAddress: { ...f.shippingAddress, [field]: value } }));

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) { setSearchResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const d = await searchPosProducts(query);
        setSearchResults(d.products || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const addProduct = (p) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => String(i.variantId) === String(p.variantId));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(next[idx].stock, next[idx].quantity + 1) };
        return next;
      }
      return [...prev, { ...p, quantity: 1 }];
    });
    setQuery("");
    setSearchResults([]);
  };

  const updateQty = (variantId, qty) => {
    setCartItems((prev) =>
      prev
        .map((i) => String(i.variantId) === String(variantId) ? { ...i, quantity: Math.max(1, Math.min(i.stock, qty)) } : i)
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (variantId) =>
    setCartItems((prev) => prev.filter((i) => String(i.variantId) !== String(variantId)));

  const subtotal = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discount = Number(form.discountAmount) || 0;
  const total = Math.max(0, subtotal - discount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cartItems.length) { setError("Agrega al menos un producto"); return; }
    setSaving(true);
    setError("");
    try {
      const data = await createManualOrder({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        channelOrigin: form.channelOrigin,
        paymentMethod: form.paymentMethod,
        paymentStatus: form.paymentStatus,
        shippingRequired: form.shippingRequired,
        shippingAddress: form.shippingRequired ? form.shippingAddress : undefined,
        discountAmount: discount,
        notes: form.notes,
        items: cartItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          sizeName: i.sizeName,
          colorName: i.colorName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
      });
      onSuccess(data.order);
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo registrar el pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manual-order-drawer">
      <div className="manual-order-drawer__header">
        <h2 className="manual-order-drawer__title">Nuevo pedido manual</h2>
        <button type="button" className="admin-btn admin-btn--sm" onClick={onClose}>✕ Cerrar</button>
      </div>

      <form onSubmit={handleSubmit} className="manual-order-form">
        {/* Cliente */}
        <div className="manual-order-section">
          <h3 className="manual-order-section__title">Cliente</h3>
          <div className="manual-order-row">
            <div className="admin-form__group">
              <label>Nombre *</label>
              <input className="auth-field__input" value={form.customerName}
                onChange={(e) => set("customerName", e.target.value)} required maxLength={80} />
            </div>
            <div className="admin-form__group">
              <label>Teléfono *</label>
              <input className="auth-field__input" value={form.customerPhone}
                onChange={(e) => set("customerPhone", e.target.value)} required maxLength={20} />
            </div>
          </div>
          <div className="manual-order-row">
            <div className="admin-form__group">
              <label>Correo (opcional)</label>
              <input className="auth-field__input" type="email" value={form.customerEmail}
                onChange={(e) => set("customerEmail", e.target.value)} maxLength={100} />
            </div>
            <div className="admin-form__group">
              <label>Canal de venta</label>
              <select className="auth-field__input" value={form.channelOrigin}
                onChange={(e) => set("channelOrigin", e.target.value)}>
                {CHANNEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Productos */}
        <div className="manual-order-section">
          <h3 className="manual-order-section__title">Productos</h3>
          <div style={{ position: "relative", marginBottom: "0.75rem" }}>
            <input
              className="auth-field__input"
              placeholder="Buscar producto o SKU..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {(searching || searchResults.length > 0) && (
              <div className="manual-search-results">
                {searching && <p style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>Buscando…</p>}
                {searchResults.map((r) => (
                  <button
                    key={`${r.productId}-${r.variantId}`}
                    type="button"
                    className="pos-result"
                    onClick={() => addProduct(r)}
                  >
                    <span className="pos-result__name">{r.productName}</span>
                    <span className="pos-result__meta">{[r.sizeName, r.colorName, r.sku].filter(Boolean).join(" · ")}</span>
                    <span className="pos-result__right">
                      <span className="pos-result__price">{formatCOP(r.unitPrice)}</span>
                      <span className="pos-result__stock">stock {r.stock}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {cartItems.length > 0 && (
            <div className="manual-cart">
              {cartItems.map((item) => (
                <div key={String(item.variantId)} className="manual-cart__item">
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "0.88rem" }}>{item.productName}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                      {[item.sizeName, item.colorName].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button type="button" className="pos-qty-btn" onClick={() => updateQty(item.variantId, item.quantity - 1)}>−</button>
                    <span style={{ minWidth: "1.5rem", textAlign: "center" }}>{item.quantity}</span>
                    <button type="button" className="pos-qty-btn" onClick={() => updateQty(item.variantId, item.quantity + 1)}>+</button>
                    <span style={{ fontWeight: 600, minWidth: "5rem", textAlign: "right" }}>{formatCOP(item.unitPrice * item.quantity)}</span>
                    <button type="button" className="pos-cart__item-remove" onClick={() => removeItem(item.variantId)}>×</button>
                  </div>
                </div>
              ))}
              <div className="manual-cart__totals">
                <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
                <span>
                  <input type="number" className="auth-field__input" style={{ width: "120px", display: "inline-block" }}
                    placeholder="Descuento $" value={form.discountAmount}
                    onChange={(e) => set("discountAmount", e.target.value)} min={0} step={1000} />
                </span>
                <span style={{ fontWeight: 700 }}>{formatCOP(total)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Pago */}
        <div className="manual-order-section">
          <h3 className="manual-order-section__title">Pago</h3>
          <div className="manual-order-row">
            <div className="admin-form__group">
              <label>Método de pago</label>
              <select className="auth-field__input" value={form.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value)}>
                {MANUAL_PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="admin-form__group">
              <label>Estado del pago</label>
              <select className="auth-field__input" value={form.paymentStatus}
                onChange={(e) => set("paymentStatus", e.target.value)}>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente de cobro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Envío */}
        <div className="manual-order-section">
          <h3 className="manual-order-section__title">Envío</h3>
          <label className="admin-checkbox" style={{ marginBottom: "0.75rem" }}>
            <input type="checkbox" checked={form.shippingRequired}
              onChange={(e) => set("shippingRequired", e.target.checked)} />
            Requiere envío (el cliente no recoge en tienda)
          </label>
          {form.shippingRequired && (
            <div className="manual-order-row">
              <div className="admin-form__group">
                <label>Dirección *</label>
                <input className="auth-field__input" value={form.shippingAddress.address}
                  onChange={(e) => setAddr("address", e.target.value)} required={form.shippingRequired} />
              </div>
              <div className="admin-form__group">
                <label>Ciudad *</label>
                <input className="auth-field__input" value={form.shippingAddress.city}
                  onChange={(e) => setAddr("city", e.target.value)} required={form.shippingRequired} />
              </div>
              <div className="admin-form__group">
                <label>Departamento</label>
                <input className="auth-field__input" value={form.shippingAddress.department}
                  onChange={(e) => setAddr("department", e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="admin-form__group">
          <label>Notas internas (opcional)</label>
          <input className="auth-field__input" value={form.notes}
            onChange={(e) => set("notes", e.target.value)} maxLength={300} />
        </div>

        {error && <p style={{ color: "var(--color-error)", fontSize: "0.85rem", margin: "0.25rem 0" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Guardando…" : `Registrar pedido · ${formatCOP(total)}`}
          </button>
          <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Main OrdersList ────────────────────────────────── */
export default function OrdersList({ basePath = "/admin/pedidos" }) {
  const [sourceTab, setSourceTab] = useState("todos");
  const [orders, setOrders] = useState([]);
  const [posSales, setPosSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", orderStatus: "", paymentStatus: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadOrders = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params = { ...filters, page: pg, limit: 15 };
      if (sourceTab !== "todos" && sourceTab !== "pos") params.source = sourceTab;
      const data = await getAdminOrders(params);
      setOrders(data.orders);
      setTotalPages(data.totalPages);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page, sourceTab]);

  const loadPosSales = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPosSales({ all: "true", limit: 30, page });
      setPosSales(data.sales || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setPosSales([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    setPage(1);
  }, [sourceTab]);

  useEffect(() => {
    if (sourceTab === "pos") {
      loadPosSales();
    } else {
      loadOrders(page);
    }
  }, [sourceTab, page, filters.orderStatus, filters.paymentStatus]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    if (sourceTab !== "pos") loadOrders(1);
  };

  const handleManualSuccess = (newOrder) => {
    setShowForm(false);
    setSourceTab("manual");
    setPage(1);
    loadOrders(1);
  };

  return (
    <div>
      {/* ── Tabs ── */}
      <div className="orders-source-tabs">
        {[
          { key: "todos", label: "Todos" },
          { key: "web", label: "Online" },
          { key: "manual", label: "Manual" },
          { key: "pos", label: "POS" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`orders-source-tab${sourceTab === t.key ? " orders-source-tab--active" : ""}`}
            onClick={() => setSourceTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className="admin-btn admin-btn--primary admin-btn--sm"
          style={{ marginLeft: "auto" }}
          onClick={() => setShowForm(true)}
        >
          + Pedido manual
        </button>
      </div>

      {/* ── Manual order drawer ── */}
      {showForm && (
        <ManualOrderForm
          onClose={() => setShowForm(false)}
          onSuccess={handleManualSuccess}
        />
      )}

      {/* ── Filters (not shown for POS tab) ── */}
      {sourceTab !== "pos" && (
        <form className="orders-filters" onSubmit={handleSearch}>
          <input
            className="orders-filters__search"
            placeholder="Buscar por número, nombre, correo..."
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
          <select value={filters.orderStatus}
            onChange={(e) => { setFilters((f) => ({ ...f, orderStatus: e.target.value })); setPage(1); }}>
            <option value="">Estado pedido</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filters.paymentStatus}
            onChange={(e) => { setFilters((f) => ({ ...f, paymentStatus: e.target.value })); setPage(1); }}>
            <option value="">Estado pago</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button type="submit" className="admin-btn admin-btn--primary">Buscar</button>
          <button type="button" className="admin-btn" disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try { await exportOrdersPdf(filters); }
              catch { alert("No se pudo exportar el PDF"); }
              finally { setExporting(false); }
            }}>
            {exporting ? "Exportando…" : "PDF"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="auth-loading">Cargando pedidos...</p>
      ) : sourceTab === "pos" ? (
        /* ── POS tab ── */
        posSales.length === 0 ? (
          <p className="catalog-empty">No hay ventas POS registradas.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nro. POS</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Método</th>
                  <th>Vendedor</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {posSales.map((s) => (
                  <tr key={s._id} style={{ opacity: s.isVoided ? 0.5 : 1 }}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{s.posOrderNumber}</span>
                      {s.isVoided && <span style={{ marginLeft: "0.35rem", fontSize: "0.7rem", color: "#991b1b" }}>anulada</span>}
                      <div style={{ marginTop: "0.15rem" }}><SourceBadge source="pos" /></div>
                    </td>
                    <td>{s.customerName}</td>
                    <td>{formatCOP(s.total)}</td>
                    <td>{PAYMENT_METHOD_LABELS[s.paymentMethod] || s.paymentMethod}</td>
                    <td style={{ fontSize: "0.82rem" }}>{s.soldBy?.name || "—"}</td>
                    <td>{new Date(s.createdAt).toLocaleDateString("es-CO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : orders.length === 0 ? (
        <p className="catalog-empty">No hay pedidos con estos filtros.</p>
      ) : (
        /* ── Orders (web/manual/todos) tab ── */
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <div style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {order.orderNumber}
                    </div>
                    <div style={{ marginTop: "0.3rem" }}>
                      <SourceBadge source={order.source} channelOrigin={order.channelOrigin} />
                    </div>
                    <Link
                      href={`${basePath}/${order.id}`}
                      className="admin-btn admin-btn--sm admin-btn--primary"
                      style={{ marginTop: "0.4rem" }}
                    >
                      Ver pedido
                    </Link>
                  </td>
                  <td>
                    {order.buyer?.name}
                    <br />
                    <small style={{ color: "var(--color-text-muted)" }}>{order.buyer?.phone}</small>
                  </td>
                  <td>{formatCOP(order.total)}</td>
                  <td>
                    {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
                    <br />
                    <span className={`status-badge ${getStatusBadgeClass(order.paymentStatus)}`}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(order.orderStatus)}`}>
                      {ORDER_STATUS_LABELS[order.orderStatus]}
                    </span>
                  </td>
                  <td>{new Date(order.createdAt).toLocaleDateString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="catalog-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
        </div>
      )}
    </div>
  );
}

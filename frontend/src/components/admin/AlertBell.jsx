"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getAlerts } from "@/services/adminAlertService";

const REFRESH_INTERVAL = 60_000;
const DISMISSED_KEY = "dizor_dismissed_alerts";

const ALERT_META = {
  newOrders:       { label: "Pedidos nuevos (24h)",        color: "#dc2626", dot: "🔴" },
  pendingPayments: { label: "Pagos Nequi por confirmar",   color: "#d97706", dot: "🟡" },
  lowStock:        { label: "Stock bajo",                  color: "#d97706", dot: "🟡" },
  outOfStock:      { label: "Sin stock",                   color: "#dc2626", dot: "🔴" },
  specialRequests: { label: "Solicitudes sin atender",     color: "#d97706", dot: "🟡" },
  expiringCoupons: { label: "Cupones por vencer (3 días)", color: "#7c3aed", dot: "🟣" },
};

const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

function loadDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDismissed(dismissed) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  } catch {}
}

function applyDismissed(alerts, dismissed) {
  const result = {};
  for (const [key, group] of Object.entries(alerts)) {
    const ids = new Set((dismissed[key] || []).map(String));
    const items = (group.items || []).filter((item) => {
      const id = String(item._id || item.id || "");
      return !ids.has(id);
    });
    result[key] = { ...group, count: items.length, items };
  }
  return result;
}

export default function AlertBell() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState({});
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await getAlerts();
      setData(res);
    } catch {
      // silencioso — sin alertas no bloqueamos la UI
    }
  }, []);

  useEffect(() => {
    setDismissed(loadDismissed());
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const dismissItem = useCallback((category, id) => {
    setDismissed((prev) => {
      const next = {
        ...prev,
        [category]: [...(prev[category] || []), String(id)],
      };
      saveDismissed(next);
      return next;
    });
  }, []);

  const rawAlerts = data?.alerts ?? {};
  const filteredAlerts = applyDismissed(rawAlerts, dismissed);
  const total = Object.values(filteredAlerts).reduce((s, g) => s + (g.count || 0), 0);

  const activeAlerts = Object.entries(ALERT_META).filter(
    ([key]) => (filteredAlerts[key]?.count ?? 0) > 0
  );

  return (
    <div className="alert-bell" ref={ref}>
      <button
        type="button"
        className="alert-bell__btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Alertas del sistema"
        title="Alertas"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {total > 0 && (
          <span className="alert-bell__badge">{total > 99 ? "99+" : total}</span>
        )}
      </button>

      {open && (
        <div className="alert-bell__dropdown">
          <div className="alert-bell__header">
            <span className="alert-bell__title">Alertas activas</span>
            {total > 0 && (
              <span className="alert-bell__total-badge">{total}</span>
            )}
          </div>

          {activeAlerts.length === 0 ? (
            <div className="alert-bell__empty">Sin alertas activas</div>
          ) : (
            <div className="alert-bell__list">
              {activeAlerts.map(([key, meta]) => {
                const group = filteredAlerts[key];
                return (
                  <div key={key} className="alert-bell__group">
                    <div className="alert-bell__group-header">
                      <span>{meta.dot} {meta.label}</span>
                      <span className="alert-bell__count" style={{ color: meta.color }}>
                        {group.count}
                      </span>
                    </div>

                    {key === "newOrders" && group.items.slice(0, 3).map((o) => (
                      <Link
                        key={o._id}
                        href="/admin/pedidos"
                        className="alert-bell__item"
                        onClick={() => { dismissItem(key, o._id); setOpen(false); }}
                      >
                        <span className="alert-bell__item-main">#{o.orderNumber}</span>
                        <span className="alert-bell__item-sub">{fmt(o.total)} · {o.buyer?.name}</span>
                      </Link>
                    ))}

                    {key === "pendingPayments" && group.items.slice(0, 3).map((o) => (
                      <Link
                        key={o._id}
                        href="/admin/pedidos"
                        className="alert-bell__item"
                        onClick={() => { dismissItem(key, o._id); setOpen(false); }}
                      >
                        <span className="alert-bell__item-main">#{o.orderNumber}</span>
                        <span className="alert-bell__item-sub">{fmt(o.total)} · {o.buyer?.name}</span>
                      </Link>
                    ))}

                    {(key === "lowStock" || key === "outOfStock") && group.items.slice(0, 3).map((p) => (
                      <Link
                        key={p.id}
                        href="/admin/inventario"
                        className="alert-bell__item"
                        onClick={() => { dismissItem(key, p.id || p._id); setOpen(false); }}
                      >
                        <span className="alert-bell__item-main">{p.name}</span>
                        <span className="alert-bell__item-sub">
                          {key === "outOfStock" ? "Sin stock" : `${p.totalStock} ud${p.totalStock !== 1 ? "s" : ""}`}
                        </span>
                      </Link>
                    ))}

                    {key === "specialRequests" && group.items.slice(0, 3).map((r) => (
                      <Link
                        key={r._id}
                        href="/admin/solicitudes"
                        className="alert-bell__item"
                        onClick={() => { dismissItem(key, r._id); setOpen(false); }}
                      >
                        <span className="alert-bell__item-main">#{r.requestNumber}</span>
                        <span className="alert-bell__item-sub">{r.contact?.name}</span>
                      </Link>
                    ))}

                    {key === "expiringCoupons" && group.items.slice(0, 3).map((c) => (
                      <Link
                        key={c._id}
                        href="/admin/cupones"
                        className="alert-bell__item"
                        onClick={() => { dismissItem(key, c._id); setOpen(false); }}
                      >
                        <span className="alert-bell__item-main">{c.code}</span>
                        <span className="alert-bell__item-sub">
                          Vence {new Date(c.expiresAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                        </span>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <Link
            href="/admin/alertas"
            className="alert-bell__footer"
            onClick={() => setOpen(false)}
          >
            Ver todas las alertas →
          </Link>
        </div>
      )}
    </div>
  );
}

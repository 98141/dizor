"use client";

import { useCallback, useEffect, useState } from "react";
import RoleRoute from "@/guards/RoleRoute";
import AdminShell from "@/components/admin/AdminShell";
import {
  adminListCustomerRequests,
  adminGetCustomerRequest,
  adminUpdateCustomerRequestStatus,
} from "@/services/customerRequestService";
import {
  CATEGORY_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  formatDateTime,
} from "@/lib/customerRequestLabels";

// Gestión de PQR y solicitudes de titulares (H-22, H-11). Solo
// administradores: incluye datos personales y solicitudes de supresión.
function PqrAdmin() {
  const [filters, setFilters] = useState({ category: "", status: "" });
  const [data, setData] = useState({ requests: [], total: 0 });
  const [selected, setSelected] = useState(null);
  const [update, setUpdate] = useState({ status: "en_tramite", publicNote: "", internalNote: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      setData(await adminListCustomerRequests(params));
    } catch (err) {
      setError(err.response?.data?.message || "No se pudieron cargar las solicitudes");
    }
  }, [filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API (sistema externo)
    load();
  }, [load]);

  const open = async (id) => {
    try {
      const res = await adminGetCustomerRequest(id);
      setSelected(res.request);
      setUpdate({ status: res.request.status, publicNote: "", internalNote: "" });
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo abrir la solicitud");
    }
  };

  const save = async () => {
    try {
      const res = await adminUpdateCustomerRequestStatus(selected.id, update);
      setSelected(res.request);
      setUpdate((u) => ({ ...u, publicNote: "", internalNote: "" }));
      load();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo actualizar");
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">PQR y solicitudes de datos</h1>
      <p className="admin-page__subtitle">
        Peticiones, quejas y reclamos de consumo, y solicitudes de titulares de
        datos personales. Cada cambio de estado queda en el historial.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", margin: "1rem 0", flexWrap: "wrap" }}>
        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Radicado</th>
              <th>Recibida</th>
              <th>Categoría</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.requests.map((r) => (
              <tr key={r.id}>
                <td>{r.radicado}</td>
                <td>{formatDateTime(r.receivedAt)}</td>
                <td>{r.category === "datos_personales" ? "Datos personales" : "Consumo"}</td>
                <td>{TYPE_LABELS[r.type] || r.type}</td>
                <td>{STATUS_LABELS[r.status] || r.status}</td>
                <td>
                  <button type="button" onClick={() => open(r.id)}>Ver</button>
                </td>
              </tr>
            ))}
            {data.requests.length === 0 && (
              <tr>
                <td colSpan={6}>Sin solicitudes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 className="admin-page__title" style={{ fontSize: "1.2rem" }}>{selected.radicado}</h2>
          <p>
            {CATEGORY_LABELS[selected.category]} · {TYPE_LABELS[selected.type] || selected.type} ·
            recibida {formatDateTime(selected.receivedAt)}
          </p>
          <p>
            {selected.contact?.name} · {selected.contact?.email}
            {selected.contact?.phone ? ` · ${selected.contact.phone}` : ""}
            {selected.orderNumber ? ` · Pedido ${selected.orderNumber}` : ""}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{selected.description}</p>

          <h3>Historial</h3>
          <ul>
            {selected.history.map((h, i) => (
              <li key={i}>
                {formatDateTime(h.changedAt)} — {STATUS_LABELS[h.status] || h.status}
                {h.publicNote ? ` · Nota al solicitante: ${h.publicNote}` : ""}
                {h.internalNote ? ` · Nota interna: ${h.internalNote}` : ""}
              </li>
            ))}
          </ul>

          <h3>Actualizar estado</h3>
          <div style={{ display: "grid", gap: "0.5rem", maxWidth: 520 }}>
            <select
              value={update.status}
              onChange={(e) => setUpdate((u) => ({ ...u, status: e.target.value }))}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <textarea
              rows={3}
              placeholder="Nota visible para el solicitante (opcional)"
              value={update.publicNote}
              onChange={(e) => setUpdate((u) => ({ ...u, publicNote: e.target.value }))}
            />
            <textarea
              rows={2}
              placeholder="Nota interna (no visible para el solicitante)"
              value={update.internalNote}
              onChange={(e) => setUpdate((u) => ({ ...u, internalNote: e.target.value }))}
            />
            <button type="button" onClick={save}>Guardar cambio de estado</button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function AdminPqrPage() {
  return (
    <RoleRoute allowedRoles={["superadmin", "admin"]}>
      <AdminShell variant="admin">
        <PqrAdmin />
      </AdminShell>
    </RoleRoute>
  );
}

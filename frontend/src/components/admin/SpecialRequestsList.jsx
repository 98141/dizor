"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminSpecialRequests } from "@/services/specialRequestAdminService";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  getRequestBadgeClass,
} from "@/lib/specialRequestLabels";

export default function SpecialRequestsList({
  basePath = "/admin/solicitudes",
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", type: "", status: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAdminSpecialRequests({
        ...filters,
        page,
        limit: 15,
      });
      setRequests(data.requests || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, filters.type, filters.status]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div>
      <form className="orders-filters" onSubmit={handleSearch}>
        <input
          className="orders-filters__search"
          placeholder="Buscar por número, nombre, correo..."
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select
          value={filters.type}
          onChange={(e) => {
            setFilters((f) => ({ ...f, type: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Tipo</option>
          <option value="customization">Personalización</option>
          <option value="wholesale">Por mayor</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Estado</option>
          {Object.entries(REQUEST_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="submit" className="admin-btn">
          Buscar
        </button>
      </form>

      {loading ? (
        <p className="auth-loading">Cargando…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`${basePath}/${r.id}`}>{r.requestNumber}</Link>
                  </td>
                  <td>{REQUEST_TYPE_LABELS[r.type]}</td>
                  <td>
                    {r.contact.name}
                    <br />
                    <span className="admin-muted">{r.contact.email}</span>
                  </td>
                  <td>
                    <span
                      className={`request-badge ${getRequestBadgeClass(r.status)}`}
                    >
                      {REQUEST_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td>
                    {new Date(r.createdAt).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            type="button"
            className="admin-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span style={{ alignSelf: "center", fontSize: "0.9rem" }}>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="admin-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { Fragment, useEffect, useState } from "react";
import { getAuditLogs, getAuditStats } from "@/services/auditAdminService";
import {
  getAuditActionLabel,
  getAuditModuleLabel,
} from "@/lib/auditLabels";

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export default function AuditLogList() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    modules: [],
    actions: [],
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    term: "",
    module: "",
    action: "",
    success: "",
    from: "",
    to: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (filters.term.trim()) params.term = filters.term.trim();
      if (filters.module) params.module = filters.module;
      if (filters.action) params.action = filters.action;
      if (filters.success) params.success = filters.success;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const data = await getAuditLogs(params);
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setFilterOptions(data.filters || { modules: [], actions: [] });
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAuditStats()
      .then((res) => setStats(res.stats))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    load();
  }, [page, filters.module, filters.action, filters.success]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div>
      {stats && (
        <div className="admin-stats admin-stats--compact" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.total}</p>
            <p className="admin-stat-card__label">Eventos totales</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.today}</p>
            <p className="admin-stat-card__label">Hoy</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-card__value">{stats.failed}</p>
            <p className="admin-stat-card__label">Fallidos</p>
          </div>
        </div>
      )}

      <form className="orders-filters audit-filters" onSubmit={handleSearch}>
        <input
          className="orders-filters__search"
          placeholder="Buscar por correo, acción, módulo..."
          value={filters.term}
          onChange={(e) => setFilters((f) => ({ ...f, term: e.target.value }))}
        />
        <select
          value={filters.module}
          onChange={(e) => {
            setFilters((f) => ({ ...f, module: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Todos los módulos</option>
          {filterOptions.modules.map((m) => (
            <option key={m} value={m}>
              {getAuditModuleLabel(m)}
            </option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={(e) => {
            setFilters((f) => ({ ...f, action: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Todas las acciones</option>
          {filterOptions.actions.map((a) => (
            <option key={a} value={a}>
              {getAuditActionLabel(a)}
            </option>
          ))}
        </select>
        <select
          value={filters.success}
          onChange={(e) => {
            setFilters((f) => ({ ...f, success: e.target.value }));
            setPage(1);
          }}
        >
          <option value="">Éxito / fallo</option>
          <option value="true">Exitosos</option>
          <option value="false">Fallidos</option>
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          aria-label="Desde"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          aria-label="Hasta"
        />
        <button type="submit" className="admin-btn admin-btn--primary">
          Buscar
        </button>
      </form>

      {loading ? (
        <p className="auth-loading">Cargando historial...</p>
      ) : logs.length === 0 ? (
        <p className="admin-page__subtitle">No hay eventos con estos filtros.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Estado</th>
                <th>Detalle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.userEmail || "—"}</td>
                    <td>{log.role || "—"}</td>
                    <td>{getAuditModuleLabel(log.module)}</td>
                    <td>{getAuditActionLabel(log.action)}</td>
                    <td>
                      <span
                        className={`audit-badge audit-badge--${
                          log.success ? "ok" : "fail"
                        }`}
                      >
                        {log.success ? "OK" : "Error"}
                      </span>
                    </td>
                    <td>{log.summary || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        onClick={() =>
                          setExpandedId(expandedId === log.id ? null : log.id)
                        }
                      >
                        {expandedId === log.id ? "Ocultar" : "Ver"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-detail`} className="audit-detail-row">
                      <td colSpan={8}>
                        <div className="audit-detail-grid">
                          <div>
                            <strong>IP</strong>
                            <p>{log.ip || "—"}</p>
                          </div>
                          <div>
                            <strong>Datos anteriores</strong>
                            <pre>
                              {log.previousData
                                ? JSON.stringify(log.previousData, null, 2)
                                : "—"}
                            </pre>
                          </div>
                          <div>
                            <strong>Datos nuevos</strong>
                            <pre>
                              {log.newData
                                ? JSON.stringify(log.newData, null, 2)
                                : "—"}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="catalog-pagination" style={{ marginTop: "1.5rem" }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
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

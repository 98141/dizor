"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createTaxonomyItem,
  deleteTaxonomyItem,
  getTaxonomy,
  updateTaxonomyItem,
} from "@/services/adminCatalogService";
import ConfirmModal from "@/components/ui/ConfirmModal";

const TABS = [
  {
    type: "categories",
    label: "Categorías",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "description", label: "Descripción", type: "textarea" },
      { key: "sortOrder", label: "Orden", type: "number" },
      { key: "isActive", label: "Activo", type: "checkbox" },
    ],
  },
  {
    type: "colors",
    label: "Colores",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "hexCode", label: "Color", type: "color", placeholder: "#8B4513" },
      { key: "sortOrder", label: "Orden", type: "number" },
      { key: "isActive", label: "Activo", type: "checkbox" },
    ],
  },
  {
    type: "sizes",
    label: "Tallas",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "label", label: "Etiqueta (ej. 56-58 cm)" },
      { key: "sortOrder", label: "Orden", type: "number" },
      { key: "isActive", label: "Activo", type: "checkbox" },
    ],
  },
  {
    type: "weave-types",
    label: "Tejidos",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "description", label: "Descripción", type: "textarea" },
      { key: "sortOrder", label: "Orden", type: "number" },
      { key: "isActive", label: "Activo", type: "checkbox" },
    ],
  },
  {
    type: "styles",
    label: "Estilos / hormas",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "description", label: "Descripción", type: "textarea" },
      { key: "sortOrder", label: "Orden", type: "number" },
      { key: "isActive", label: "Activo", type: "checkbox" },
    ],
  },
];

const emptyForm = (fields) => {
  const data = {};
  fields.forEach((f) => {
    if (f.type === "checkbox") data[f.key] = true;
    else if (f.type === "number") data[f.key] = 0;
    else data[f.key] = "";
  });
  return data;
};

export default function TaxonomyManager({ initialTab = "categories" }) {
  const tabConfig =
    TABS.find((t) => t.type === initialTab) || TABS[0];
  const [activeType, setActiveType] = useState(tabConfig.type);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm(tabConfig.fields));
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);

  const currentTab = TABS.find((t) => t.type === activeType) || TABS[0];

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getTaxonomy(activeType);
      setItems(data.items || []);
    } catch (err) {
      setItems([]);
      setError(err.response?.data?.message || "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useEffect(() => {
    loadItems();
    setForm(emptyForm(currentTab.fields));
    setEditingId(null);
    setSavedMsg("");
  }, [activeType, loadItems, currentTab.fields]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    const data = emptyForm(currentTab.fields);
    currentTab.fields.forEach((f) => {
      if (f.type === "checkbox") data[f.key] = Boolean(item[f.key]);
      else if (f.type === "number") data[f.key] = item[f.key] ?? 0;
      else data[f.key] = item[f.key] ?? "";
    });
    setForm(data);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm(currentTab.fields));
    setError("");
  };

  const buildPayload = () => {
    const payload = {};
    currentTab.fields.forEach((f) => {
      let val = form[f.key];
      if (f.type === "number") val = Number(val) || 0;
      if (f.type === "checkbox") val = Boolean(val);
      if (typeof val === "string") val = val.trim();
      payload[f.key] = val;
    });
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      if (editingId) {
        await updateTaxonomyItem(activeType, editingId, payload);
      } else {
        await createTaxonomyItem(activeType, payload);
      }
      setSavedMsg(editingId ? "Guardado correctamente" : "Creado correctamente");
      cancelEdit();
      await loadItems();
    } catch (err) {
      setError(err.response?.data?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    setConfirmModal({
      message: `¿Estás seguro de que deseas eliminar "${name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setError("");
        try {
          await deleteTaxonomyItem(activeType, id);
          if (editingId === id) cancelEdit();
          await loadItems();
        } catch (err) {
          setError(err.response?.data?.message || "No se pudo eliminar");
        }
      },
    });
  };

  return (
    <div className="taxonomy-manager">
      <ConfirmModal
        isOpen={!!confirmModal}
        message={confirmModal?.message}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />
      <nav className="taxonomy-tabs" aria-label="Tipos de catálogo">
        {TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            className={activeType === tab.type ? "active" : ""}
            onClick={() => setActiveType(tab.type)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="taxonomy-grid">
        <section className="taxonomy-form-card">
          <h2>{editingId ? "Editar" : "Nuevo"} — {currentTab.label}</h2>
          {savedMsg && <p style={{ color: "var(--color-success)", marginBottom: "0.5rem", fontSize: "0.88rem" }}>{savedMsg}</p>}
          {error && <p className="admin-form-error">{error}</p>}
          <form onSubmit={handleSubmit} className="admin-form">
            {currentTab.fields.map((field) => (
              <div key={field.key} className="admin-form__group">
                <label htmlFor={`tax-${field.key}`}>
                  {field.label}
                  {field.required && " *"}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={`tax-${field.key}`}
                    rows={3}
                    value={form[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    required={field.required}
                  />
                ) : field.type === "checkbox" ? (
                  <input
                    id={`tax-${field.key}`}
                    type="checkbox"
                    checked={Boolean(form[field.key])}
                    onChange={(e) =>
                      handleChange(field.key, e.target.checked)
                    }
                  />
                ) : field.type === "color" ? (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="color"
                      value={form[field.key] || "#000000"}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      style={{ width: "48px", height: "38px", cursor: "pointer", padding: "2px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", flexShrink: 0 }}
                      title="Selecciona un color"
                    />
                    <input
                      id={`tax-${field.key}`}
                      type="text"
                      value={form[field.key]}
                      placeholder={field.placeholder || "#000000"}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  </div>
                ) : (
                  <input
                    id={`tax-${field.key}`}
                    type={field.type === "number" ? "number" : "text"}
                    value={form[field.key]}
                    placeholder={field.placeholder}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    required={field.required}
                  />
                )}
              </div>
            ))}
            <div className="admin-form__actions">
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={saving}
              >
                {saving ? "Guardando…" : editingId ? "Actualizar" : "Crear"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="admin-btn"
                  onClick={cancelEdit}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="taxonomy-list-card">
          <h2>Listado</h2>
          {loading ? (
            <p className="auth-loading">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="admin-empty">Sin registros</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td>
                        {item.name}
                        {item.hexCode && (
                          <span
                            className="color-swatch"
                            style={{ background: item.hexCode }}
                            title={item.hexCode}
                          />
                        )}
                      </td>
                      <td>{item.isActive !== false ? "Activo" : "Inactivo"}</td>
                      <td className="admin-table__actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm"
                          onClick={() => startEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm admin-btn--danger"
                          onClick={() => handleDelete(item._id, item.name)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

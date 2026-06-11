"use client";

import { useState } from "react";
import {
  addAddress,
  deleteAddress,
  updateAddress,
} from "@/services/authService";
import AuthFormField from "@/components/auth/AuthFormField";
import AuthSubmitButton from "@/components/auth/AuthSubmitButton";
import AuthErrorAlert from "@/components/auth/AuthErrorAlert";
import ConfirmModal from "@/components/ui/ConfirmModal";

const emptyForm = () => ({
  label: "Casa",
  address: "",
  city: "",
  department: "Nariño",
  postalCode: "",
  isDefault: false,
});

export default function AddressBook({ addresses = [], onChange }) {
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError(false);
    try {
      const data = editingId
        ? await updateAddress(editingId, form)
        : await addAddress(form);
      onChange(data.addresses);
      setMessage(editingId ? "Dirección actualizada" : "Dirección guardada");
      resetForm();
    } catch (err) {
      setMessage(err.response?.data?.message || "No se pudo guardar");
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (addr) => {
    setEditingId(addr.id);
    setForm({
      label: addr.label || "Casa",
      address: addr.address,
      city: addr.city,
      department: addr.department,
      postalCode: addr.postalCode || "",
      isDefault: addr.isDefault,
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setConfirmModal({
      message: "¿Estás seguro de que deseas eliminar esta dirección? Esta acción no se puede deshacer.",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const data = await deleteAddress(id);
          onChange(data.addresses);
        } catch (err) {
          setMessage(err.response?.data?.message || "No se pudo eliminar la dirección");
          setError(true);
        }
      },
    });
  };

  return (
    <div className="address-book">
      <ConfirmModal
        isOpen={!!confirmModal}
        message={confirmModal?.message}
        onConfirm={confirmModal?.onConfirm}
        onCancel={() => setConfirmModal(null)}
      />
      {addresses.length === 0 && !showForm && (
        <p className="address-book__empty">No tienes direcciones guardadas.</p>
      )}

      <ul className="address-book__list">
        {addresses.map((addr) => (
          <li key={addr.id} className="address-book__item">
            <div>
              <strong>{addr.label}</strong>
              {addr.isDefault && (
                <span className="address-book__default">Predeterminada</span>
              )}
              <p>
                {addr.address}, {addr.city}, {addr.department}
              </p>
            </div>
            <div className="address-book__actions">
              <button type="button" className="cuenta-logout" onClick={() => startEdit(addr)}>
                Editar
              </button>
              <button
                type="button"
                className="cuenta-logout cuenta-logout--danger"
                onClick={() => handleDelete(addr.id)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!showForm ? (
        <button
          type="button"
          className="cuenta-logout"
          onClick={() => setShowForm(true)}
        >
          + Agregar dirección
        </button>
      ) : (
        <form className="auth-form address-book__form" onSubmit={handleSubmit}>
          <AuthFormField
            label="Etiqueta"
            name="label"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          />
          <AuthFormField
            label="Dirección"
            name="address"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            required
          />
          <AuthFormField
            label="Ciudad"
            name="city"
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            required
          />
          <AuthFormField
            label="Departamento"
            name="department"
            value={form.department}
            onChange={(e) =>
              setForm((p) => ({ ...p, department: e.target.value }))
            }
            required
          />
          <AuthFormField
            label="Código postal"
            name="postalCode"
            value={form.postalCode}
            onChange={(e) =>
              setForm((p) => ({ ...p, postalCode: e.target.value }))
            }
          />
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) =>
                setForm((p) => ({ ...p, isDefault: e.target.checked }))
              }
            />
            Usar como predeterminada
          </label>
          <AuthErrorAlert message={message} variant={error ? "error" : "success"} />
          <AuthSubmitButton loading={loading}>
            {editingId ? "Actualizar" : "Guardar dirección"}
          </AuthSubmitButton>
          <button type="button" className="cuenta-logout" onClick={resetForm}>
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}

"use client";

export default function ConfirmModal({
  isOpen,
  message = "¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.",
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="confirm-modal__message">{message}</p>
        <div className="confirm-modal__actions">
          <button type="button" className="admin-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

export default function GuestCheckoutModal({ isOpen, onContinue, onRegister }) {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onContinue}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="guest-modal-title" className="guest-modal__title">
          ¿Quieres guardar tu compra?
        </h2>
        <p className="confirm-modal__message">
          Puedes continuar tu compra sin crear cuenta. Pero si creas una cuenta
          podrás consultar tus pedidos, guardar tus datos y hacer seguimiento
          más fácil.
        </p>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="modal-action-btn"
            onClick={onContinue}
          >
            Continuar sin cuenta
          </button>
          <button
            type="button"
            className="modal-action-btn modal-action-btn--primary"
            onClick={onRegister}
          >
            Crear cuenta
          </button>
        </div>
      </div>
    </div>
  );
}

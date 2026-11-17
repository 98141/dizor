"use client";

// Permite imprimir o guardar como PDF las condiciones (Ley 1480, art. 50
// lit. d: condiciones imprimibles y descargables).
export default function PrintButton({ label = "Imprimir o guardar en PDF" }) {
  return (
    <p className="content-page__body-p no-print">
      <button type="button" className="checkout-btn" onClick={() => window.print()}>
        {label}
      </button>
    </p>
  );
}

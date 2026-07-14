"use client";

// Último fallback: se dispara solo si el propio root layout falla. Debe
// incluir sus propios <html>/<body> y no puede depender de ningún CSS
// importado (por eso usa estilos inline en vez de las clases de not-found.css).
export default function GlobalError({ reset }) {
  return (
    <html lang="es">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 400, margin: "0 0 1rem" }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#5c5c5c", margin: "0 0 1.5rem" }}>
            Ocurrió un error inesperado. Por favor intenta de nuevo.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#3d4f3a",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}

export default function AuthSubmitButton({
  children,
  loading,
  disabled,
  loadingLabel,
}) {
  const childText =
    typeof children === "string"
      ? children
      : Array.isArray(children)
        ? children.filter((c) => typeof c === "string").join(" ")
        : "";

  const inferredLabel = /guardar|actualizar|crear|publicar|registrar/i.test(
    childText
  )
    ? "Guardando…"
    : "Procesando…";

  return (
    <button
      type="submit"
      className="auth-submit"
      disabled={loading || disabled}
    >
      {loading ? loadingLabel || inferredLabel : children}
    </button>
  );
}

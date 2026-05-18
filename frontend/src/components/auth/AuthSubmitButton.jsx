export default function AuthSubmitButton({ children, loading, disabled }) {
  return (
    <button
      type="submit"
      className="auth-submit"
      disabled={loading || disabled}
    >
      {loading ? "Procesando..." : children}
    </button>
  );
}

export default function AuthErrorAlert({ message, variant = "error" }) {
  if (!message) return null;

  return (
    <div className={`auth-alert auth-alert--${variant}`} role="alert">
      {message}
    </div>
  );
}

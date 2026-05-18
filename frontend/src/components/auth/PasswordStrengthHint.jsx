import { getPasswordStrength } from "@/lib/validators/authSchemas";

export default function PasswordStrengthHint({ password }) {
  const { level, label } = getPasswordStrength(password);

  if (!password) return null;

  return (
    <span className="auth-field__hint">
      Seguridad: {label}
      <span
        style={{
          display: "inline-block",
          marginLeft: "0.5rem",
          width: `${level * 25}%`,
          maxWidth: "80px",
          height: "4px",
          background: "var(--color-accent)",
          verticalAlign: "middle",
        }}
        aria-hidden
      />
    </span>
  );
}

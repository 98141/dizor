export default function AuthFormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  hint,
  placeholder,
  autoComplete,
}) {
  return (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        className={`auth-field__input${error ? " auth-field__input--error" : ""}`}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      {hint && !error && <span className="auth-field__hint">{hint}</span>}
      {error && <span className="auth-field__error">{error}</span>}
    </div>
  );
}

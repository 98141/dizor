export const validateEmail = (email) => {
  if (!email?.trim()) return "El correo es obligatorio";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email.trim())) return "Correo inválido";
  return null;
};

export const validatePassword = (password) => {
  if (!password) return "La contraseña es obligatoria";
  if (password.length < 8) return "Mínimo 8 caracteres";
  if (!/[0-9]/.test(password)) return "Debe incluir al menos un número";
  return null;
};

export const validateName = (name) => {
  if (!name?.trim()) return "El nombre es obligatorio";
  if (name.trim().length > 100) return "Máximo 100 caracteres";
  return null;
};

export const validatePasswordConfirm = (password, confirm) => {
  if (!confirm) return "Confirma tu contraseña";
  if (password !== confirm) return "Las contraseñas no coinciden";
  return null;
};

export const getPasswordStrength = (password) => {
  if (!password) return { level: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { level: 1, label: "Débil" };
  if (score <= 2) return { level: 2, label: "Regular" };
  if (score <= 3) return { level: 3, label: "Buena" };
  return { level: 4, label: "Fuerte" };
};

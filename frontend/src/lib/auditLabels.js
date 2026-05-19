export const AUDIT_MODULE_LABELS = {
  auth: "Autenticación",
  orders: "Pedidos",
  catalog: "Catálogo",
  users: "Usuarios",
  settings: "Configuración",
  special_requests: "Solicitudes",
  marketing: "Marketing",
  content: "Contenido",
};

export const AUDIT_ACTION_LABELS = {
  register: "Registro",
  login: "Inicio de sesión",
  login_failed: "Intento fallido",
  logout: "Cierre de sesión",
  password_reset_requested: "Recuperación solicitada",
  password_reset: "Contraseña restablecida",
  password_updated: "Contraseña actualizada",
  order_created: "Pedido creado",
  order_status_changed: "Estado de pedido",
  payment_confirmed: "Pago confirmado",
  tracking_registered: "Guía registrada",
  product_created: "Producto creado",
  product_updated: "Producto actualizado",
  product_deleted: "Producto eliminado",
  staff_user_created: "Usuario staff creado",
  staff_user_status_changed: "Estado de usuario",
  settings_updated: "Configuración actualizada",
  special_request_status_changed: "Estado solicitud",
  special_request_quoted: "Cotización enviada",
};

export const getAuditModuleLabel = (module) =>
  AUDIT_MODULE_LABELS[module] || module;

export const getAuditActionLabel = (action) =>
  AUDIT_ACTION_LABELS[action] || action.replace(/_/g, " ");

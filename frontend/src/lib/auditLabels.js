// Presentation labels for audit events. Sprint 08 adds the modules and actions the backend
// already records (cms, coupons, pqr, reviews…); unknown values still fall back to the raw key.
export const AUDIT_MODULE_LABELS = {
  auth: "Autenticación",
  orders: "Pedidos",
  catalog: "Catálogo",
  users: "Usuarios",
  settings: "Configuración",
  special_requests: "Solicitudes",
  marketing: "Marketing",
  content: "Contenido",
  cms: "Contenido",
  coupons: "Cupones",
  pqr: "PQR",
  reviews: "Reseñas",
};

export const AUDIT_ACTION_LABELS = {
  register: "Registro",
  login: "Inicio de sesión",
  login_failed: "Intento fallido",
  logout: "Cierre de sesión",
  revoked: "Sesión revocada",
  password_reset_requested: "Recuperación solicitada",
  password_reset: "Contraseña restablecida",
  password_updated: "Contraseña actualizada",
  order_created: "Pedido creado",
  order_status_changed: "Estado de pedido",
  payment_confirmed: "Pago confirmado",
  payment_incident_resolved: "Incidencia de pago resuelta",
  wompi_query_failures_resolved: "Consultas de pago resueltas",
  tracking_registered: "Guía registrada",
  product_created: "Producto creado",
  product_updated: "Producto actualizado",
  product_deleted: "Producto eliminado",
  staff_user_created: "Usuario staff creado",
  staff_user_status_changed: "Estado de usuario",
  settings_updated: "Configuración actualizada",
  special_request_status_changed: "Estado solicitud",
  special_request_quoted: "Cotización enviada",
  customer_request_status: "Estado de PQR",
  coupon_created: "Cupón creado",
  coupon_updated: "Cupón actualizado",
  coupon_toggled: "Cupón activado o desactivado",
  coupon_deleted: "Cupón eliminado",
  cms_home_updated: "Inicio de la tienda actualizado",
  cms_page_created: "Página creada",
  cms_page_updated: "Página actualizada",
  cms_page_deleted: "Página eliminada",
  cms_banner_created: "Banner creado",
  cms_banner_updated: "Banner actualizado",
  cms_banner_deleted: "Banner eliminado",
  home_image_created: "Imagen de inicio creada",
  home_image_updated: "Imagen de inicio actualizada",
  home_image_deleted: "Imagen de inicio eliminada",
  review_approved: "Reseña aprobada",
  review_rejected: "Reseña rechazada",
  brand_review_created: "Reseña de marca creada",
};

export const AUDIT_ROLE_LABELS = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  vendedor: "Vendedor",
  cliente: "Cliente",
};

export const getAuditModuleLabel = (module) =>
  AUDIT_MODULE_LABELS[module] || module || "—";

export const getAuditActionLabel = (action) =>
  AUDIT_ACTION_LABELS[action] || String(action || "—").replace(/_/g, " ");

export const getAuditRoleLabel = (role) => AUDIT_ROLE_LABELS[role] || role || "Sin rol";

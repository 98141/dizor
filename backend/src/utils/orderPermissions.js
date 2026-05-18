const ADMIN_ROLES = ["superadmin", "admin"];
const STAFF_ROLES = ["superadmin", "admin", "vendedor"];

const VENDOR_STATUS_UPDATES = [
  "pago_pendiente",
  "pagado",
  "en_preparacion",
  "enviado",
];

exports.isStaff = (role) => STAFF_ROLES.includes(role);
exports.isAdmin = (role) => ADMIN_ROLES.includes(role);

exports.canViewOrderCosts = (role) => ADMIN_ROLES.includes(role);

exports.canUpdateOrderStatus = (role, newStatus) => {
  if (ADMIN_ROLES.includes(role)) return true;
  if (role === "vendedor") {
    return VENDOR_STATUS_UPDATES.includes(newStatus);
  }
  return false;
};

exports.canConfirmPayment = (role) => STAFF_ROLES.includes(role);

exports.canDeleteOrder = (role) => ADMIN_ROLES.includes(role);

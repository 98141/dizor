export const getAuthRedirect = (role) => {
  if (role === "superadmin" || role === "admin") return "/admin";
  if (role === "vendedor") return "/vendedor";
  return "/cuenta";
};

/**
 * Destino post-login.
 * @param {string} role
 * @param {string | null | undefined} nextPath — ruta relativa segura (?next=)
 */
export const getAuthRedirect = (role, nextPath) => {
  if (
    typeof nextPath === "string" &&
    nextPath.startsWith("/") &&
    !nextPath.startsWith("//") &&
    !nextPath.startsWith("/login") &&
    !nextPath.startsWith("/register")
  ) {
    return nextPath;
  }
  if (role === "superadmin" || role === "admin") return "/admin";
  if (role === "vendedor") return "/vendedor";
  return "/cuenta";
};

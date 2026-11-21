// Presentation only. Backend authorization remains unchanged.
const admins = ["admin", "superadmin"], staff = [...admins, "vendedor"];
export const CONTENT_TABS = [
  { id: "home", label: "Página de inicio", area: "store" },
  { id: "imagenes", label: "Imágenes", area: "store" },
  { id: "banners", label: "Banners", area: "store" },
  { id: "pages", label: "Páginas informativas", area: "store" },
  { id: "resenas", label: "Reseñas", area: "store" },
  { id: "appearance", label: "Apariencia", area: "store" },
  { id: "popup", label: "Popup", area: "marketing" },
  { id: "newsletter", label: "Newsletter", area: "marketing" },
  { id: "carritos", label: "Carritos", area: "marketing" },
  { id: "exports", label: "Exportaciones", area: "tools" },
];
export function contentTab(value, fallback = "home") {
  return CONTENT_TABS.find(t => t.id === value) || CONTENT_TABS.find(t => t.id === fallback) || CONTENT_TABS[0];
}
export function contentHref(tab, query = "") {
  const section = contentTab(tab), params = new URLSearchParams(query);
  params.set("tab", section.id);
  if (section.id !== "exports") params.delete("scope");
  return `${section.area === "marketing" ? "/admin/marketing" : "/admin/contenido"}?${params}`;
}
const child = (id, label, href, roles = admins) => ({ id, label, href, roles });
export function getNavigation(role, variant = "admin") {
  if (!staff.includes(role)) return [];
  const vendor = role === "vendedor" || variant === "vendedor", base = vendor ? "/vendedor" : "/admin";
  const modules = [
    { id: "home", label: "Inicio", icon: "home", href: base, group: "Operación diaria", roles: staff,
      children: vendor ? [] : [child("alerts", "Alertas importantes", "/admin/alertas")] },
    { id: "orders", label: "Pedidos", icon: "orders", href: `${base}/pedidos`, group: "Operación diaria", roles: staff,
      children: vendor ? [] : [child("order-exports", "Exportar pedidos (CSV)", "/admin/contenido?tab=exports&scope=orders")] },
    { id: "products", label: "Productos", icon: "products", href: "/admin/productos", group: "Operación diaria", roles: admins,
      children: [child("product-list", "Productos", "/admin/productos"), child("stock", "Existencias", "/admin/productos?view=stock"), child("movements", "Movimientos", "/admin/productos?view=movements"), child("taxonomy", "Configuración del catálogo", "/admin/catalogo")] },
    { id: "attention", label: vendor ? "Solicitudes" : "Atención al cliente", icon: "attention", href: "/admin/solicitudes", group: "Operación diaria", roles: staff,
      children: vendor ? [] : [child("requests", "Solicitudes especiales", "/admin/solicitudes", staff), child("pqr", "PQR y datos personales", "/admin/pqr")] },
    { id: "store", label: "Tienda online", icon: "store", href: contentHref("home"), group: "Administración", roles: admins,
      children: CONTENT_TABS.filter(t => t.area === "store").map(t => child(t.id, t.label, contentHref(t.id))) },
    { id: "marketing", label: "Marketing", icon: "marketing", href: "/admin/marketing", group: "Administración", roles: admins,
      children: [child("coupons", "Cupones", "/admin/cupones"), ...CONTENT_TABS.filter(t => t.area === "marketing").map(t => child(t.id, t.label, contentHref(t.id))), child("exports", "Exportaciones históricas", "/admin/contenido?tab=exports")] },
    { id: "finance", label: "Finanzas", icon: "finance", href: "/admin/finanzas", group: "Administración", roles: ["superadmin"], children: [] },
    { id: "settings", label: "Configuración", icon: "settings", href: "/admin/configuracion", group: "Administración", roles: admins,
      children: [child("settings", "Configuración de tienda", "/admin/configuracion"), child("users", "Usuarios y personal", "/admin/usuarios", ["superadmin"]), child("audit", "Auditoría", "/admin/auditoria")] },
  ];
  return modules.filter(m => m.roles.includes(role) && (!vendor || ["home", "orders", "attention"].includes(m.id)))
    .map(m => ({ ...m, children: m.children.filter(c => c.roles.includes(role)) }));
}
const inside = (path, base) => path === base || path.startsWith(`${base}/`);
export function locateNavigation(pathname, query = "", role = "admin", variant = "admin") {
  const params = new URLSearchParams(query), modules = getNavigation(role, variant);
  let moduleId, childId;
  if (inside(pathname, "/admin/productos") || pathname === "/admin/inventario" || pathname === "/admin/catalogo") {
    moduleId = "products";
    childId = pathname === "/admin/catalogo" ? "taxonomy" : pathname === "/admin/inventario" || params.get("view") === "movements" ? "movements" : params.get("view") === "stock" ? "stock" : "product-list";
  } else if (inside(pathname, "/admin/pedidos") || inside(pathname, "/vendedor/pedidos")) moduleId = "orders";
  else if (inside(pathname, "/admin/solicitudes") || pathname === "/admin/pqr") { moduleId = "attention"; childId = pathname === "/admin/pqr" ? "pqr" : "requests"; }
  else if (["/admin/configuracion", "/admin/usuarios", "/admin/auditoria"].includes(pathname)) { moduleId = "settings"; childId = pathname.endsWith("usuarios") ? "users" : pathname.endsWith("auditoria") ? "audit" : "settings"; }
  else if (pathname === "/admin/finanzas") moduleId = "finance";
  else if (pathname === "/admin/cupones") { moduleId = "marketing"; childId = "coupons"; }
  else if (["/admin/contenido", "/admin/marketing", "/admin/resenas", "/admin/home-imagenes"].includes(pathname)) {
    const tab = contentTab(pathname === "/admin/resenas" ? "resenas" : pathname === "/admin/home-imagenes" ? "imagenes" : params.get("tab"), pathname === "/admin/marketing" ? "popup" : "home");
    moduleId = tab.area === "tools" ? params.get("scope") === "orders" ? "orders" : "marketing" : tab.area;
    childId = tab.id === "exports" ? ({ orders: "order-exports", newsletter: "newsletter", carts: "carritos" })[params.get("scope")] || "exports" : tab.id;
  } else if (pathname === "/admin/alertas") { moduleId = "home"; childId = "alerts"; }
  else if (["/admin", "/vendedor"].includes(pathname)) moduleId = "home";
  const currentModule = modules.find(m => m.id === moduleId);
  return { module: currentModule, child: currentModule?.children.find(c => c.id === childId) };
}
export function returnToRequests(candidate, base = "/admin/solicitudes") {
  return typeof candidate === "string" && (candidate === base || candidate.startsWith(`${base}?`)) ? candidate : base;
}

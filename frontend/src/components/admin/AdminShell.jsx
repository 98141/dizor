"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import AlertBell from "./AlertBell";

const adminLinks = [
  { href: "/admin", label: "Dashboard", roles: ["superadmin", "admin"] },
  { href: "/admin/auditoria", label: "Auditoría", roles: ["superadmin", "admin"] },
  { href: "/admin/inventario", label: "Inventario", roles: ["superadmin", "admin"] },
  { href: "/admin/pedidos", label: "Pedidos", roles: ["superadmin", "admin"] },
  { href: "/admin/solicitudes", label: "Solicitudes", roles: ["superadmin", "admin", "vendedor"] },
  { href: "/admin/productos", label: "Productos", roles: ["superadmin", "admin"] },
  { href: "/admin/catalogo", label: "Catálogo", roles: ["superadmin", "admin"] },
  { href: "/admin/contenido", label: "Contenido", roles: ["superadmin", "admin"] },
  { href: "/admin/cupones", label: "Cupones", roles: ["superadmin", "admin"] },
  { href: "/admin/alertas", label: "Alertas", roles: ["superadmin", "admin"] },
  { href: "/admin/configuracion", label: "Configuración", roles: ["superadmin", "admin"] },
  { href: "/admin/usuarios", label: "Usuarios", roles: ["superadmin"] },
  { href: "/admin/finanzas", label: "Finanzas", roles: ["superadmin"] },
];

const vendorLinks = [
  { href: "/vendedor", label: "Dashboard", roles: ["superadmin", "admin", "vendedor"] },
  { href: "/vendedor/pedidos", label: "Pedidos", roles: ["superadmin", "admin", "vendedor"] },
  { href: "/admin/solicitudes", label: "Solicitudes", roles: ["superadmin", "admin", "vendedor"] },
];

export default function AdminShell({ children, variant = "admin" }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { siteName } = useSiteConfig();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = variant === "vendedor" ? vendorLinks : adminLinks;
  const visibleLinks = links.filter((l) => l.roles.includes(user?.role));
  const showBell = ["superadmin", "admin"].includes(user?.role);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href) => {
    if (href === "/admin" || href === "/vendedor") return pathname === href;
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const NavLinks = ({ className, onNavigate }) => (
    <nav className={className}>
      {visibleLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={isActive(link.href) ? "active" : ""}
          onClick={onNavigate}
        >
          {link.label}
        </Link>
      ))}
      <Link href="/" onClick={onNavigate}>Ver tienda</Link>
      <button
        type="button"
        className="admin-nav__logout"
        onClick={handleLogout}
      >
        Cerrar sesión
      </button>
    </nav>
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-sidebar__brand">{siteName} {variant}</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.85, margin: "-1rem 0 1.5rem" }}>
          {user?.name}
        </p>
        <NavLinks className="admin-sidebar__nav" />
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <button
            type="button"
            className="admin-topbar__menu-btn"
            aria-label="Menú"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            ☰
          </button>
          <p className="admin-topbar__brand">{siteName} {variant}</p>
          {showBell && <AlertBell />}
        </div>
        <nav
          className={`admin-mobile-nav${mobileOpen ? " admin-mobile-nav--open" : ""}`}
        >
          <NavLinks
            className="admin-mobile-nav__links"
            onNavigate={() => setMobileOpen(false)}
          />
        </nav>
        {children}
      </div>
    </div>
  );
}

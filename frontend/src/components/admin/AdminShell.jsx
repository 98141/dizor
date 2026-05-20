"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const adminLinks = [
  { href: "/admin", label: "Dashboard", roles: ["superadmin", "admin"] },
  { href: "/admin/auditoria", label: "Auditoría", roles: ["superadmin", "admin"] },
  {
    href: "/admin/inventario",
    label: "Inventario",
    roles: ["superadmin", "admin"],
  },
  { href: "/admin/pedidos", label: "Pedidos", roles: ["superadmin", "admin"] },
  {
    href: "/admin/solicitudes",
    label: "Solicitudes",
    roles: ["superadmin", "admin", "vendedor"],
  },
  { href: "/admin/productos", label: "Productos", roles: ["superadmin", "admin"] },
  { href: "/admin/catalogo", label: "Catálogo", roles: ["superadmin", "admin"] },
  { href: "/admin/contenido", label: "Contenido", roles: ["superadmin", "admin"] },
  { href: "/admin/marketing", label: "Marketing", roles: ["superadmin", "admin"] },
  { href: "/admin/pos", label: "POS", roles: ["superadmin", "admin", "vendedor"] },
  { href: "/admin/cupones", label: "Cupones", roles: ["superadmin", "admin"] },
  {
    href: "/admin/configuracion",
    label: "Configuración",
    roles: ["superadmin", "admin"],
  },
  { href: "/admin/usuarios", label: "Usuarios", roles: ["superadmin"] },
  { href: "/admin/finanzas", label: "Finanzas", roles: ["superadmin"] },
];

const vendorLinks = [
  { href: "/vendedor", label: "Dashboard", roles: ["superadmin", "admin", "vendedor"] },
  { href: "/vendedor/pedidos", label: "Pedidos", roles: ["superadmin", "admin", "vendedor"] },
  { href: "/admin/pos", label: "POS", roles: ["superadmin", "admin", "vendedor"] },
  {
    href: "/admin/solicitudes",
    label: "Solicitudes",
    roles: ["superadmin", "admin", "vendedor"],
  },
];

export default function AdminShell({ children, variant = "admin" }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links = variant === "vendedor" ? vendorLinks : adminLinks;
  const visibleLinks = links.filter((l) => l.roles.includes(user?.role));

  const isActive = (href) => {
    if (href === "/admin" || href === "/vendedor") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const NavLinks = ({ className }) => (
    <nav className={className}>
      {visibleLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={isActive(link.href) ? "active" : ""}
        >
          {link.label}
        </Link>
      ))}
      <Link href="/">Ver tienda</Link>
      <button
        type="button"
        onClick={async () => {
          await logout();
          window.location.href = "/login";
        }}
        style={{
          marginTop: "1rem",
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "inherit",
          padding: "0.5rem",
          borderRadius: "4px",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        Cerrar sesión
      </button>
    </nav>
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <p className="admin-sidebar__brand">Dizor {variant}</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.85, margin: "-1rem 0 1.5rem" }}>
          {user?.name}
        </p>
        <NavLinks className="admin-sidebar__nav" />
      </aside>

      <div className="admin-main">
        <NavLinks className="admin-mobile-nav" />
        {children}
      </div>
    </div>
  );
}

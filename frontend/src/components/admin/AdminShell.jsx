"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { getNavigation, locateNavigation } from "@/lib/adminNavigation.mjs";
import AlertBell from "./AlertBell";
const ICONS = {
  home: "M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10",
  orders: "M6 4h12v17H6zM9 4V2h6v2M9 9h6M9 13h6M9 17h4",
  products: "M3 7 12 2l9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10",
  attention: "M4 5h16v12H9l-5 4zM8 9h8M8 13h5",
  store: "M3 9h18l-2-6H5zM4 9v12h16V9M9 21v-7h6v7",
  marketing: "M3 10h5l12-6v16L8 14H3zM8 14l2 7h4l-3-6",
  finance: "M4 21V11h4v10M10 21V7h4v14M16 21V3h4v18",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
};
function Icon({ name }) { return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name]} /></svg>; }
function Navigation({ modules, selected, pathname, expanded, onToggle, onNavigate, onLogout, label }) {
  return <nav className="admin-navigation" aria-label={label}>
    {modules.map((m,index) => {
      const heading = index === 0 || modules[index - 1].group !== m.group;
      const active = selected.module?.id === m.id, open = expanded === m.id;
      const id = `${label === "Navegación móvil" ? "mobile" : "desktop"}-${m.id}`;
      return <div key={m.id} className="admin-nav-module">
        {heading && <p className="admin-nav-group">{m.group}</p>}
        <div className={`admin-nav-row${active ? " active" : ""}`}>
          <Link href={m.href} onClick={onNavigate} aria-current={active ? !selected.child && pathname === m.href.split("?")[0] ? "page" : "location" : undefined}><Icon name={m.icon} /><span>{m.label}</span></Link>
          {!!m.children.length && <button type="button" aria-label={`${open ? "Contraer" : "Expandir"} ${m.label}`} aria-expanded={open} aria-controls={id} onClick={() => onToggle(m.id)}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d={open ? "m5 12 5-5 5 5" : "m5 8 5 5 5-5"} /></svg></button>}
        </div>
        {!!m.children.length && <ul id={id} className="admin-nav-children" hidden={!open}>{m.children.map(c => <li key={c.id}><Link href={c.href} onClick={onNavigate} aria-current={active && selected.child?.id === c.id ? "page" : undefined}>{c.label}</Link></li>)}</ul>}
      </div>;
    })}
    <div className="admin-nav-footer"><Link href="/" onClick={onNavigate}>Ver tienda</Link><button type="button" className="admin-nav__logout" onClick={onLogout}>Cerrar sesión</button></div>
  </nav>;
}
export default function AdminShell(props) {
  return <Suspense fallback={<p className="auth-loading" role="status">Cargando navegación…</p>}><Shell {...props} /></Suspense>;
}
function Shell({ children, variant = "admin" }) {
  const pathname = usePathname(), searchParams = useSearchParams(), route = `${pathname}?${searchParams}`;
  const { user, loadingAuth, logout } = useAuth(), { siteName } = useSiteConfig();
  const role = user?.role, vendor = role === "vendedor" || variant === "vendedor";
  const modules = getNavigation(role, variant), selected = locateNavigation(pathname, searchParams.toString(), role, variant);
  const selection = `${role}:${variant}:${selected.module?.id || ""}`;
  const [expansion, setExpansion] = useState(null), [drawer, setDrawer] = useState(null), [logoutError, setLogoutError] = useState("");
  const mobileOpen = drawer === route, expanded = expansion?.selection === selection ? expansion.id : selected.module?.id;
  const menuButton = useRef(null), panel = useRef(null), background = useRef(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const priorOverflow = document.body.style.overflow, backdrop = background.current, trigger = menuButton.current;
    document.body.style.overflow = "hidden";
    if (backdrop) backdrop.inert = true;
    panel.current?.querySelector("button")?.focus();
    const keydown = event => {
      if (event.key === "Escape") { event.preventDefault(); setDrawer(null); return; }
      if (event.key !== "Tab") return;
      const focusable = [...panel.current.querySelectorAll('a[href],button:not([disabled])')].filter(e => e.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const focusin = event => { if (!panel.current?.contains(event.target)) panel.current?.querySelector("button")?.focus(); };
    const media = window.matchMedia("(min-width: 900px)");
    const resize = () => { if (media.matches) setDrawer(null); };
    document.addEventListener("keydown", keydown); document.addEventListener("focusin", focusin); media.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = priorOverflow; if (backdrop) backdrop.inert = false;
      document.removeEventListener("keydown", keydown); document.removeEventListener("focusin", focusin); media.removeEventListener("change", resize);
      trigger?.focus();
    };
  }, [mobileOpen]);
  const handleLogout = async () => {
    try { await logout(); window.location.assign("/login"); }
    catch { setLogoutError("No se pudo cerrar la sesión. Inténtalo otra vez."); }
  };
  if (loadingAuth || !user) return <p className="auth-loading" role="status">Cargando navegación…</p>;
  const navProps = { modules, selected, pathname, expanded, onToggle: id => setExpansion({ selection, id: expanded === id ? null : id }), onNavigate: () => setDrawer(null), onLogout: handleLogout };
  const current = selected.child?.label || selected.module?.label || "Área de trabajo";
  return <div className="admin-shell">
    <a className="admin-skip-link" href="#admin-workspace">Ir al contenido</a>
    <aside className="admin-sidebar"><p className="admin-sidebar__brand">{siteName}</p><p className="admin-sidebar__identity">{user.name}<span>{vendor ? "Vendedor" : role === "superadmin" ? "Superadministrador" : "Administrador"}</span></p><Navigation {...navProps} label="Navegación principal" /></aside>
    <div className="admin-main" ref={background}>
      <header className="admin-topbar"><button ref={menuButton} type="button" className="admin-topbar__menu-btn" aria-label="Menú" aria-expanded={mobileOpen} aria-controls="admin-mobile-menu" onClick={() => setDrawer(route)}>☰</button><div className="admin-location"><span>{siteName} · {vendor ? "Vendedor" : "Administración"}</span><nav aria-label="Ubicación actual">{selected.module && selected.child && selected.module.label !== selected.child.label ? <><Link href={selected.module.href}>{selected.module.label}</Link><span aria-hidden="true"> / </span></> : null}<span aria-current="page">{current}</span></nav></div>{["superadmin", "admin"].includes(role) && <AlertBell />}</header>
      <main id="admin-workspace" tabIndex={0}>{logoutError && <p role="alert">{logoutError}</p>}{["attention", "settings"].includes(selected.module?.id) && !!selected.module.children.length && <nav className="admin-context-nav" aria-label={`Secciones de ${selected.module.label}`}>{selected.module.children.map(c => <Link key={c.id} href={c.href} aria-current={selected.child?.id === c.id ? "page" : undefined}>{c.label}</Link>)}</nav>}{children}</main>
    </div>
    {mobileOpen && <div className="admin-mobile-nav--open"><div className="admin-mobile-nav__backdrop" onClick={() => setDrawer(null)} aria-hidden="true" /><section id="admin-mobile-menu" ref={panel} role="dialog" aria-modal="true" aria-label="Menú de navegación" className="admin-mobile-nav__links"><div className="admin-mobile-heading"><strong>{siteName}</strong><button type="button" className="admin-mobile-nav__close" aria-label="Cerrar menú" onClick={() => setDrawer(null)}>✕</button></div><p className="admin-sidebar__identity">{user.name}<span>{vendor ? "Vendedor" : "Administración"}</span></p><Navigation {...navProps} label="Navegación móvil" /></section></div>}
  </div>;
}

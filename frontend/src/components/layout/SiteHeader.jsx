"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function SiteHeader() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    router.push(`/catalogo?q=${encodeURIComponent(search.trim())}`);
    setMobileOpen(false);
  };

  const accountHref = isAuthenticated ? "/cuenta" : "/login";

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <button
          type="button"
          className="site-header__icon-btn site-header__menu-btn"
          aria-label="Menú"
          onClick={() => setMobileOpen((o) => !o)}
        >
          ☰
        </button>

        <Link href="/" className="site-header__logo">
          Dizor
        </Link>

        <nav className="site-header__nav" aria-label="Principal">
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/catalogo?featured=true">Destacados</Link>
          <Link href="/catalogo?isNew=true">Novedades</Link>
        </nav>

        <form className="site-header__search" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Buscar sombreros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar productos"
          />
        </form>

        <div className="site-header__actions">
          <Link
            href={accountHref}
            className="site-header__icon-btn"
            aria-label="Mi cuenta"
            title={isAuthenticated ? user?.name : "Iniciar sesión"}
          >
            👤
          </Link>
          <Link
            href="/catalogo"
            className="site-header__icon-btn"
            aria-label="Carrito"
            title="Carrito (próximamente)"
          >
            🛒
          </Link>
          <a
            href="https://wa.me/573000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="site-header__icon-btn"
            aria-label="WhatsApp"
            title="WhatsApp"
          >
            WA
          </a>
        </div>
      </div>

      <nav
        className={`site-header__mobile-nav${mobileOpen ? " site-header__mobile-nav--open" : ""}`}
        aria-label="Menú móvil"
      >
        <Link href="/catalogo" onClick={() => setMobileOpen(false)}>
          Catálogo
        </Link>
        <Link href="/catalogo?featured=true" onClick={() => setMobileOpen(false)}>
          Destacados
        </Link>
        <Link href={accountHref} onClick={() => setMobileOpen(false)}>
          {isAuthenticated ? "Mi cuenta" : "Iniciar sesión"}
        </Link>
        <form onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </nav>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { trackSearch } from "@/lib/analytics/events";

const MIN_SEARCH_CHARS = 1;
const SEARCH_DEBOUNCE_MS = 300;

function useHeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(searchParams.get("term") || "");
  }, [searchParams]);

  const pushSearch = useCallback(
    (term) => {
      const trimmed = term.trim();
      if (pathname === "/catalogo") {
        const params = new URLSearchParams(searchParams.toString());
        if (trimmed) params.set("term", trimmed);
        else params.delete("term");
        params.delete("page");
        router.push(`/catalogo?${params.toString()}`);
        return;
      }
      if (trimmed) {
        router.push(`/catalogo?term=${encodeURIComponent(trimmed)}`);
      }
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const trimmed = search.trim();
    const urlTerm = searchParams.get("term") || "";

    if (trimmed.length < MIN_SEARCH_CHARS) {
      if (pathname === "/catalogo" && urlTerm) {
        const timer = setTimeout(() => pushSearch(""), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
      }
      return undefined;
    }

    if (trimmed === urlTerm) return undefined;

    const timer = setTimeout(() => pushSearch(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, pathname, pushSearch, searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Solo la búsqueda confirmada (submit del formulario) dispara `search`;
    // el debounce automático de arriba (cada tecla) nunca lo hace.
    trackSearch(search.trim());
    pushSearch(search);
  };

  return { search, setSearch, handleSubmit };
}

function SiteHeaderInner() {
  const { user, isAuthenticated } = useAuth();
  const { itemCount, hydrated } = useCart();
  const { siteName } = useSiteConfig();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { search, setSearch, handleSubmit } = useHeaderSearch();

  useEffect(() => {
    setMobileOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  const onSubmit = (e) => {
    handleSubmit(e);
    setMobileOpen(false);
    setMobileSearchOpen(false);
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
          {siteName}
        </Link>

        <nav className="site-header__nav" aria-label="Principal">
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/catalogo?featured=true">Destacados</Link>
          <Link href="/catalogo?isNew=true">Novedades</Link>
          <Link href="/personalizar">Personalizar</Link>
          <Link href="/pedido-mayor">Por mayor</Link>
        </nav>

        <form className="site-header__search" onSubmit={onSubmit}>
          <input
            type="search"
            placeholder="Buscar sombreros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar productos"
            autoComplete="off"
          />
          <button
            type="submit"
            className="site-header__search-submit"
            aria-label="Buscar"
          >
            ⌕
          </button>
        </form>

        <div className="site-header__actions">
          <button
            type="button"
            className="site-header__icon-btn site-header__mobile-search-btn"
            aria-label="Buscar"
            title="Buscar"
            onClick={() => setMobileSearchOpen((o) => !o)}
          >
            ⌕
          </button>
          <Link
            href={accountHref}
            className="site-header__icon-btn"
            aria-label="Mi cuenta"
            title={isAuthenticated ? user?.name : "Iniciar sesión"}
          >
            👤
          </Link>
          <Link
            href="/carrito"
            className="site-header__icon-btn site-header__cart-btn"
            aria-label="Carrito"
            title="Carrito"
          >
            🛒
            {hydrated && itemCount > 0 && (
              <span className="site-header__cart-badge">{itemCount}</span>
            )}
          </Link>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="site-header__search-overlay">
          <form onSubmit={onSubmit}>
            <input
              type="search"
              placeholder="¿Qué sombrero buscas?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              autoComplete="off"
              aria-label="Buscar productos"
            />
            <button type="submit" aria-label="Buscar">
              ⌕
            </button>
            <button
              type="button"
              aria-label="Cerrar búsqueda"
              onClick={() => setMobileSearchOpen(false)}
            >
              ×
            </button>
          </form>
        </div>
      )}

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
        <Link href="/catalogo?isNew=true" onClick={() => setMobileOpen(false)}>
          Novedades
        </Link>
        <Link href="/personalizar" onClick={() => setMobileOpen(false)}>
          Personalizar
        </Link>
        <Link href="/pedido-mayor" onClick={() => setMobileOpen(false)}>
          Por mayor
        </Link>
        <Link href={accountHref} onClick={() => setMobileOpen(false)}>
          {isAuthenticated ? "Mi cuenta" : "Iniciar sesión"}
        </Link>
      </nav>
    </header>
  );
}

export default function SiteHeader() {
  return (
    <Suspense fallback={<header className="site-header" />}>
      <SiteHeaderInner />
    </Suspense>
  );
}

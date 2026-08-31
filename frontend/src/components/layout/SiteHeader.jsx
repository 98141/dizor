"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { trackSearch } from "@/lib/analytics/events";
import SiteLogo from "./SiteLogo";

const MIN_SEARCH_CHARS = 1;
const SEARCH_DEBOUNCE_MS = 300;

const NAV_LINKS = [
  { href: "/catalogo", label: "Catálogo" },
  { href: "/catalogo?featured=true", label: "Destacados" },
  { href: "/catalogo?isNew=true", label: "Novedades" },
  { href: "/personalizar", label: "Personalizar" },
  { href: "/pedido-mayor", label: "Por mayor" },
];

function isNavActive(href, pathname, searchParams) {
  const url = new URL(href, "https://example.com");
  const path = url.pathname;
  const wantsFeatured = url.searchParams.get("featured") === "true";
  const wantsNew = url.searchParams.get("isNew") === "true";
  const featured = searchParams.get("featured") === "true";
  const isNew = searchParams.get("isNew") === "true";

  if (path === "/catalogo") {
    if (wantsFeatured) return pathname === "/catalogo" && featured;
    if (wantsNew) return pathname === "/catalogo" && isNew;
    // Catálogo general: listado sin esos filtros, o ficha de producto
    if (pathname.startsWith("/producto/")) return true;
    return pathname === "/catalogo" && !featured && !isNew;
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { search, setSearch, handleSubmit } = useHeaderSearch();

  useEffect(() => {
    setMobileOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Bloquea el scroll del fondo mientras el menú/búsqueda móvil está abierto
  useEffect(() => {
    const open = mobileOpen || mobileSearchOpen;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, mobileSearchOpen]);

  const onSubmit = (e) => {
    handleSubmit(e);
    setMobileOpen(false);
    setMobileSearchOpen(false);
  };

  const accountHref = isAuthenticated ? "/cuenta" : "/login";
  const homeActive = pathname === "/";
  const accountActive =
    pathname.startsWith("/cuenta") ||
    pathname === "/login" ||
    pathname === "/register";
  const cartActive = pathname.startsWith("/carrito");

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="site-header__inner">
        <button
          type="button"
          className="site-header__icon-btn site-header__menu-btn"
          aria-label="Menú"
          onClick={() => setMobileOpen((o) => !o)}
        >
          ☰
        </button>

        <SiteLogo active={homeActive} />

        <nav className="site-header__nav" aria-label="Principal">
          {NAV_LINKS.map((item) => {
            const active = isNavActive(item.href, pathname, searchParams);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "is-active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
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
            className={`site-header__icon-btn${accountActive ? " is-active" : ""}`}
            aria-label="Mi cuenta"
            aria-current={accountActive ? "page" : undefined}
            title={isAuthenticated ? user?.name : "Iniciar sesión"}
          >
            👤
          </Link>
          <Link
            href="/carrito"
            className={`site-header__icon-btn site-header__cart-btn${cartActive ? " is-active" : ""}`}
            aria-label="Carrito"
            aria-current={cartActive ? "page" : undefined}
            title="Carrito"
          >
            🛒
            {hydrated && itemCount > 0 && (
              <span className="site-header__cart-badge">{itemCount}</span>
            )}
          </Link>
        </div>
      </div>

      {(mobileOpen || mobileSearchOpen) && (
        <button
          type="button"
          className="site-header__backdrop"
          aria-label="Cerrar menú"
          onClick={() => {
            setMobileOpen(false);
            setMobileSearchOpen(false);
          }}
        />
      )}

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
        {NAV_LINKS.map((item) => {
          const active = isNavActive(item.href, pathname, searchParams);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href={accountHref}
          className={accountActive ? "is-active" : undefined}
          aria-current={accountActive ? "page" : undefined}
          onClick={() => setMobileOpen(false)}
        >
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

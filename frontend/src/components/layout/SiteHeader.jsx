"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { trackSearch } from "@/lib/analytics/events";
import { categoryHref, taxonomyId } from "@/lib/catalogTaxonomy";
import SiteLogo from "./SiteLogo";
import {
  IconAccount,
  IconCart,
  IconChevronDown,
  IconClose,
  IconFavorites,
  IconFavoritesFilled,
  IconMenu,
  IconSearch,
} from "./HeaderIcons";

const MIN_SEARCH_CHARS = 1;
const SEARCH_DEBOUNCE_MS = 300;
/** Categorías visibles en desktop antes de “Más”. */
const MAX_VISIBLE_CATEGORIES = 5;

const STATIC_NAV = [
  { href: "/catalogo?isNew=true", label: "Novedades", id: "new" },
  { href: "/personalizar", label: "Personaliza", id: "custom" },
  { href: "/pedido-mayor", label: "Por mayor", id: "wholesale" },
];

function isNavActive(href, pathname, searchParams) {
  const url = new URL(href, "https://example.com");
  const path = url.pathname;

  if (path === "/catalogo") {
    if (pathname !== "/catalogo") return false;

    const wantsCategory = url.searchParams.get("category");
    const wantsWeave = url.searchParams.get("weaveType");
    const wantsFeatured = url.searchParams.get("featured") === "true";
    const wantsNew = url.searchParams.get("isNew") === "true";

    if (wantsCategory) {
      return searchParams.get("category") === wantsCategory;
    }
    if (wantsWeave) {
      return searchParams.get("weaveType") === wantsWeave;
    }
    if (wantsFeatured) return searchParams.get("featured") === "true";
    if (wantsNew) return searchParams.get("isNew") === "true";

    return (
      !searchParams.get("category") &&
      !searchParams.get("weaveType") &&
      searchParams.get("featured") !== "true" &&
      searchParams.get("isNew") !== "true"
    );
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

function useHeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Sync input con URL (back/forward / navegación externa).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is source of truth
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
    trackSearch(search.trim());
    pushSearch(search);
  };

  return { search, setSearch, handleSubmit };
}

function SiteHeaderInner({ categories = [] }) {
  const { user, isAuthenticated } = useAuth();
  const { itemCount, hydrated } = useCart();
  const { favoriteCount, hydrated: favoritesHydrated } = useFavorites();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [masOpen, setMasOpen] = useState(false);
  const { search, setSearch, handleSubmit } = useHeaderSearch();
  const masPanelId = useId();
  const masWrapRef = useRef(null);

  const { visibleCategories, overflowCategories } = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    if (list.length <= MAX_VISIBLE_CATEGORIES) {
      return { visibleCategories: list, overflowCategories: [] };
    }
    return {
      visibleCategories: list.slice(0, MAX_VISIBLE_CATEGORIES),
      overflowCategories: list.slice(MAX_VISIBLE_CATEGORIES),
    };
  }, [categories]);

  useEffect(() => {
    /* Reset overlays al navegar (categoría, filtros, rutas). */
    /* eslint-disable react-hooks/set-state-in-effect -- reset UI on navigation */
    setMobileOpen(false);
    setMobileSearchOpen(false);
    setMasOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname, searchParams]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const open = mobileOpen || mobileSearchOpen;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, mobileSearchOpen]);

  useEffect(() => {
    if (!masOpen && !mobileOpen && !mobileSearchOpen) return undefined;

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (masOpen) setMasOpen(false);
      if (mobileOpen) setMobileOpen(false);
      if (mobileSearchOpen) setMobileSearchOpen(false);
    };
    const onPointer = (e) => {
      if (masOpen && !masWrapRef.current?.contains(e.target)) {
        setMasOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [masOpen, mobileOpen, mobileSearchOpen]);

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
  const favoritesActive = pathname.startsWith("/favoritos");
  const showFavoriteBadge = favoritesHydrated && favoriteCount > 0;
  const masActive = overflowCategories.some((cat) =>
    isNavActive(categoryHref(cat), pathname, searchParams)
  );

  const renderCategoryLink = (cat, { onClick, className = "" } = {}) => {
    const href = categoryHref(cat);
    const active = isNavActive(href, pathname, searchParams);
    return (
      <Link
        key={taxonomyId(cat)}
        href={href}
        className={[active ? "is-active" : "", className].filter(Boolean).join(" ") || undefined}
        aria-current={active ? "page" : undefined}
        onClick={onClick}
      >
        {cat.name}
      </Link>
    );
  };

  const searchForm = (
    <form className="site-header__search" onSubmit={onSubmit} role="search">
      <IconSearch className="site-header__search-icon" aria-hidden />
      <input
        type="search"
        placeholder="Buscar productos..."
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
        <IconSearch aria-hidden />
      </button>
    </form>
  );

  const actionIcons = (
    <div className="site-header__actions">
      <button
        type="button"
        className="site-header__icon-btn site-header__mobile-search-btn"
        aria-label="Buscar"
        title="Buscar"
        onClick={() => {
          setMobileSearchOpen((o) => !o);
          setMobileOpen(false);
        }}
      >
        <IconSearch aria-hidden />
      </button>

      <Link
        href={accountHref}
        className={`site-header__icon-btn site-header__account-btn${
          accountActive ? " is-active" : ""
        }`}
        aria-label="Mi cuenta"
        aria-current={accountActive ? "page" : undefined}
        title={isAuthenticated ? user?.name : "Iniciar sesión"}
      >
        <IconAccount aria-hidden />
      </Link>

      <Link
        href="/favoritos"
        className={`site-header__icon-btn site-header__favorites-btn${
          favoritesActive ? " is-active" : ""
        }`}
        aria-label={
          showFavoriteBadge
            ? `Favoritos, ${favoriteCount} guardados`
            : "Favoritos"
        }
        aria-current={favoritesActive ? "page" : undefined}
        title="Favoritos"
      >
        {showFavoriteBadge || favoritesActive ? (
          <IconFavoritesFilled aria-hidden />
        ) : (
          <IconFavorites aria-hidden />
        )}
        {showFavoriteBadge && (
          <span className="site-header__favorites-badge">{favoriteCount}</span>
        )}
      </Link>

      <Link
        href="/carrito"
        className={`site-header__icon-btn site-header__cart-btn${
          cartActive ? " is-active" : ""
        }`}
        aria-label={
          hydrated && itemCount > 0
            ? `Carrito, ${itemCount} productos`
            : "Carrito"
        }
        aria-current={cartActive ? "page" : undefined}
        title="Carrito"
      >
        <IconCart aria-hidden />
        {hydrated && itemCount > 0 && (
          <span className="site-header__cart-badge">{itemCount}</span>
        )}
      </Link>
    </div>
  );

  return (
    <header
      className={`site-header${scrolled ? " is-scrolled" : ""}${
        mobileOpen ? " is-menu-open" : ""
      }`}
    >
      <div className="site-header__top">
        <div className="site-header__inner site-header__inner--top">
          <button
            type="button"
            className="site-header__icon-btn site-header__menu-btn"
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-nav"
            onClick={() => {
              setMobileOpen((o) => !o);
              setMobileSearchOpen(false);
            }}
          >
            {mobileOpen ? <IconClose aria-hidden /> : <IconMenu aria-hidden />}
          </button>

          <SiteLogo active={homeActive} />

          <div className="site-header__search-wrap">{searchForm}</div>

          {actionIcons}
        </div>
      </div>

      <div className="site-header__bottom">
        <div className="site-header__inner site-header__inner--bottom">
          <nav className="site-header__nav" aria-label="Principal">
            {visibleCategories.map((cat) => renderCategoryLink(cat))}

            {overflowCategories.length > 0 && (
              <div className="site-header__tejidos" ref={masWrapRef}>
                <button
                  type="button"
                  className={`site-header__tejidos-trigger${
                    masOpen || masActive ? " is-active" : ""
                  }`}
                  aria-expanded={masOpen}
                  aria-controls={masPanelId}
                  aria-haspopup="true"
                  onClick={() => {
                    setMasOpen((o) => !o);
                  }}
                >
                  Más
                  <IconChevronDown
                    className={`site-header__chevron${masOpen ? " is-open" : ""}`}
                    aria-hidden
                  />
                </button>
                <div
                  id={masPanelId}
                  className={`site-header__tejidos-panel${
                    masOpen ? " is-open" : ""
                  }`}
                  aria-hidden={!masOpen}
                >
                  <p className="site-header__tejidos-label">Más categorías</p>
                  <ul className="site-header__tejidos-list">
                    {overflowCategories.map((cat) => (
                      <li key={taxonomyId(cat)}>
                        {renderCategoryLink(cat, {
                          onClick: () => setMasOpen(false),
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {STATIC_NAV.map((item) => {
              const active = isNavActive(item.href, pathname, searchParams);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={active ? "is-active" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
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
          <form onSubmit={onSubmit} role="search">
            <IconSearch
              className="site-header__search-overlay-icon"
              aria-hidden
            />
            <input
              type="search"
              placeholder="¿Qué buscas?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              autoComplete="off"
              aria-label="Buscar productos"
            />
            <button type="submit" aria-label="Buscar">
              <IconSearch aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Cerrar búsqueda"
              onClick={() => setMobileSearchOpen(false)}
            >
              <IconClose aria-hidden />
            </button>
          </form>
        </div>
      )}

      <nav
        id="site-mobile-nav"
        className={`site-header__mobile-nav${
          mobileOpen ? " site-header__mobile-nav--open" : ""
        }`}
        aria-label="Menú móvil"
        hidden={!mobileOpen}
      >
        {categories.length > 0 && (
          <div className="site-header__mobile-section">
            <p className="site-header__mobile-section-label">Catálogo</p>
            {categories.map((cat) =>
              renderCategoryLink(cat, { onClick: () => setMobileOpen(false) })
            )}
            <Link
              href="/catalogo"
              className={
                isNavActive("/catalogo", pathname, searchParams)
                  ? "is-active"
                  : undefined
              }
              aria-current={
                isNavActive("/catalogo", pathname, searchParams)
                  ? "page"
                  : undefined
              }
              onClick={() => setMobileOpen(false)}
            >
              Todo el catálogo
            </Link>
          </div>
        )}

        {STATIC_NAV.map((item) => {
          const active = isNavActive(item.href, pathname, searchParams);
          return (
            <Link
              key={item.id}
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

export default function SiteHeader({ categories = [] }) {
  return (
    <Suspense fallback={<header className="site-header" />}>
      <SiteHeaderInner categories={categories} />
    </Suspense>
  );
}

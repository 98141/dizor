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
import { trackSearch } from "@/lib/analytics/events";
import { categoryHref, taxonomyId } from "@/lib/catalogTaxonomy";
import SiteLogo from "./SiteLogo";
import {
  IconAccount,
  IconCart,
  IconChevronDown,
  IconClose,
  IconFavorites,
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

function weaveHref(wt) {
  const id = wt._id || wt.id;
  return `/catalogo?weaveType=${encodeURIComponent(String(id))}`;
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

function SiteHeaderInner({ categories = [], weaveTypes = [] }) {
  const { user, isAuthenticated } = useAuth();
  const { itemCount, hydrated } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tejidosOpen, setTejidosOpen] = useState(false);
  const [masOpen, setMasOpen] = useState(false);
  const [mobileTejidosOpen, setMobileTejidosOpen] = useState(false);
  const { search, setSearch, handleSubmit } = useHeaderSearch();
  const tejidosPanelId = useId();
  const masPanelId = useId();
  const tejidosWrapRef = useRef(null);
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
    setTejidosOpen(false);
    setMasOpen(false);
    setMobileTejidosOpen(false);
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
    if (!tejidosOpen && !masOpen) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setTejidosOpen(false);
        setMasOpen(false);
      }
    };
    const onPointer = (e) => {
      if (tejidosOpen && !tejidosWrapRef.current?.contains(e.target)) {
        setTejidosOpen(false);
      }
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
  }, [tejidosOpen, masOpen]);

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
  const tejidosActive =
    pathname === "/catalogo" && Boolean(searchParams.get("weaveType"));
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

      <button
        type="button"
        className="site-header__icon-btn site-header__favorites-btn"
        aria-label="Favoritos (próximamente)"
        title="Favoritos — próximamente"
        disabled
      >
        <IconFavorites aria-hidden />
      </button>

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
                    setTejidosOpen(false);
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
                  hidden={!masOpen}
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

            {weaveTypes.length > 0 && (
              <div className="site-header__tejidos" ref={tejidosWrapRef}>
                <button
                  type="button"
                  className={`site-header__tejidos-trigger${
                    tejidosOpen || tejidosActive ? " is-active" : ""
                  }`}
                  aria-expanded={tejidosOpen}
                  aria-controls={tejidosPanelId}
                  aria-haspopup="true"
                  onClick={() => {
                    setTejidosOpen((o) => !o);
                    setMasOpen(false);
                  }}
                >
                  Tejidos
                  <IconChevronDown
                    className={`site-header__chevron${
                      tejidosOpen ? " is-open" : ""
                    }`}
                    aria-hidden
                  />
                </button>
                <div
                  id={tejidosPanelId}
                  className={`site-header__tejidos-panel${
                    tejidosOpen ? " is-open" : ""
                  }`}
                  hidden={!tejidosOpen}
                >
                  <p className="site-header__tejidos-label">
                    Explorar por tejido
                  </p>
                  <ul className="site-header__tejidos-list">
                    {weaveTypes.map((wt) => {
                      const href = weaveHref(wt);
                      const active = isNavActive(
                        href,
                        pathname,
                        searchParams
                      );
                      return (
                        <li key={taxonomyId(wt)}>
                          <Link
                            href={href}
                            className={active ? "is-active" : undefined}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setTejidosOpen(false)}
                          >
                            <span>{wt.name}</span>
                            {wt.description ? (
                              <small>{wt.description}</small>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    href="/catalogo"
                    className="site-header__tejidos-all"
                    onClick={() => setTejidosOpen(false)}
                  >
                    Ver todo el catálogo
                  </Link>
                </div>
              </div>
            )}
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

        {weaveTypes.length > 0 && (
          <div className="site-header__mobile-accordion">
            <button
              type="button"
              className={`site-header__mobile-accordion-trigger${
                mobileTejidosOpen || tejidosActive ? " is-active" : ""
              }`}
              aria-expanded={mobileTejidosOpen}
              onClick={() => setMobileTejidosOpen((o) => !o)}
            >
              Tejidos
              <IconChevronDown
                className={`site-header__chevron${
                  mobileTejidosOpen ? " is-open" : ""
                }`}
                aria-hidden
              />
            </button>
            {mobileTejidosOpen && (
              <div className="site-header__mobile-accordion-panel">
                {weaveTypes.map((wt) => {
                  const href = weaveHref(wt);
                  const active = isNavActive(href, pathname, searchParams);
                  return (
                    <Link
                      key={taxonomyId(wt)}
                      href={href}
                      className={active ? "is-active" : undefined}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      {wt.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

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

export default function SiteHeader({ categories = [], weaveTypes = [] }) {
  return (
    <Suspense fallback={<header className="site-header" />}>
      <SiteHeaderInner categories={categories} weaveTypes={weaveTypes} />
    </Suspense>
  );
}

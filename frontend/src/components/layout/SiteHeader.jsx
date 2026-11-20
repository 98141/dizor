"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
/**
 * Máximo de categorías visibles en desktop antes de “Más”. Es un tope: si a
 * un ancho dado no caben, se miden y las sobrantes también pasan a “Más”.
 */
const MAX_VISIBLE_CATEGORIES = 5;

/**
 * Cuántas categorías caben en la fila sin desbordar, a partir de los anchos
 * naturales medidos (categorías, disparador “Más” y enlaces fijos). Los
 * enlaces fijos siempre permanecen visibles.
 */
function navRowWidth(
  k,
  { gap, categoryWidths, masWidth, staticWidths, hasMoreThanMeasured }
) {
  const needsMas = hasMoreThanMeasured || k < categoryWidths.length;
  const items = k + staticWidths.length + (needsMas ? 1 : 0);
  let width = staticWidths.reduce((a, b) => a + b, 0) + (needsMas ? masWidth : 0);
  for (let i = 0; i < k; i += 1) width += categoryWidths[i];
  return width + gap * Math.max(0, items - 1);
}

function fitCategoryCount({ available, ...row }) {
  for (let k = row.categoryWidths.length; k >= 0; k -= 1) {
    if (navRowWidth(k, row) <= available) return k;
  }
  return 0;
}

/** Desplazamiento (px) a partir del cual el header completo se considera
 *  fuera de vista y entra la barra compacta de escritorio. */
const COMPACT_TRIGGER_PX = 72;

const STATIC_NAV = [
  { href: "/catalogo?isNew=true", label: "Novedades", id: "new" },
  { href: "/catalogo?featured=true", label: "Destacados", id: "featured" },
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

/**
 * Desplegable “Más” (patrón disclosure: botón + lista de enlaces). Cada
 * instancia (header completo y barra compacta) tiene su propio estado.
 */
function MasMenu({
  overflowCategories,
  masActive,
  renderCategoryLink,
  resetKey,
  forceClosed = false,
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const labelId = useId();
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const isOpen = open && !forceClosed;

  useEffect(() => {
    // Cerrar al navegar o cuando la barra que lo contiene se oculta.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset UI
    setOpen(false);
  }, [resetKey, forceClosed]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Si el foco estaba dentro del desplegable, vuelve al disparador.
      if (wrapRef.current?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [isOpen]);

  return (
    <div
      className="site-header__tejidos"
      ref={wrapRef}
      onBlur={(e) => {
        // Tab fuera del desplegable (o foco a otra zona) → cerrar.
        if (open && !e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        className={`site-header__tejidos-trigger${
          isOpen || masActive ? " is-active" : ""
        }`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-focus-key="mas"
        onClick={() => setOpen((o) => !o)}
      >
        Más
        <IconChevronDown
          className={`site-header__chevron${isOpen ? " is-open" : ""}`}
          aria-hidden
        />
      </button>
      {/* tabIndex -1: un clic en zona no interactiva del panel no lo cierra */}
      <div
        id={panelId}
        className={`site-header__tejidos-panel${isOpen ? " is-open" : ""}`}
        tabIndex={-1}
      >
        <p className="site-header__tejidos-label" id={labelId}>
          Más categorías
        </p>
        <ul className="site-header__tejidos-list" aria-labelledby={labelId}>
          {overflowCategories.map((cat) => (
            <li key={taxonomyId(cat)}>
              {renderCategoryLink(cat, { onClick: () => setOpen(false) })}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
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
  const { search, setSearch, handleSubmit } = useHeaderSearch();
  const resetKey = `${pathname}?${searchParams.toString()}`;

  const headerRef = useRef(null);
  const navRef = useRef(null);
  const measureRef = useRef(null);
  const compactRef = useRef(null);
  const compactToggleRef = useRef(null);
  const compactInputRef = useRef(null);
  const compactSearchId = useId();

  // Valores iniciales idénticos en servidor y cliente (sin desajuste de
  // hidratación); tras montar se ajustan midiendo el espacio real.
  const [categoryLimit, setCategoryLimit] = useState(MAX_VISIBLE_CATEGORIES);
  const [compactRows, setCompactRows] = useState(2);
  const [isDesktop, setIsDesktop] = useState(false);
  const [compactWanted, setCompactWanted] = useState(false);
  const [compactSearchOpen, setCompactSearchOpen] = useState(false);
  const compactVisible = isDesktop && compactWanted;

  const { visibleCategories, overflowCategories } = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    const limit = Math.min(categoryLimit, MAX_VISIBLE_CATEGORIES);
    if (list.length <= limit) {
      return { visibleCategories: list, overflowCategories: [] };
    }
    return {
      visibleCategories: list.slice(0, limit),
      overflowCategories: list.slice(limit),
    };
  }, [categories, categoryLimit]);

  const measuredCategories = useMemo(
    () =>
      (Array.isArray(categories) ? categories : []).slice(
        0,
        MAX_VISIBLE_CATEGORIES
      ),
    [categories]
  );
  const hasMoreThanMeasured =
    Array.isArray(categories) && categories.length > MAX_VISIBLE_CATEGORIES;

  // Menú adaptable: mide la réplica invisible de la fila (anchos naturales) y
  // decide (1) cuántas categorías caben en el header completo — el resto va a
  // “Más” — y (2) si la barra compacta puede mostrar esas mismas categorías en
  // UNA fila junto al logo y los iconos; si no, usa su variante de dos filas.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return undefined;

    const compute = () => {
      const available = nav.clientWidth;
      if (!available) return; // nav oculto (<1024): no aplica
      const categoryWidths = [];
      const staticWidths = [];
      let masWidth = 0;
      for (const el of measure.children) {
        const width = el.getBoundingClientRect().width;
        if (el.dataset.kind === "cat") categoryWidths.push(width);
        else if (el.dataset.kind === "static") staticWidths.push(width);
        else if (el.dataset.kind === "mas") masWidth = width;
      }
      const row = { categoryWidths, masWidth, staticWidths, hasMoreThanMeasured };
      const fullGap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      const fullK = fitCategoryCount({ available, gap: fullGap, ...row });
      setCategoryLimit(fullK);

      const bar = compactRef.current;
      const barNav = bar?.querySelector(".site-header__nav");
      const barLogo = bar?.querySelector(".site-header__logo");
      const barActions = bar?.querySelector(".site-header__actions");
      const barCart = bar?.querySelector(".site-header__cart-btn");
      const barInner = bar?.firstElementChild;
      if (!barNav || !barLogo || !barActions || !barCart || !barInner) return;
      // Medidas independientes de la variante activa (sin oscilación):
      // logo + 4 iconos (lupa, cuenta, favoritos, carrito) + 2 huecos.
      const iconW = barCart.getBoundingClientRect().width;
      const actionsGap = parseFloat(getComputedStyle(barActions).columnGap) || 0;
      const colGap = parseFloat(getComputedStyle(barInner).columnGap) || 0;
      const oneRowAvailable =
        available -
        barLogo.getBoundingClientRect().width -
        (iconW * 4 + actionsGap * 3) -
        colGap * 2;
      const compactGap = parseFloat(getComputedStyle(barNav).columnGap) || 0;
      setCompactRows(
        navRowWidth(fullK, { gap: compactGap, ...row }) <= oneRowAvailable ? 1 : 2
      );
    };

    compute();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(compute);
    observer.observe(nav);
    observer.observe(measure);
    const barLogo = compactRef.current?.querySelector(".site-header__logo");
    if (barLogo) observer.observe(barLogo);
    return () => observer.disconnect();
  }, [measuredCategories, hasMoreThanMeasured]);

  // Oculta la barra compacta sin que ningún control desaparezca con el foco:
  // si el foco está dentro, pasa al control equivalente del header completo
  // (mismo data-focus-key) o, en su defecto, al logo.
  const hideCompact = useCallback(() => {
    const bar = compactRef.current;
    const header = headerRef.current;
    const active = document.activeElement;
    if (bar && header && active && bar.contains(active)) {
      const key = active.dataset?.focusKey;
      const candidates = [...header.querySelectorAll("[data-focus-key]")].filter(
        (el) => !bar.contains(el)
      );
      const tryFocus = (el) => {
        el.focus({ preventScroll: true });
        return document.activeElement === el;
      };
      const match = key
        ? candidates.filter((el) => el.dataset.focusKey === key).find(tryFocus)
        : null;
      if (match && match.tagName === "INPUT") {
        const end = match.value.length;
        match.setSelectionRange?.(end, end);
      }
      if (!match) {
        candidates.filter((el) => el.dataset.focusKey === "logo").find(tryFocus);
      }
    }
    setCompactSearchOpen(false);
    setCompactWanted(false);
  }, []);

  // Barra compacta (solo ≥1024): aparece cuando el borde inferior del header
  // completo cruza COMPACT_TRIGGER_PX. El header completo nunca cambia de
  // tamaño, así que mostrarla u ocultarla no altera el layout (sin CLS ni
  // oscilación cerca del umbral).
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;
    const mq = window.matchMedia("(min-width: 1024px)");
    let io = null;
    const setup = () => {
      io?.disconnect();
      io = null;
      setIsDesktop(mq.matches);
      if (!mq.matches || typeof IntersectionObserver === "undefined") {
        hideCompact();
        return;
      }
      io = new IntersectionObserver(
        ([entry]) => {
          const out = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          if (out) setCompactWanted(true);
          else hideCompact();
        },
        { rootMargin: `-${COMPACT_TRIGGER_PX}px 0px 0px 0px`, threshold: 0 }
      );
      io.observe(header);
    };
    setup();
    mq.addEventListener("change", setup);
    return () => {
      mq.removeEventListener("change", setup);
      io?.disconnect();
    };
  }, [hideCompact]);

  useEffect(() => {
    if (compactSearchOpen) compactInputRef.current?.focus();
  }, [compactSearchOpen]);

  const closeCompactSearch = () => {
    setCompactSearchOpen(false);
    compactToggleRef.current?.focus();
  };

  useEffect(() => {
    /* Reset overlays al navegar (categoría, filtros, rutas). */
    /* eslint-disable react-hooks/set-state-in-effect -- reset UI on navigation */
    setMobileOpen(false);
    setMobileSearchOpen(false);
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
    if (!mobileOpen && !mobileSearchOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (mobileOpen) setMobileOpen(false);
      if (mobileSearchOpen) setMobileSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
        data-focus-key={href}
        onClick={onClick}
      >
        {cat.name}
      </Link>
    );
  };

  const renderStaticLink = (item, { onClick } = {}) => {
    const active = isNavActive(item.href, pathname, searchParams);
    return (
      <Link
        key={item.id}
        href={item.href}
        className={active ? "is-active" : undefined}
        aria-current={active ? "page" : undefined}
        data-focus-key={item.href}
        onClick={onClick}
      >
        {item.label}
      </Link>
    );
  };

  const renderNav = ({ label, ref, measure = null, forceClosed = false }) => (
    <nav className="site-header__nav" aria-label={label} ref={ref}>
      {measure}
      {visibleCategories.map((cat) => renderCategoryLink(cat))}
      {overflowCategories.length > 0 && (
        <MasMenu
          overflowCategories={overflowCategories}
          masActive={masActive}
          renderCategoryLink={renderCategoryLink}
          resetKey={resetKey}
          forceClosed={forceClosed}
        />
      )}
      {STATIC_NAV.map((item) => renderStaticLink(item))}
    </nav>
  );

  const renderSearchForm = ({ inputRef, onKeyDown } = {}) => (
    <form
      className="site-header__search"
      onSubmit={onSubmit}
      role="search"
      onKeyDown={onKeyDown}
    >
      <IconSearch className="site-header__search-icon" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        placeholder="Buscar productos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Buscar productos"
        autoComplete="off"
        data-focus-key="search"
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

  const renderActionLinks = () => (
    <>
      <Link
        href={accountHref}
        className={`site-header__icon-btn site-header__account-btn${
          accountActive ? " is-active" : ""
        }`}
        aria-label="Mi cuenta"
        aria-current={accountActive ? "page" : undefined}
        title={isAuthenticated ? user?.name : "Iniciar sesión"}
        data-focus-key="account"
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
            ? `Favoritos, ${favoriteCount} guardado${favoriteCount === 1 ? "" : "s"}`
            : "Favoritos"
        }
        aria-current={favoritesActive ? "page" : undefined}
        title="Favoritos"
        data-focus-key="favorites"
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
            ? `Carrito, ${itemCount} producto${itemCount === 1 ? "" : "s"}`
            : "Carrito"
        }
        aria-current={cartActive ? "page" : undefined}
        title="Carrito"
        data-focus-key="cart"
      >
        <IconCart aria-hidden />
        {hydrated && itemCount > 0 && (
          <span className="site-header__cart-badge">{itemCount}</span>
        )}
      </Link>
    </>
  );

  return (
    <header
      ref={headerRef}
      className={`site-header${scrolled ? " is-scrolled" : ""}${
        mobileOpen ? " is-menu-open" : ""
      }`}
    >
      {/* Barra compacta de escritorio: independiente y fija; entra con una
          traslación cuando el header completo sale de la vista. Oculta =
          inerte (fuera del orden de tabulación y del árbol accesible). */}
      <div
        ref={compactRef}
        className={`site-header-compact${compactVisible ? " is-visible" : ""}${
          compactRows === 2 ? " site-header-compact--two-rows" : ""
        }${compactSearchOpen ? " is-searching" : ""}`}
        inert={!compactVisible}
        aria-hidden={compactVisible ? undefined : "true"}
      >
        <div className="site-header-compact__inner">
          <SiteLogo active={homeActive} data-focus-key="logo" />

          <div
            className="site-header-compact__search"
            id={compactSearchId}
            onBlur={(e) => {
              if (
                compactRows === 1 &&
                compactSearchOpen &&
                !e.currentTarget.contains(e.relatedTarget) &&
                e.relatedTarget !== compactToggleRef.current
              ) {
                setCompactSearchOpen(false);
              }
            }}
          >
            {renderSearchForm({
              inputRef: compactInputRef,
              onKeyDown: (e) => {
                if (e.key === "Escape" && compactRows === 1) {
                  e.preventDefault();
                  closeCompactSearch();
                }
              },
            })}
            <button
              type="button"
              className="site-header__icon-btn site-header-compact__search-close"
              aria-label="Cerrar búsqueda"
              onClick={closeCompactSearch}
            >
              <IconClose aria-hidden />
            </button>
          </div>

          {renderNav({
            label: "Principal (barra compacta)",
            forceClosed: !compactVisible,
          })}

          <div className="site-header__actions">
            <button
              type="button"
              ref={compactToggleRef}
              className="site-header__icon-btn site-header-compact__search-toggle"
              aria-label="Buscar"
              aria-expanded={compactSearchOpen}
              aria-controls={compactSearchId}
              onClick={() => setCompactSearchOpen((o) => !o)}
            >
              <IconSearch aria-hidden />
            </button>
            {renderActionLinks()}
          </div>
        </div>
      </div>

      <div className="site-header__top">
        <div className="site-header__inner site-header__inner--top">
          {/* Móvil/tablet: menú y búsqueda a la izquierda, logo centrado,
              acciones a la derecha. Oculto en escritorio. */}
          <div className="site-header__lead">
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
          </div>

          <SiteLogo active={homeActive} data-focus-key="logo" />

          <div className="site-header__search-wrap">{renderSearchForm()}</div>

          <div className="site-header__actions">{renderActionLinks()}</div>
        </div>
      </div>

      <div className="site-header__bottom">
        <div className="site-header__inner site-header__inner--bottom">
          {renderNav({
            label: "Principal",
            ref: navRef,
            measure: (
              /* Réplica invisible (no interactiva) de la fila con el máximo
                 de categorías: solo sirve para medir anchos naturales. */
              <div
                className="site-header__nav-measure"
                ref={measureRef}
                aria-hidden="true"
                inert
              >
                {measuredCategories.map((cat) => (
                  <span key={taxonomyId(cat)} data-kind="cat">
                    {cat.name}
                  </span>
                ))}
                <span className="site-header__tejidos-trigger" data-kind="mas">
                  Más
                  <IconChevronDown className="site-header__chevron" aria-hidden />
                </span>
                {STATIC_NAV.map((item) => (
                  <span key={item.id} data-kind="static">
                    {item.label}
                  </span>
                ))}
              </div>
            ),
          })}
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

        {STATIC_NAV.map((item) =>
          renderStaticLink(item, { onClick: () => setMobileOpen(false) })
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

export default function SiteHeader({ categories = [] }) {
  return (
    // En páginas estáticas el servidor solo emite este fallback (el header usa
    // useSearchParams); reserva la altura final para que el contenido no salte
    // al hidratar.
    <Suspense
      fallback={
        <header className="site-header site-header--pending" aria-hidden="true" />
      }
    >
      <SiteHeaderInner categories={categories} />
    </Suspense>
  );
}

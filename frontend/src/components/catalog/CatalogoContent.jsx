"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import CatalogFilters, {
  CatalogFiltersSidebar,
  REFINE_KEYS,
  getVisibleFilters,
} from "@/components/catalog/CatalogFilters";
import CatalogPromo from "@/components/cms/CatalogPromo";
import { getCatalogFilters, getProducts } from "@/services/productService";
import { trackCatalogFilter, trackViewItemList } from "@/lib/analytics/events";
import { mapProductToItem } from "@/lib/analytics/productMapper";
import { matchesTaxonomy, parseValueList } from "@/lib/catalogTaxonomy";
import { formatCOP } from "@/lib/formatCurrency";

const FILTER_PARAM_KEYS = [
  "term",
  "category",
  "weaveType",
  "style",
  "size",
  "color",
  "minPrice",
  "maxPrice",
  "inStock",
  "onPromotion",
  "featured",
  "isNew",
];

/**
 * Alcance de la página (navbar / búsqueda): se conserva al limpiar filtros y
 * no se muestra como chip ni cuenta como filtro.
 */
const SCOPE_KEYS = ["term", "category", "featured", "isNew"];

/** URL del catálogo con comas legibles en multiselección (`size=s,m`). */
function catalogUrl(params) {
  const qs = params.toString().replace(/%2C/gi, ",");
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

/** Nombre de una opción por slug o id. */
function lookupName(list, value) {
  if (!value || !Array.isArray(list)) return null;
  return list.find((item) => matchesTaxonomy(item, value))?.name || null;
}

/** Nombre desde facetas (contextuales) o, si no está, desde la taxonomía. */
function facetName(facets, filterOptions, key, value) {
  return (
    lookupName(facets?.[key], value) || lookupName(filterOptions?.[key], value)
  );
}

/** Grupos multiselección: parámetro, lista en facetas y formato del chip. */
const MULTI_GROUPS = [
  { param: "weaveType", facet: "weaveTypes", label: (n) => n || "Tejido" },
  { param: "style", facet: "styles", label: (n) => n || "Horma" },
  { param: "size", facet: "sizes", label: (n) => `Talla ${n || ""}`.trim() },
  { param: "color", facet: "colors", label: (n) => n || "Color" },
];

/**
 * Chips solo de refinamientos (la categoría ya es el título de la página):
 * uno por cada valor seleccionado, para quitarlos de a uno.
 */
function buildActiveChips(searchParams, filterOptions, facets) {
  const chips = [];
  for (const group of MULTI_GROUPS) {
    for (const value of parseValueList(searchParams.get(group.param))) {
      chips.push({
        key: `${group.param}:${value}`,
        param: group.param,
        value,
        label: group.label(facetName(facets, filterOptions, group.facet, value)),
      });
    }
  }
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  if (minPrice || maxPrice) {
    const parts = [];
    if (minPrice) parts.push(`desde ${formatCOP(Number(minPrice))}`);
    if (maxPrice) parts.push(`hasta ${formatCOP(Number(maxPrice))}`);
    chips.push({ key: "price", param: "price", label: `Precio ${parts.join(" ")}` });
  }
  if (searchParams.get("inStock") === "true") {
    chips.push({ key: "inStock", param: "inStock", label: "Disponibles" });
  }
  if (searchParams.get("onPromotion") === "true") {
    chips.push({ key: "onPromotion", param: "onPromotion", label: "En promoción" });
  }
  return chips;
}

/** Filtros activos: cada valor de un grupo multiselección cuenta como uno. */
function countActiveFilters(searchParams) {
  let n = 0;
  for (const key of REFINE_KEYS) {
    if (key === "minPrice" || key === "maxPrice") continue;
    n += parseValueList(searchParams.get(key)).length;
  }
  if (searchParams.get("minPrice") || searchParams.get("maxPrice")) n += 1;
  return n;
}

export default function CatalogoContent({
  initialProducts,
  initialTotal,
  initialPage,
  initialTotalPages,
  initialFilterOptions,
  initialFacets,
  initialBanner,
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const hasServerProducts = initialProducts != null;

  const [filterOptions, setFilterOptions] = useState(
    initialFilterOptions || null
  );
  const [facets, setFacets] = useState(initialFacets || null);
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!hasServerProducts);
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [page, setPage] = useState(initialPage ?? 1);
  const [totalPages, setTotalPages] = useState(initialTotalPages ?? 1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const [loadError, setLoadError] = useState("");

  const isInitialProductsLoad = useRef(hasServerProducts);
  const isInitialFiltersLoad = useRef(Boolean(initialFacets));
  const facetsRequestId = useRef(0);

  const buildParamsFromUrl = useCallback(() => {
    const params = {};
    [...FILTER_PARAM_KEYS, "sort"].forEach((key) => {
      const val = searchParams.get(key);
      if (val) params[key] = val;
    });
    return params;
  }, [searchParams]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = buildParamsFromUrl();
      const data = await getProducts({
        ...params,
        page: searchParams.get("page") || 1,
        limit: 12,
      });
      setProducts(data.products || []);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      setProducts([]);
      setTotal(0);
      setLoadError(
        err.response?.data?.message ||
          "No se pudo cargar el catálogo. Revisa que el backend esté activo."
      );
    } finally {
      setLoading(false);
    }
  }, [buildParamsFromUrl, searchParams]);

  // Facetas contextuales: se recalculan con cada cambio de alcance/filtros.
  useEffect(() => {
    if (isInitialFiltersLoad.current) {
      isInitialFiltersLoad.current = false;
      return;
    }
    const requestId = ++facetsRequestId.current;
    const { sort: _sort, ...params } = buildParamsFromUrl();
    getCatalogFilters(params)
      .then((data) => {
        if (requestId !== facetsRequestId.current) return; // respuesta vieja
        if (data.filters) setFilterOptions(data.filters);
        setFacets(data.facets || null);
      })
      .catch(() => {
        if (requestId === facetsRequestId.current) setFacets(null);
      });
  }, [buildParamsFromUrl]);

  useEffect(() => {
    const legacy =
      searchParams.get("q")?.trim() || searchParams.get("search")?.trim();
    if (!legacy || searchParams.get("term")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("search");
    params.set("term", legacy);
    params.delete("page");
    router.replace(catalogUrl(params));
  }, [searchParams, router]);

  useEffect(() => {
    // Draft del panel sigue la URL (fuente de estado de filtros).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL drives filter draft
    setDraftFilters(buildParamsFromUrl());
    if (isInitialProductsLoad.current) {
      isInitialProductsLoad.current = false;
      return;
    }
    loadProducts();
  }, [searchParams, loadProducts, buildParamsFromUrl]);

  const searchQuery = searchParams.get("term")?.trim();
  const categoryValue = searchParams.get("category");
  const categoryName = lookupName(filterOptions?.categories, categoryValue);

  const pageTitle = searchQuery
    ? `Resultados: "${searchQuery}"`
    : categoryName
      ? categoryName
      : searchParams.get("featured") === "true"
        ? "Destacados"
        : searchParams.get("isNew") === "true"
          ? "Novedades"
          : "Catálogo";

  const pageSubtitle = categoryName
    ? `${total} producto${total === 1 ? "" : "s"}`
    : searchQuery
      ? `${total} resultado${total === 1 ? "" : "s"}`
      : `Sombreros artesanales en palma de iraca · ${total} producto${total === 1 ? "" : "s"}`;

  const activeFilterCount = useMemo(
    () => countActiveFilters(searchParams),
    [searchParams]
  );

  const activeChips = useMemo(
    () => buildActiveChips(searchParams, filterOptions, facets),
    [searchParams, filterOptions, facets]
  );

  const showFilters = useMemo(() => {
    if (activeFilterCount > 0) return true;
    return getVisibleFilters(facets, draftFilters, filterOptions).any;
  }, [activeFilterCount, facets, draftFilters, filterOptions]);

  useEffect(() => {
    if (loading || !products.length) return;
    const items = products
      .map((p, i) =>
        mapProductToItem(p, {
          index: i,
          itemListId: "catalog",
          itemListName: pageTitle,
        })
      )
      .filter(Boolean);
    trackViewItemList({
      items,
      itemListId: "catalog",
      itemListName: pageTitle,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, loading]);

  const pushFiltersToUrl = (source) => {
    const current = buildParamsFromUrl();
    const changedKeys = new Set([
      ...Object.keys(current),
      ...Object.keys(source),
    ]);
    changedKeys.forEach((key) => {
      const prevValue = current[key] || "";
      const nextValue = source[key] || "";
      if (prevValue !== nextValue) {
        trackCatalogFilter({
          filterName: key,
          filterValue: nextValue || "(cleared)",
        });
      }
    });

    const params = new URLSearchParams();
    Object.entries(source).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    router.push(catalogUrl(params));
    setFiltersOpen(false);
  };

  /** Quita refinamientos; conserva alcance (categoría, búsqueda…) y orden. */
  const clearFilters = () => {
    const params = new URLSearchParams();
    [...SCOPE_KEYS, "sort"].forEach((key) => {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    });
    REFINE_KEYS.forEach((key) => {
      if (searchParams.get(key)) {
        trackCatalogFilter({ filterName: key, filterValue: "(cleared)" });
      }
    });
    setDraftFilters(Object.fromEntries(params.entries()));
    router.push(catalogUrl(params));
    setFiltersOpen(false);
  };

  const removeChip = (chip) => {
    const params = new URLSearchParams(searchParams.toString());
    if (chip.param === "price") {
      params.delete("minPrice");
      params.delete("maxPrice");
    } else if (chip.value) {
      // Multiselección: quitar solo ese valor del grupo.
      const rest = parseValueList(params.get(chip.param)).filter(
        (v) => v !== chip.value
      );
      if (rest.length) params.set(chip.param, rest.join(","));
      else params.delete(chip.param);
    } else {
      params.delete(chip.param);
    }
    params.delete("page");
    trackCatalogFilter({ filterName: chip.param, filterValue: "(cleared)" });
    router.push(catalogUrl(params));
  };

  const filterProps = {
    facets,
    allFilters: filterOptions,
    values: draftFilters,
    onChange: (next) => setDraftFilters(next),
    onApply: (nextFilters) => {
      pushFiltersToUrl(nextFilters || draftFilters);
    },
    onClear: clearFilters,
    activeFilterCount,
  };

  const changeSort = (sort) => {
    trackCatalogFilter({
      filterName: "sort",
      filterValue: sort || "(default)",
    });
    const params = new URLSearchParams(searchParams.toString());
    if (sort) params.set("sort", sort);
    else params.delete("sort");
    params.delete("page");
    router.push(catalogUrl(params));
  };

  const changePage = (newPage) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(catalogUrl(params));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="catalog-layout">
      <header className="catalog-layout__header">
        <h1 className="catalog-layout__title">{pageTitle}</h1>
        <p className="catalog-layout__subtitle">{pageSubtitle}</p>
      </header>

      <CatalogPromo banner={initialBanner} />

      <div className="catalog-layout__toolbar">
        {showFilters ? (
          <CatalogFilters
            {...filterProps}
            isOpen={filtersOpen}
            onToggle={() => setFiltersOpen((o) => !o)}
          />
        ) : null}

        <div className="catalog-sort">
          <select
            value={searchParams.get("sort") || ""}
            onChange={(e) => changeSort(e.target.value)}
            aria-label="Ordenar productos"
          >
            <option value="">Más recientes</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
            <option value="popular">Más vendidos</option>
            <option value="name_asc">Nombre A-Z</option>
          </select>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="catalog-chips" aria-label="Filtros activos">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="catalog-chips__chip"
              onClick={() => removeChip(chip)}
              aria-label={`Quitar filtro ${chip.label}`}
            >
              <span>{chip.label}</span>
              <span className="catalog-chips__remove" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            className="catalog-chips__clear"
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      <div
        className={`catalog-layout__grid-wrap${
          showFilters ? "" : " catalog-layout__grid-wrap--full"
        }`}
      >
        {showFilters ? (
          <div className="catalog-sidebar-desktop">
            <CatalogFiltersSidebar {...filterProps} />
          </div>
        ) : null}

        <div>
          {loadError ? (
            <p className="catalog-empty" style={{ color: "#b33" }}>
              {loadError}
            </p>
          ) : loading ? (
            <p className="auth-loading">Cargando catálogo...</p>
          ) : products.length === 0 ? (
            <div className="catalog-empty">
              <p>
                {searchQuery
                  ? `No hay resultados para "${searchQuery}".`
                  : "No encontramos productos con estos filtros."}
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="catalog-filters__btn catalog-filters__btn--primary"
                  onClick={clearFilters}
                  style={{ marginTop: "1rem" }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="products-grid">
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={i === 0}
                  itemListId="catalog"
                  itemListName={pageTitle}
                  index={i}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="catalog-pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => changePage(page + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

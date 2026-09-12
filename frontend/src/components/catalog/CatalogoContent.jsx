"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import CatalogFilters, {
  CatalogFiltersSidebar,
} from "@/components/catalog/CatalogFilters";
import CatalogPromo from "@/components/cms/CatalogPromo";
import { getCatalogFilters, getProducts } from "@/services/productService";
import { trackCatalogFilter, trackViewItemList } from "@/lib/analytics/events";
import { mapProductToItem } from "@/lib/analytics/productMapper";
import { taxonomyId } from "@/lib/catalogTaxonomy";

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

/** Dimensiones que cuentan para “Filtros (N)” — no incluye sort ni page. */
const ACTIVE_FILTER_KEYS = FILTER_PARAM_KEYS;

function lookupName(list, id) {
  if (!id || !Array.isArray(list)) return null;
  const found = list.find((item) => taxonomyId(item) === String(id));
  return found?.name || null;
}

function buildActiveChips(searchParams, filterOptions) {
  const chips = [];
  const cat = searchParams.get("category");
  if (cat) {
    chips.push({
      key: "category",
      label: lookupName(filterOptions?.categories, cat) || "Categoría",
    });
  }
  const weave = searchParams.get("weaveType");
  if (weave) {
    chips.push({
      key: "weaveType",
      label: lookupName(filterOptions?.weaveTypes, weave) || "Tejido",
    });
  }
  const style = searchParams.get("style");
  if (style) {
    chips.push({
      key: "style",
      label: lookupName(filterOptions?.styles, style) || "Horma",
    });
  }
  const size = searchParams.get("size");
  if (size) {
    chips.push({
      key: "size",
      label: lookupName(filterOptions?.sizes, size) || "Talla",
    });
  }
  const color = searchParams.get("color");
  if (color) {
    chips.push({
      key: "color",
      label: lookupName(filterOptions?.colors, color) || "Color",
    });
  }
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  if (minPrice || maxPrice) {
    const parts = [];
    if (minPrice) parts.push(`desde ${minPrice}`);
    if (maxPrice) parts.push(`hasta ${maxPrice}`);
    chips.push({ key: "price", label: `Precio ${parts.join(" ")}` });
  }
  if (searchParams.get("inStock") === "true") {
    chips.push({ key: "inStock", label: "Disponibles" });
  }
  if (searchParams.get("onPromotion") === "true") {
    chips.push({ key: "onPromotion", label: "En promoción" });
  }
  if (searchParams.get("featured") === "true") {
    chips.push({ key: "featured", label: "Destacados" });
  }
  if (searchParams.get("isNew") === "true") {
    chips.push({ key: "isNew", label: "Novedades" });
  }
  const term = searchParams.get("term")?.trim();
  if (term) {
    chips.push({ key: "term", label: `“${term}”` });
  }
  return chips;
}

function countActiveFilters(searchParams) {
  let n = 0;
  for (const key of ACTIVE_FILTER_KEYS) {
    if (key === "minPrice" || key === "maxPrice") continue;
    if (searchParams.get(key)) n += 1;
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
  initialBanner,
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const hasServerProducts = initialProducts != null;

  const [filterOptions, setFilterOptions] = useState(
    initialFilterOptions || null
  );
  const [products, setProducts] = useState(initialProducts || []);
  const [loading, setLoading] = useState(!hasServerProducts);
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [page, setPage] = useState(initialPage ?? 1);
  const [totalPages, setTotalPages] = useState(initialTotalPages ?? 1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const [loadError, setLoadError] = useState("");

  const isInitialProductsLoad = useRef(hasServerProducts);
  const isInitialFiltersLoad = useRef(Boolean(initialFilterOptions));

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

  useEffect(() => {
    if (isInitialFiltersLoad.current) {
      isInitialFiltersLoad.current = false;
      return;
    }
    getCatalogFilters().then((data) => setFilterOptions(data.filters));
  }, []);

  useEffect(() => {
    const legacy =
      searchParams.get("q")?.trim() || searchParams.get("search")?.trim();
    if (!legacy || searchParams.get("term")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("search");
    params.set("term", legacy);
    params.delete("page");
    router.replace(`/catalogo?${params.toString()}`);
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
  const categoryId = searchParams.get("category");
  const categoryName = lookupName(filterOptions?.categories, categoryId);

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
      : `Sombreros artesanales en palma de iraca · ${total} productos`;

  const activeFilterCount = useMemo(
    () => countActiveFilters(searchParams),
    [searchParams]
  );

  const activeChips = useMemo(
    () => buildActiveChips(searchParams, filterOptions),
    [searchParams, filterOptions]
  );

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
    router.push(`/catalogo?${params.toString()}`);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    const sort = searchParams.get("sort");
    setDraftFilters(sort ? { sort } : {});
    router.push(sort ? `/catalogo?sort=${encodeURIComponent(sort)}` : "/catalogo");
    setFiltersOpen(false);
  };

  const removeChip = (chipKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (chipKey === "price") {
      params.delete("minPrice");
      params.delete("maxPrice");
    } else {
      params.delete(chipKey);
    }
    params.delete("page");
    trackCatalogFilter({ filterName: chipKey, filterValue: "(cleared)" });
    router.push(`/catalogo?${params.toString()}`);
  };

  const filterProps = {
    filters: filterOptions,
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
    router.push(`/catalogo?${params.toString()}`);
  };

  const changePage = (newPage) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/catalogo?${params.toString()}`);
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
        <CatalogFilters
          {...filterProps}
          isOpen={filtersOpen}
          onToggle={() => setFiltersOpen((o) => !o)}
        />

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
              onClick={() => removeChip(chip.key)}
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
            Limpiar todo
          </button>
        </div>
      )}

      <div className="catalog-layout__grid-wrap">
        <div className="catalog-sidebar-desktop">
          <CatalogFiltersSidebar {...filterProps} />
        </div>

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

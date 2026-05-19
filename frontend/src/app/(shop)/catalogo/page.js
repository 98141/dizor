"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import CatalogFilters from "@/components/catalog/CatalogFilters";
import { CatalogFiltersSidebar } from "@/components/catalog/CatalogFilters";
import CatalogSearch from "@/components/catalog/CatalogSearch";
import CatalogPromo from "@/components/cms/CatalogPromo";
import { getCatalogFilters, getProducts } from "@/services/productService";

function CatalogoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filterOptions, setFilterOptions] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const [loadError, setLoadError] = useState("");

  const buildParamsFromUrl = useCallback(() => {
    const params = {};
    [
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
      "sort",
    ].forEach((key) => {
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
    setDraftFilters(buildParamsFromUrl());
    loadProducts();
  }, [searchParams, loadProducts, buildParamsFromUrl]);

  const pushFiltersToUrl = (source) => {
    const params = new URLSearchParams();
    Object.entries(source).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    router.push(`/catalogo?${params.toString()}`);
    setFiltersOpen(false);
  };

  const filterProps = {
    filters: filterOptions,
    values: draftFilters,
    onChange: (next) => setDraftFilters(next),
    onApply: (nextFilters) => {
      pushFiltersToUrl(nextFilters || draftFilters);
    },
    onClear: () => {
      setDraftFilters({});
      router.push("/catalogo");
      setFiltersOpen(false);
    },
  };

  const changeSort = (sort) => {
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

  const searchQuery = searchParams.get("term")?.trim();

  const updateSearchInUrl = useCallback(
    (value) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) params.set("term", trimmed);
      else params.delete("term");
      params.delete("page");
      router.push(`/catalogo?${params.toString()}`);
    },
    [router, searchParams]
  );


  const pageTitle = searchQuery
    ? `Resultados: “${searchQuery}”`
    : searchParams.get("featured")
      ? "Destacados"
      : searchParams.get("isNew")
        ? "Novedades"
        : "Catálogo";

  return (
    <div className="catalog-layout">
      <header className="catalog-layout__header">
        <h1 className="catalog-layout__title">{pageTitle}</h1>
        <p className="catalog-layout__subtitle">
          Sombreros artesanales en palma de iraca · {total} productos
        </p>
      </header>

      <CatalogPromo />

      <div className="catalog-layout__toolbar">
        <CatalogFilters
          {...filterProps}
          isOpen={filtersOpen}
          onToggle={() => setFiltersOpen((o) => !o)}
        />
        <CatalogSearch value={searchQuery || ""} onSearch={updateSearchInUrl} />
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
            <p className="catalog-empty">
              {searchQuery
                ? `No hay resultados para “${searchQuery}”.`
                : "No encontramos productos con estos filtros."}
            </p>
          ) : (
            <div className="products-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
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

export default function CatalogoPage() {
  return (
    <Suspense fallback={<p className="auth-loading">Cargando...</p>}>
      <CatalogoContent />
    </Suspense>
  );
}

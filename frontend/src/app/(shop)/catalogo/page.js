"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProductCard from "@/components/products/ProductCard";
import CatalogFilters from "@/components/catalog/CatalogFilters";
import { CatalogFiltersSidebar } from "@/components/catalog/CatalogFilters";
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

  const buildParamsFromUrl = useCallback(() => {
    const params = {};
    [
      "q",
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
    try {
      const params = buildParamsFromUrl();
      const data = await getProducts({
        ...params,
        page: searchParams.get("page") || 1,
        limit: 12,
      });
      setProducts(data.products);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [buildParamsFromUrl, searchParams]);

  useEffect(() => {
    getCatalogFilters().then((data) => setFilterOptions(data.filters));
  }, []);

  useEffect(() => {
    setDraftFilters(buildParamsFromUrl());
    loadProducts();
  }, [searchParams, loadProducts, buildParamsFromUrl]);

  const filterProps = {
    filters: filterOptions,
    values: draftFilters,
    onChange: (key, value) =>
      setDraftFilters((prev) => ({ ...prev, [key]: value })),
    onApply: () => {
      const params = new URLSearchParams();
      Object.entries(draftFilters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      router.push(`/catalogo?${params.toString()}`);
      setFiltersOpen(false);
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

  const pageTitle = searchParams.get("featured")
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
          {loading ? (
            <p className="auth-loading">Cargando catálogo...</p>
          ) : products.length === 0 ? (
            <p className="catalog-empty">
              No encontramos productos con estos filtros.
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

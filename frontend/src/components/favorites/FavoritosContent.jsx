"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import ProductCard from "@/components/products/ProductCard";
import { getFavorites } from "@/services/favoriteService";
import { getProducts } from "@/services/productService";

export default function FavoritosContent() {
  const { isAuthenticated, loadingAuth } = useAuth();
  const { favoriteIds, favoriteCount, hydrated } = useFavorites();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedOnce, setLoadedOnce] = useState(false);

  const idsKey = useMemo(
    () => [...favoriteIds].sort().join(","),
    [favoriteIds]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isAuthenticated) {
        const data = await getFavorites();
        setProducts(Array.isArray(data.products) ? data.products : []);
      } else {
        const ids = [...favoriteIds];
        if (ids.length === 0) {
          setProducts([]);
        } else {
          const data = await getProducts({
            ids: ids.join(","),
            limit: Math.min(48, ids.length),
          });
          const list = Array.isArray(data.products) ? data.products : [];
          const byId = new Map(list.map((p) => [String(p.id || p._id), p]));
          setProducts(ids.map((id) => byId.get(id)).filter(Boolean));
        }
      }
      setLoadedOnce(true);
    } catch {
      setError("No pudimos cargar tus favoritos. Intenta de nuevo.");
      setProducts([]);
      setLoadedOnce(true);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, favoriteIds]);

  useEffect(() => {
    if (loadingAuth || !hydrated) return undefined;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        if (isAuthenticated) {
          const data = await getFavorites();
          if (cancelled) return;
          setProducts(Array.isArray(data.products) ? data.products : []);
        } else {
          const ids = idsKey ? idsKey.split(",") : [];
          if (ids.length === 0) {
            if (!cancelled) setProducts([]);
          } else {
            const data = await getProducts({
              ids: ids.join(","),
              limit: Math.min(48, ids.length),
            });
            if (cancelled) return;
            const list = Array.isArray(data.products) ? data.products : [];
            const byId = new Map(list.map((p) => [String(p.id || p._id), p]));
            setProducts(ids.map((id) => byId.get(id)).filter(Boolean));
          }
        }
        if (!cancelled) setLoadedOnce(true);
      } catch {
        if (cancelled) return;
        setError("No pudimos cargar tus favoritos. Intenta de nuevo.");
        setProducts([]);
        setLoadedOnce(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadingAuth, hydrated, isAuthenticated, idsKey]);

  const visibleProducts = useMemo(
    () =>
      products.filter((p) => favoriteIds.has(String(p.id || p._id))),
    [products, favoriteIds]
  );

  if (loadingAuth || !hydrated) {
    return <p className="auth-loading">Cargando favoritos...</p>;
  }

  return (
    <div className="favorites-page">
      <header className="favorites-page__header">
        <h1 className="favorites-page__title">Favoritos</h1>
        {(loading && !loadedOnce) || favoriteCount > 0 ? (
          <p className="favorites-page__subtitle">
            {loading && !loadedOnce
              ? "Cargando…"
              : `${favoriteCount} pieza${favoriteCount === 1 ? "" : "s"} guardada${favoriteCount === 1 ? "" : "s"}`}
          </p>
        ) : null}
        {!isAuthenticated && favoriteCount > 0 ? (
          <p className="favorites-page__hint">
            Guardados en este dispositivo.{" "}
            <Link href="/login?next=/favoritos">Inicia sesión</Link> para
            conservarlos en tu cuenta.
          </p>
        ) : null}
      </header>

      {error ? (
        <div className="favorites-empty">
          <p className="favorites-empty__text">{error}</p>
          <button
            type="button"
            className="favorites-empty__cta"
            onClick={load}
          >
            Reintentar
          </button>
        </div>
      ) : loading && !loadedOnce ? (
        <p className="auth-loading">Cargando favoritos...</p>
      ) : visibleProducts.length === 0 ? (
        <div className="favorites-empty">
          <p className="favorites-empty__text">
            Aún no has guardado ninguna pieza.
          </p>
          <Link href="/catalogo" className="favorites-empty__cta">
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="products-grid">
          {visibleProducts.map((product, i) => (
            <ProductCard
              key={product.id || product._id}
              product={product}
              index={i}
              itemListId="favorites"
              itemListName="Favoritos"
            />
          ))}
        </div>
      )}
    </div>
  );
}

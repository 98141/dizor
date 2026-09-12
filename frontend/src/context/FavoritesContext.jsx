"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  addFavorite as addFavoriteApi,
  getFavoriteIds,
  removeFavorite as removeFavoriteApi,
  removeManyFavorites as removeManyFavoritesApi,
  syncFavorites as syncFavoritesApi,
} from "@/services/favoriteService";
import {
  trackAddToWishlist,
  trackRemoveFromWishlist,
} from "@/lib/analytics/events";

const STORAGE_KEY = "dizor_favorites_v1";
const FavoritesContext = createContext(null);
const EMPTY_SET = new Set();

function productKey(productOrId) {
  if (!productOrId) return "";
  if (typeof productOrId === "string" || typeof productOrId === "number") {
    return String(productOrId);
  }
  return String(productOrId.id || productOrId._id || "");
}

const loadStoredIds = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? [...new Set(parsed.map(String).filter(Boolean))]
      : [];
  } catch {
    return [];
  }
};

const saveStoredIds = (ids) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // private mode / quota — no bloquear UI
  }
};

const clearStoredIds = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export function FavoritesProvider({ children }) {
  const { isAuthenticated, loadingAuth, user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const userIdRef = useRef(null);
  const mergingRef = useRef(false);

  const setPending = useCallback((id, on) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Hidratar guest desde localStorage (una vez).
  useEffect(() => {
    if (loadingAuth) return;
    if (isAuthenticated) return;
    /* eslint-disable react-hooks/set-state-in-effect -- guest hydrate from localStorage */
    setFavoriteIds(new Set(loadStoredIds()));
    setHydrated(true);
    setLoading(false);
    userIdRef.current = null;
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadingAuth, isAuthenticated]);

  // Login: merge local → backend; Logout: volver a guest local (vacío si ya se fusionó).
  useEffect(() => {
    if (loadingAuth) return undefined;

    if (!isAuthenticated) {
      if (userIdRef.current !== null) {
        userIdRef.current = null;
        setFavoriteIds(new Set(loadStoredIds()));
        setPendingIds(new Set());
        setHydrated(true);
        setLoading(false);
      }
      return undefined;
    }

    const uid = String(user?.id || user?._id || "");
    if (!uid || userIdRef.current === uid || mergingRef.current) return undefined;

    mergingRef.current = true;
    userIdRef.current = uid;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setHydrated(false);
      try {
        const guestIds = loadStoredIds();
        let data;
        if (guestIds.length > 0) {
          data = await syncFavoritesApi(guestIds);
          clearStoredIds();
        } else {
          data = await getFavoriteIds();
        }
        if (cancelled) return;
        setFavoriteIds(new Set((data.favoriteIds || []).map(String)));
      } catch {
        if (cancelled) return;
        try {
          const data = await getFavoriteIds();
          if (!cancelled) {
            setFavoriteIds(new Set((data.favoriteIds || []).map(String)));
          }
        } catch {
          if (!cancelled) setFavoriteIds(new Set());
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setLoading(false);
        }
        mergingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadingAuth, isAuthenticated, user]);

  // Persistir solo modo invitado.
  useEffect(() => {
    if (!hydrated || isAuthenticated || loadingAuth) return;
    saveStoredIds(favoriteIds);
  }, [favoriteIds, hydrated, isAuthenticated, loadingAuth]);

  const isFavorite = useCallback(
    (productOrId) => {
      const id = productKey(productOrId);
      return id ? favoriteIds.has(id) : false;
    },
    [favoriteIds]
  );

  const isPending = useCallback(
    (productOrId) => {
      const id = productKey(productOrId);
      return id ? pendingIds.has(id) : false;
    },
    [pendingIds]
  );

  const addFavorite = useCallback(
    async (productOrId, meta = {}) => {
      const id = productKey(productOrId);
      if (!id || pendingIds.has(id)) return false;

      if (!isAuthenticated) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        trackAddToWishlist({
          items: meta.items,
          value: meta.value,
          currency: meta.currency,
        });
        return true;
      }

      setPending(id, true);
      let snapshot = null;
      setFavoriteIds((prev) => {
        snapshot = new Set(prev);
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      try {
        const data = await addFavoriteApi(id);
        setFavoriteIds(new Set((data.favoriteIds || [id]).map(String)));
        trackAddToWishlist({
          items: meta.items,
          value: meta.value,
          currency: meta.currency,
        });
        return true;
      } catch {
        if (snapshot) setFavoriteIds(snapshot);
        return false;
      } finally {
        setPending(id, false);
      }
    },
    [isAuthenticated, pendingIds, setPending]
  );

  const removeFavorite = useCallback(
    async (productOrId, meta = {}) => {
      const id = productKey(productOrId);
      if (!id || pendingIds.has(id)) return false;

      if (!isAuthenticated) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        trackRemoveFromWishlist({
          items: meta.items,
          value: meta.value,
          currency: meta.currency,
        });
        return true;
      }

      setPending(id, true);
      let snapshot = null;
      setFavoriteIds((prev) => {
        snapshot = new Set(prev);
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      try {
        const data = await removeFavoriteApi(id);
        setFavoriteIds(
          new Set(
            (
              data.favoriteIds ||
              [...(snapshot || EMPTY_SET)].filter((x) => x !== id)
            ).map(String)
          )
        );
        trackRemoveFromWishlist({
          items: meta.items,
          value: meta.value,
          currency: meta.currency,
        });
        return true;
      } catch {
        if (snapshot) setFavoriteIds(snapshot);
        return false;
      } finally {
        setPending(id, false);
      }
    },
    [isAuthenticated, pendingIds, setPending]
  );

  const toggleFavorite = useCallback(
    async (productOrId, meta = {}) => {
      const id = productKey(productOrId);
      if (!id) return false;
      if (favoriteIds.has(id)) return removeFavorite(id, meta);
      return addFavorite(id, meta);
    },
    [favoriteIds, addFavorite, removeFavorite]
  );

  /** Tras compra: quitar productos del carrito de la wishlist. */
  const removePurchasedFromFavorites = useCallback(
    async (productIds = []) => {
      const ids = [
        ...new Set(productIds.map(productKey).filter(Boolean)),
      ];
      if (ids.length === 0) return;

      const idSet = new Set(ids);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });

      if (!isAuthenticated) return;

      try {
        const data = await removeManyFavoritesApi([...idSet]);
        setFavoriteIds(new Set((data.favoriteIds || []).map(String)));
      } catch {
        // UI ya optimista; se corregirá en próximo refresh
      }
    },
    [isAuthenticated]
  );

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteIds(new Set(loadStoredIds()));
      setHydrated(true);
      return;
    }
    setLoading(true);
    try {
      const data = await getFavoriteIds();
      setFavoriteIds(new Set((data.favoriteIds || []).map(String)));
    } catch {
      setFavoriteIds(new Set());
    } finally {
      setHydrated(true);
      setLoading(false);
    }
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      favoriteIds,
      favoriteCount: favoriteIds.size,
      isFavorite,
      isPending,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      removePurchasedFromFavorites,
      loading,
      hydrated,
      refresh,
    }),
    [
      favoriteIds,
      isFavorite,
      isPending,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      removePurchasedFromFavorites,
      loading,
      hydrated,
      refresh,
    ]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites debe usarse dentro de FavoritesProvider");
  }
  return context;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { syncCart, validateCoupon } from "@/services/cartService";

const STORAGE_KEY   = "dizor_cart_v1";
const COUPON_KEY    = "dizor_coupon_v1";

// Código de cupón dejado por PromoPopup para aplicarlo apenas el carrito
// tenga ítems, validado siempre contra el backend igual que el campo manual.
export const PENDING_POPUP_COUPON_KEY = "dizor_pending_popup_coupon";

const CartContext = createContext(null);

const loadStored = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStored = (items) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Hydrate from localStorage
  useEffect(() => {
    setItems(loadStored());
    try {
      const raw = localStorage.getItem(COUPON_KEY);
      if (raw) setAppliedCoupon(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  // Persist cart
  useEffect(() => {
    if (!hydrated) return;
    saveStored(items);
  }, [items, hydrated]);

  // Persist coupon
  useEffect(() => {
    if (!hydrated) return;
    if (appliedCoupon) {
      localStorage.setItem(COUPON_KEY, JSON.stringify(appliedCoupon));
    } else {
      localStorage.removeItem(COUPON_KEY);
    }
  }, [appliedCoupon, hydrated]);

  // Aplicar automáticamente un cupón dejado pendiente por el popup, apenas
  // haya ítems en el carrito. Se valida contra el backend igual que si el
  // cliente lo hubiera escrito a mano; si es inválido/expirado se descarta
  // en silencio y no se vuelve a intentar.
  useEffect(() => {
    if (!hydrated || appliedCoupon || items.length === 0) return;
    if (typeof window === "undefined") return;

    const pendingCode = localStorage.getItem(PENDING_POPUP_COUPON_KEY);
    if (!pendingCode) return;

    localStorage.removeItem(PENDING_POPUP_COUPON_KEY);

    const subtotal = items.reduce(
      (s, i) => s + (i.unitPrice || 0) * i.quantity,
      0
    );

    validateCoupon(pendingCode, subtotal)
      .then((data) => setAppliedCoupon(data.coupon))
      .catch(() => {});
  }, [hydrated, items, appliedCoupon]);

  // Sync to server when authenticated
  useEffect(() => {
    if (!hydrated || !isAuthenticated || items.length === 0) return;

    const payload = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));

    syncCart(payload).catch(() => {});
  }, [isAuthenticated, hydrated]);

  const addItem = useCallback((item) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) =>
          i.productId === item.productId && i.variantId === item.variantId
      );

      if (idx >= 0) {
        const next = [...prev];
        const newQty = Math.min(
          next[idx].maxStock || 20,
          next[idx].quantity + item.quantity
        );
        next[idx] = { ...next[idx], quantity: newQty };
        return next;
      }

      return [...prev, item];
    });
  }, []);

  const updateQuantity = useCallback((productId, variantId, quantity) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId || i.variantId !== variantId) return i;
          return { ...i, quantity: Math.max(1, Math.min(i.maxStock || 20, quantity)) };
        })
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId, variantId) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.productId === productId && i.variantId === variantId)
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setAppliedCoupon(null);
  }, []);

  const applyCoupon = useCallback((coupon) => setAppliedCoupon(coupon), []);
  const clearCoupon = useCallback(() => setAppliedCoupon(null), []);

  const itemCount = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (i.unitPrice || 0) * i.quantity, 0),
    [items]
  );

  const toApiItems = useCallback(
    () =>
      items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        hydrated,
        itemCount,
        subtotal,
        appliedCoupon,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        applyCoupon,
        clearCoupon,
        toApiItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }
  return ctx;
};

"use client";

import { HiHeart, HiOutlineHeart } from "react-icons/hi2";
import { useFavorites } from "@/context/FavoritesContext";
import { mapProductToItem } from "@/lib/analytics/productMapper";

/**
 * Botón favorito reutilizable (ProductCard / PDP).
 * Funciona para invitado (localStorage) y usuario autenticado (API).
 */
export default function FavoriteButton({
  product,
  className = "",
  size = 20,
}) {
  const { isFavorite, isPending, toggleFavorite, hydrated } = useFavorites();
  const id = product?.id || product?._id;
  const name = product?.name || "producto";
  const active = hydrated && isFavorite(id);
  const pending = isPending(id);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending || !id) return;

    const item = mapProductToItem(product);
    await toggleFavorite(id, {
      items: item ? [item] : undefined,
      value: product?.effectivePrice,
      currency: "COP",
    });
  };

  return (
    <button
      type="button"
      className={`favorite-btn${active ? " is-active" : ""}${
        className ? ` ${className}` : ""
      }`}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={active}
      aria-label={
        active
          ? `Quitar ${name} de favoritos`
          : `Agregar ${name} a favoritos`
      }
      title={active ? "Quitar de favoritos" : "Agregar a favoritos"}
    >
      {active ? (
        <HiHeart size={size} aria-hidden />
      ) : (
        <HiOutlineHeart size={size} aria-hidden />
      )}
    </button>
  );
}

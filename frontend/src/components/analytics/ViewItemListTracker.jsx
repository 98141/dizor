"use client";

import { useEffect, useRef } from "react";
import { trackViewItemList } from "@/lib/analytics/events";
import { mapProductToItem } from "@/lib/analytics/productMapper";

// Componente "headless" (no renderiza nada) para reportar view_item_list en
// secciones que ya vienen resueltas por un Server Component (home,
// relacionados de producto) sin convertir esas secciones a cliente. Dispara
// una sola vez por montaje — estas listas no cambian sin una navegación
// completa (a diferencia del catálogo, que gestiona su propio evento
// directamente en CatalogoContent.jsx porque sí cambia con los filtros).
export default function ViewItemListTracker({ products, listId, listName }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!products?.length) return;
    firedRef.current = true;

    const items = products
      .map((p, i) => mapProductToItem(p, { index: i, itemListId: listId, itemListName: listName }))
      .filter(Boolean);

    trackViewItemList({ items, itemListId: listId, itemListName: listName });
  }, [products, listId, listName]);

  return null;
}

"use client";

import { useRef } from "react";
import ProductCard from "@/components/products/ProductCard";

export default function ProductCarousel({
  products = [],
  listId = "home_daily",
  listName = "Selección del día",
}) {
  const trackRef = useRef(null);

  const scrollBy = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.min(320, el.clientWidth * 0.8);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  if (!products.length) return null;

  return (
    <div className="home-carousel">
      <div className="home-carousel__controls">
        <button
          type="button"
          className="home-carousel__btn"
          aria-label="Anterior"
          onClick={() => scrollBy(-1)}
        >
          ←
        </button>
        <button
          type="button"
          className="home-carousel__btn"
          aria-label="Siguiente"
          onClick={() => scrollBy(1)}
        >
          →
        </button>
      </div>
      <div className="home-carousel__track" ref={trackRef}>
        {products.map((product, i) => (
          <div key={product.id} className="home-carousel__item">
            <ProductCard
              product={product}
              itemListId={listId}
              itemListName={listName}
              index={i}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

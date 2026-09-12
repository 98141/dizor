"use client";

import { useEffect, useRef, useState } from "react";
import ProductCard from "@/components/products/ProductCard";

export default function ProductCarousel({
  products = [],
  listId = "home_daily",
  listName = "Selección del día",
}) {
  const trackRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);
  const count = products.length;
  const countClass = `home-carousel--count-${Math.min(Math.max(count, 1), 5)}`;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;

    const checkOverflow = () => {
      setCanScroll(el.scrollWidth - el.clientWidth > 4);
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [products]);

  const scrollBy = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.min(360, el.clientWidth * 0.85);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  if (!products.length) return null;

  return (
    <div className={`home-carousel ${countClass}`} data-count={count}>
      {canScroll && (
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
      )}
      <div className="home-carousel__track" ref={trackRef} tabIndex={0}>
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

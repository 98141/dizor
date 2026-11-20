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

    const sync = () => {
      const img = el.querySelector(".product-card__image-wrap");
      const root = el.parentElement;
      if (img && root) {
        root.style.setProperty(
          "--carousel-arrow-top",
          `${img.getBoundingClientRect().height / 2}px`
        );
      }
      setCanScroll(el.scrollWidth - el.clientWidth > 4);
    };

    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(el);
    const img = el.querySelector(".product-card__image-wrap");
    if (img) observer.observe(img);
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
    <div
      className={`home-carousel ${countClass}${canScroll ? " home-carousel--scroll" : ""}`}
      data-count={count}
    >
      {canScroll && (
        <div className="home-carousel__controls">
          <button
            type="button"
            className="home-carousel__btn home-carousel__btn--prev"
            aria-label="Anterior"
            onClick={() => scrollBy(-1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M10.2 3.2 5.4 8l4.8 4.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          </button>
          <button
            type="button"
            className="home-carousel__btn home-carousel__btn--next"
            aria-label="Siguiente"
            onClick={() => scrollBy(1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M5.8 3.2 10.6 8l-4.8 4.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          </button>
        </div>
      )}
      <div className="home-carousel__track" ref={trackRef} tabIndex={0}>
        {products.map((product, i) => (
          <div key={product.id} className="home-carousel__item">
            <ProductCard
              product={product}
              presentation="editorial"
              itemListId={listId}
              itemListName={listName}
              index={i}
              sizes="(max-width: 767px) 78vw, (max-width: 1099px) 46vw, 24vw"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

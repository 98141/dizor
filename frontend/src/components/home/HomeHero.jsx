"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const SLIDE_MS = 7000;
const CROSSFADE_MS = 1400;

function padIndex(n) {
  return String(n).padStart(2, "0");
}

/**
 * Hero editorial de Home.
 * - 0 imágenes: gradiente de marca
 * - 1 imagen: fotografía estática + ken burns sutil
 * - 2+ imágenes: crossfade editorial (primera = LCP / priority)
 */
export default function HomeHero({
  hero = {},
  images = [],
  siteName = "DIZOR",
  fallbackImageUrl = "",
}) {
  const slides = (images || []).filter((img) => img?.url);
  const singleFallback =
    slides.length === 0 && fallbackImageUrl
      ? [{ id: "legacy-hero", url: fallbackImageUrl, altText: "" }]
      : [];
  const gallery = slides.length > 0 ? slides : singleFallback;
  const hasGallery = gallery.length > 0;
  const multi = gallery.length > 1;

  const [active, setActive] = useState(0);
  const [allowSecondary, setAllowSecondary] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progressId = useId();
  const timerRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Diferir descarga de slides secundarios tras el primer paint (protege LCP).
  useEffect(() => {
    if (!multi) return undefined;
    let cancelled = false;
    const unlock = () => {
      if (!cancelled) setAllowSecondary(true);
    };
    const ric = window.requestIdleCallback
      ? window.requestIdleCallback(unlock, { timeout: 1200 })
      : null;
    const t = window.setTimeout(unlock, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (ric && window.cancelIdleCallback) window.cancelIdleCallback(ric);
    };
  }, [multi]);

  const goTo = useCallback(
    (index) => {
      if (!multi) return;
      const len = gallery.length;
      setActive(((index % len) + len) % len);
      setAllowSecondary(true);
    },
    [gallery.length, multi]
  );

  const goNext = useCallback(() => goTo(active + 1), [active, goTo]);
  const goPrev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (!multi || reduceMotion || paused) return undefined;

    timerRef.current = window.setInterval(() => {
      setActive((i) => (i + 1) % gallery.length);
    }, SLIDE_MS);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [multi, reduceMotion, paused, gallery.length, active]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const brand = hero.brandClaim || siteName || "DIZOR";
  const title = hero.title || "Oficio colombiano, piezas que perduran";
  const subtitle =
    hero.subtitle ||
    "Sombreros de palma de iraca tejidos a mano en Sandoná, Nariño.";
  const ctaHref = hero.ctaHref || "/catalogo";
  const ctaLabel = hero.ctaLabel || "Ver catálogo";
  const showSecondary =
    Boolean(hero.secondaryCtaLabel) || Boolean(hero.secondaryCtaHref);

  const shouldRenderSlide = (index) => {
    if (index === 0) return true;
    if (!allowSecondary) return false;
    // Montar activa, vecinas y la primera (ya montada) para crossfade suave.
    const prev = (active - 1 + gallery.length) % gallery.length;
    const next = (active + 1) % gallery.length;
    return index === active || index === prev || index === next;
  };

  return (
    <section
      className={`home-hero${hasGallery ? " home-hero--has-image" : ""}${
        multi ? " home-hero--multi" : ""
      }${reduceMotion ? " home-hero--reduced" : ""}${
        paused ? " home-hero--paused" : ""
      }`}
      aria-roledescription={multi ? "carrusel" : undefined}
      aria-label="Presentación Dizor"
      onMouseEnter={() => multi && setPaused(true)}
      onMouseLeave={() => multi && setPaused(false)}
      onFocusCapture={() => multi && setPaused(true)}
      onBlurCapture={(e) => {
        if (!multi) return;
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {hasGallery && (
        <div className="home-hero__media" aria-hidden="true">
          {gallery.map((img, index) => {
            if (!shouldRenderSlide(index)) return null;
            const isActive = index === active;
            return (
              <div
                key={img.id || `hero-${index}`}
                className={`home-hero__slide${isActive ? " is-active" : ""}`}
                style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  className="home-hero__bg-image"
                  style={{ objectFit: "cover", objectPosition: "center 35%" }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="home-hero__overlay" aria-hidden="true" />
      <div className="home-hero__vignette" aria-hidden="true" />

      <div className="home-hero__inner">
        <p className="home-hero__brand home-anim home-anim--1">{brand}</p>
        <h1 className="home-hero__title home-anim home-anim--2">{title}</h1>
        <p className="home-hero__text home-anim home-anim--3">{subtitle}</p>
        <div className="home-hero__ctas home-anim home-anim--4">
          <Link href={ctaHref} className="home-btn home-btn--primary">
            {ctaLabel}
          </Link>
          {showSecondary && (
            <Link
              href={hero.secondaryCtaHref || "/pagina/sobre-dizor"}
              className="home-btn home-btn--ghost"
            >
              {hero.secondaryCtaLabel || "Conoce nuestra historia"}
            </Link>
          )}
        </div>
      </div>

      {multi && (
        <div className="home-hero__controls">
          <div className="home-hero__pager" aria-live="polite">
            <span className="home-hero__pager-current">
              {padIndex(active + 1)}
            </span>
            <span className="home-hero__pager-sep" aria-hidden="true">
              /
            </span>
            <span className="home-hero__pager-total">
              {padIndex(gallery.length)}
            </span>
          </div>

          <div
            className="home-hero__progress"
            role="group"
            aria-label="Fotografías del hero"
          >
            {gallery.map((img, index) => (
              <button
                key={img.id || `dot-${index}`}
                type="button"
                className={`home-hero__progress-seg${
                  index === active ? " is-active" : ""
                }`}
                aria-label={`Ir a fotografía ${index + 1} de ${gallery.length}`}
                aria-current={index === active ? "true" : undefined}
                onClick={() => goTo(index)}
              >
                <span
                  key={`${index}-${active === index ? active : "idle"}`}
                  className="home-hero__progress-fill"
                  style={
                    index === active && !reduceMotion && !paused
                      ? { animationDuration: `${SLIDE_MS}ms` }
                      : index === active
                        ? { width: "100%" }
                        : undefined
                  }
                />
              </button>
            ))}
          </div>

          <div className="home-hero__arrows">
            <button
              type="button"
              className="home-hero__arrow"
              aria-label="Fotografía anterior"
              onClick={goPrev}
            >
              ←
            </button>
            <button
              type="button"
              className="home-hero__arrow"
              aria-label="Fotografía siguiente"
              onClick={goNext}
            >
              →
            </button>
          </div>

          <span id={progressId} className="sr-only">
            {`Fotografía ${active + 1} de ${gallery.length}`}
          </span>
        </div>
      )}
    </section>
  );
}

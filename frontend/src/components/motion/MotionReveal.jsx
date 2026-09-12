"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveal mínimo por viewport (una sola observación, se desconecta).
 * No convierte secciones enteras en client — solo este wrapper.
 * variant: "editorial" | "photo"
 */
export default function MotionReveal({
  children,
  variant = "editorial",
  className = "",
  as: Tag = "div",
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show content immediately
      setVisible(true);
      return undefined;
    }

    let cancelled = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || cancelled) return;
        setVisible(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.12 }
    );

    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={[
        "motion-reveal",
        `motion-reveal--${variant}`,
        visible ? "is-visible" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

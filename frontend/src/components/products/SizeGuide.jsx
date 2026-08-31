"use client";

import { useState } from "react";

/**
 * Ilustración de cómo medir. Coloca el archivo en:
 * frontend/public/images/guia-tallas.jpg
 * (JPG, PNG o WebP). Si no está, se muestra el diagrama.
 */
export const SIZE_GUIDE_IMAGE = "/images/guia-tallas.png";

const SIZES = [
  { label: "XS - 4", range: "52 – 53 cm" },
  { label: "S - 5", range: "54 – 55 cm" },
  { label: "M - 6", range: "56 – 57 cm" },
  { label: "L - 7", range: "58 – 59 cm" },
  { label: "XL - 8", range: "60 cm o más" },
];

const STEPS = [
  {
    title: "Prepara la cinta",
    text: "Usa una cinta métrica flexible. Si no tienes, envuelve una tira de papel y mídela después con una regla.",
  },
  {
    title: "Rodea la cabeza",
    text: "Pásala por la parte más ancha: por encima de las orejas y 1 cm sobre las cejas.",
  },
  {
    title: "Lee la medida",
    text: "Mantén la cinta nivelada, ajustada pero sin apretar. El número en centímetros es tu talla.",
  },
];

const TIPS = [
  {
    title: "Entre dos tallas",
    text: "Elige la mayor. La palma de iraca tiene una ligera flexibilidad natural.",
  },
  {
    title: "Cuándo medir",
    text: "Hazlo al final del día, cuando la cabeza está en su tamaño máximo.",
  },
  {
    title: "A la medida",
    text: "En pedidos personalizados ajustamos la copa a tu medida, sin costo adicional.",
  },
];

function MeasureDiagram() {
  return (
    <svg
      className="hat-size-guide__diagram"
      viewBox="0 0 240 240"
      role="img"
      aria-label="Cómo colocar la cinta métrica alrededor de la cabeza"
    >
      <circle cx="120" cy="108" r="52" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <ellipse
        cx="120"
        cy="118"
        rx="70"
        ry="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeDasharray="7 5"
        transform="rotate(-8 120 118)"
      />
      <path
        d="M88 148 C88 178 152 178 152 148"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="186" cy="108" r="3.5" fill="currentColor" />
      <text x="120" y="216" textAnchor="middle" className="hat-size-guide__diagram-caption">
        1 cm sobre las cejas
      </text>
    </svg>
  );
}

export default function SizeGuide({ onClose, variant = "panel" }) {
  const [showPhoto, setShowPhoto] = useState(true);
  const Heading = variant === "page" ? "h1" : "h2";

  return (
    <section
      className={`hat-size-guide hat-size-guide--${variant}`}
      aria-label="Guía de tallas"
    >
      <header className="hat-size-guide__head">
        <div>
          <Heading className="hat-size-guide__title">Guía de tallas</Heading>
          <p className="hat-size-guide__lead">
            Tres pasos para medir tu cabeza y elegir la talla de tu sombrero
            artesanal.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="hat-size-guide__close"
            onClick={onClose}
          >
            Cerrar
          </button>
        ) : null}
      </header>

      <div className="hat-size-guide__measure">
        <div className="hat-size-guide__media">
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={SIZE_GUIDE_IMAGE}
              alt="Cómo medir la cabeza para elegir la talla del sombrero"
              className="hat-size-guide__photo"
              onError={() => setShowPhoto(false)}
            />
          ) : (
            <MeasureDiagram />
          )}
        </div>

        <ol className="hat-size-guide__steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="hat-size-guide__step">
              <span className="hat-size-guide__step-num" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="hat-size-guide__step-title">{step.title}</h3>
                <p className="hat-size-guide__step-text">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="hat-size-guide__chart">
        <h3 className="hat-size-guide__section-title">Tabla de tallas</h3>
        <div className="hat-size-guide__sizes">
          {SIZES.map((size) => (
            <div key={size.label} className="hat-size-guide__size">
              <span className="hat-size-guide__size-label">{size.label}</span>
              <span className="hat-size-guide__size-range">{size.range}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="hat-size-guide__tips">
        {TIPS.map((tip) => (
          <article key={tip.title} className="hat-size-guide__tip">
            <h3 className="hat-size-guide__tip-title">{tip.title}</h3>
            <p className="hat-size-guide__tip-text">{tip.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

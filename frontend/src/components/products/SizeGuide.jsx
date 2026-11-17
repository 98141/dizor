"use client";

import { useState } from "react";
import { getWhatsAppUrl } from "@/lib/whatsapp";

/**
 * Ilustración de cómo medir. Coloca el archivo en:
 * frontend/public/images/guia-tallas.jpg
 * (JPG, PNG o WebP). Si no está, se muestra el diagrama.
 */
export const SIZE_GUIDE_IMAGE = "/images/guia-tallas.png";

/**
 * Única fuente de tallas. `ref` es el número que ya acompaña a cada
 * talla en la guía (XS - 4, S - 5…). `max` null significa «o más».
 * Los huecos entre rangos no tienen talla propia: la nota de la guía
 * dice que, entre dos tallas, se elige la mayor.
 */
const SIZES = [
  { code: "XS", ref: "4", min: 52, max: 53, range: "52 – 53 cm" },
  { code: "S", ref: "5", min: 54, max: 55, range: "54 – 55 cm" },
  { code: "M", ref: "6", min: 56, max: 57, range: "56 – 57 cm" },
  { code: "L", ref: "7", min: 58, max: 59, range: "58 – 59 cm" },
  { code: "XL", ref: "8", min: 60, max: null, range: "60 cm o más" },
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

function formatCm(value) {
  return String(value).replace(".", ",");
}

function parseContour(raw) {
  const text = String(raw ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!text) return { ok: false, reason: "empty" };
  if (text.startsWith("-")) return { ok: false, reason: "negative" };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, reason: "invalid" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, reason: "invalid" };
  return { ok: true, value };
}

function recommendSize(value) {
  const exact = SIZES.find((size) =>
    size.max == null ? value >= size.min : value >= size.min && value <= size.max
  );
  if (exact) return { kind: "match", size: exact, value };

  if (value < SIZES[0].min) return { kind: "below", value };

  for (let i = 0; i < SIZES.length - 1; i += 1) {
    const current = SIZES[i];
    const next = SIZES[i + 1];
    if (current.max != null && value > current.max && value < next.min) {
      return { kind: "between", from: current, to: next, size: next, value };
    }
  }

  return { kind: "below", value };
}

function consultNote(result) {
  const cm = formatCm(result.value);
  if (result.kind === "between") {
    return `${cm} cm queda entre ${result.from.code} y ${result.to.code}. Entre dos tallas, esta guía indica elegir la mayor.`;
  }
  if (result.kind === "below") {
    return `${cm} cm está por debajo de XS, que empieza en 52 cm. Esta guía no asigna una talla a esa medida.`;
  }
  return `Corresponde a ${cm} cm.`;
}

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

function GuidePhoto({ className }) {
  const [showPhoto, setShowPhoto] = useState(true);

  if (!showPhoto) return <MeasureDiagram />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SIZE_GUIDE_IMAGE}
      alt="Cómo medir la cabeza para elegir la talla del sombrero: la cinta pasa 1 cm sobre las cejas y por encima de las orejas"
      className={className}
      onError={() => setShowPhoto(false)}
    />
  );
}

function SizeGuidePage() {
  const [contour, setContour] = useState("");
  const [feedback, setFeedback] = useState(null);

  const handleConsult = (event) => {
    event.preventDefault();
    const parsed = parseContour(contour);
    if (!parsed.ok) {
      const message =
        parsed.reason === "empty"
          ? "Escribe el contorno en centímetros para consultar la talla."
          : parsed.reason === "negative"
            ? "El contorno no puede ser negativo."
            : "Escribe el contorno en centímetros. Puedes usar coma o punto.";
      setFeedback({ tone: "error", message, code: null });
      return;
    }

    const result = recommendSize(parsed.value);
    setFeedback({
      tone: result.kind === "below" ? "neutral" : "ok",
      kind: result.kind,
      note: consultNote(result),
      code: result.size?.code || null,
      range: result.size?.range || null,
      below: result.kind === "below",
      value: result.value,
    });
  };

  return (
    <div className="size-guide">
      <header className="size-guide__intro">
        <h1 className="size-guide__title">Guía de tallas</h1>
        <p className="size-guide__lead">
          Tres pasos para medir tu cabeza y elegir la talla de tu sombrero
          artesanal.
        </p>
      </header>

      <div className="size-guide__layout">
        <figure className="size-guide__figure">
          <GuidePhoto className="size-guide__photo" />
        </figure>

        <div className="size-guide__main">
          <section aria-labelledby="size-guide-steps">
            <h2 id="size-guide-steps" className="size-guide__heading">
              Cómo medir
            </h2>
            <ol className="size-guide__steps">
              {STEPS.map((step) => (
                <li key={step.title}>
                  <h3 className="size-guide__step-title">{step.title}</h3>
                  <p className="size-guide__step-text">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="size-guide-consult">
            <h2 id="size-guide-consult" className="size-guide__heading">
              Consulta tu talla
            </h2>
            <form className="size-guide__form" onSubmit={handleConsult}>
              <label className="size-guide__label" htmlFor="size-guide-cm">
                Contorno de la cabeza (cm)
              </label>
              <div className="size-guide__controls">
                <input
                  id="size-guide-cm"
                  className="size-guide__input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={contour}
                  onChange={(event) => setContour(event.target.value)}
                  aria-describedby="size-guide-result"
                />
                <button type="submit" className="size-guide__submit">
                  Consultar talla
                </button>
              </div>
            </form>
            <div
              id="size-guide-result"
              className={`size-guide__result${feedback?.tone === "error" ? " size-guide__result--error" : ""}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {feedback?.tone === "error" ? (
                <p className="size-guide__result-text">{feedback.message}</p>
              ) : null}
              {feedback?.code ? (
                <div className="size-guide__answer">
                  <p className="size-guide__answer-label">Talla orientativa</p>
                  <p className="size-guide__answer-size">{feedback.code}</p>
                  <p className="size-guide__answer-range">{feedback.range}</p>
                  <p className="size-guide__answer-note">{feedback.note}</p>
                </div>
              ) : null}
              {feedback?.below ? (
                <p className="size-guide__result-text">
                  {feedback.note}{" "}
                  <a
                    className="size-guide__contact"
                    href={getWhatsAppUrl(
                      `Hola, medí ${formatCm(feedback.value)} cm de contorno y quiero confirmar la talla de un sombrero.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Consultar por WhatsApp
                  </a>
                </p>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="size-guide-table">
            <h2 id="size-guide-table" className="size-guide__heading">
              Tabla de tallas
            </h2>
            <div className="size-guide__table-wrap">
              <table className="size-guide__table">
                <caption className="sr-only">
                  Tallas de Dizor según el contorno de la cabeza en centímetros
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Talla</th>
                    <th scope="col">Referencia</th>
                    <th scope="col">Contorno</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZES.map((size) => {
                    const selected = feedback?.code === size.code;
                    return (
                      <tr key={size.code} className={selected ? "is-selected" : undefined}>
                        <th scope="row">{size.code}</th>
                        <td>{size.ref}</td>
                        <td>
                          {size.range}
                          {selected ? (
                            <span className="size-guide__picked">Tu talla</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <section className="size-guide__tips" aria-labelledby="size-guide-tips">
        <h2 id="size-guide-tips" className="size-guide__heading">
          También conviene saber
        </h2>
        <div className="size-guide__tips-list">
          {TIPS.map((tip) => (
            <div key={tip.title}>
              <h3 className="size-guide__tip-title">{tip.title}</h3>
              <p className="size-guide__tip-text">{tip.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function SizeGuide({ onClose, variant = "panel" }) {
  if (variant === "page") return <SizeGuidePage />;

  return (
    <section
      className="hat-size-guide hat-size-guide--panel"
      aria-label="Guía de tallas"
    >
      <header className="hat-size-guide__head">
        <div>
          <h2 className="hat-size-guide__title">Guía de tallas</h2>
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
          <GuidePhoto className="hat-size-guide__photo" />
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
            <div key={size.code} className="hat-size-guide__size">
              <span className="hat-size-guide__size-label">
                {size.code} - {size.ref}
              </span>
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

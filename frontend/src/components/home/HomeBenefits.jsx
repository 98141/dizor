import { HiOutlineHandRaised, HiOutlineTruck } from "react-icons/hi2";

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
};

function WeaveIcon() {
  return (
    <svg {...stroke}>
      <path d="M3 7C5.2 4.6 7.4 4.6 9.6 7S14 9.4 16.2 7 20.6 4.6 21 7" />
      <path d="M3 12C5.2 9.6 7.4 9.6 9.6 12S14 14.4 16.2 12 20.6 9.6 21 12" />
      <path d="M3 17C5.2 14.6 7.4 14.6 9.6 17S14 19.4 16.2 17 20.6 14.6 21 17" />
    </svg>
  );
}

function HatIcon() {
  return (
    <svg {...stroke}>
      <path d="M8 15.2V11c0-2.4 1.7-4.2 4-4.2s4 1.8 4 4.2v4.2" />
      <path d="M3.5 15.6h17" />
      <path d="M5 15.6c1.3 1.7 3.8 2.6 7 2.6s5.7-.9 7-2.6" />
    </svg>
  );
}

function glyphFor(title) {
  const value = (title || "").toLocaleLowerCase("es");
  if (value.includes("tejido")) return <WeaveIcon />;
  if (value.includes("horma")) return <HatIcon />;
  if (value.includes("mano")) return <HiOutlineHandRaised />;
  if (value.includes("envío") || value.includes("envio")) return <HiOutlineTruck />;
  return null;
}

/** Beneficios bajo el hero. El texto sigue saliendo del CMS. */
export default function HomeBenefits({ features = [] }) {
  const items = (features || []).slice(0, 4);
  if (!items.length) return null;

  const count = items.length;

  return (
    <section
      className={`home-benefits home-benefits--n${count}`}
      aria-label="Beneficios"
    >
      <div className="home-container">
        <div className="home-benefits__grid">
          {items.map((feature) => {
            const glyph = feature.icon ? null : glyphFor(feature.title);
            return (
              <div key={feature.title} className="home-benefit">
                {feature.icon || glyph ? (
                  <span className="home-benefit__icon" aria-hidden="true">
                    {feature.icon || glyph}
                  </span>
                ) : null}
                <h2 className="home-benefit__title">{feature.title}</h2>
                {feature.text ? (
                  <p className="home-benefit__text">{feature.text}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

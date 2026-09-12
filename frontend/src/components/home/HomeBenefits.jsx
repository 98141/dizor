/** Beneficios bajo el Hero — transición compacta hacia el cuerpo comercial. */
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
        <div className="home-benefits__grid" data-count={count}>
          {items.map((feature) => (
            <div key={feature.title} className="home-benefit">
              {feature.icon ? (
                <span className="home-benefit__icon" aria-hidden="true">
                  {feature.icon}
                </span>
              ) : null}
              <h3 className="home-benefit__title">{feature.title}</h3>
              <p className="home-benefit__text">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

function mergeFilterValues(prev, key, value) {
  const next = { ...prev };
  const normalized = value ? String(value) : "";
  if (normalized) next[key] = normalized;
  else delete next[key];
  return next;
}

function FilterPanel({
  filters,
  values,
  onChange,
  onApply,
  onClear,
  className = "",
  instantApply = false,
  fieldNamePrefix = "catalog",
}) {
  if (!filters) return null;

  const handleChange = (key, value) => {
    const next = mergeFilterValues(values, key, value);
    onChange(next);
    if (instantApply) onApply(next);
  };

  const renderGroup = (title, key, items) => (
    <div key={key}>
      <h3 className="catalog-filters__group-title">{title}</h3>
      <div className="catalog-filters__options">
        {items.map((item) => {
          const itemId = String(item._id);
          return (
            <label key={itemId} className="catalog-filters__option">
              <input
                type="radio"
                name={`${fieldNamePrefix}-${key}`}
                checked={String(values[key] || "") === itemId}
                onChange={() => handleChange(key, itemId)}
              />
              {item.name}
            </label>
          );
        })}
        {values[key] && (
          <button
            type="button"
            className="catalog-filters__btn"
            onClick={() => handleChange(key, "")}
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );

  return (
    <aside className={`catalog-filters ${className}`.trim()}>
      {renderGroup("Categoría", "category", filters.categories || [])}
      {renderGroup("Tejido", "weaveType", filters.weaveTypes || [])}
      {renderGroup("Horma / estilo", "style", filters.styles || [])}
      {renderGroup("Talla", "size", filters.sizes || [])}
      {renderGroup("Color", "color", filters.colors || [])}

      <div>
        <h3 className="catalog-filters__group-title">Precio (COP)</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <input
            type="number"
            placeholder="Precio mínimo"
            value={values.minPrice || ""}
            onChange={(e) => handleChange("minPrice", e.target.value)}
            className="auth-field__input"
          />
          <input
            type="number"
            placeholder="Precio máximo"
            value={values.maxPrice || ""}
            onChange={(e) => handleChange("maxPrice", e.target.value)}
            className="auth-field__input"
          />
        </div>
      </div>

      <label className="catalog-filters__option">
        <input
          type="checkbox"
          checked={values.inStock === "true"}
          onChange={(e) =>
            handleChange("inStock", e.target.checked ? "true" : "")
          }
        />
        Solo disponibles
      </label>

      <label className="catalog-filters__option">
        <input
          type="checkbox"
          checked={values.onPromotion === "true"}
          onChange={(e) =>
            handleChange("onPromotion", e.target.checked ? "true" : "")
          }
        />
        En promoción
      </label>

      <div className="catalog-filters__actions">
        {!instantApply && (
          <button
            type="button"
            className="catalog-filters__btn catalog-filters__btn--primary"
            onClick={() => onApply({ ...values })}
          >
            Aplicar
          </button>
        )}
        <button type="button" className="catalog-filters__btn" onClick={onClear}>
          Limpiar
        </button>
      </div>
    </aside>
  );
}

export default function CatalogFilters({
  filters,
  values,
  onChange,
  onApply,
  onClear,
  isOpen,
  onToggle,
}) {
  return (
    <>
      <button
        type="button"
        className="catalog-filters-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        ☰ Filtros
      </button>

      <FilterPanel
        filters={filters}
        values={values}
        onChange={onChange}
        onApply={onApply}
        onClear={onClear}
        className={isOpen ? "catalog-filters--open" : ""}
        fieldNamePrefix="catalog-mobile"
      />
    </>
  );
}

export function CatalogFiltersSidebar(props) {
  return (
    <FilterPanel
      {...props}
      instantApply
      fieldNamePrefix="catalog-desktop"
    />
  );
}

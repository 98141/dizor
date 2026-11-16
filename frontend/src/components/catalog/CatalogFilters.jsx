"use client";

import { formatCOP } from "@/lib/formatCurrency";
import {
  matchesTaxonomy,
  parseValueList,
  taxonomyValue,
} from "@/lib/catalogTaxonomy";

/**
 * Panel de filtros del catálogo — solo refinamientos.
 * La categoría (y destacados / novedades / búsqueda) es el *alcance* de la
 * página: se elige desde el navbar y no aparece aquí.
 * Las opciones salen de `facets` (contextuales, con conteo): solo se muestra
 * lo que existe en los productos que se están mirando.
 * Multiselección por grupo: los valores viajan como slugs separados por coma
 * (`?size=s,m`). Dentro de un grupo se suman (O); entre grupos se combinan (Y).
 */

/** Grupos de taxonomía (multiselección), en orden de lectura. */
const FACET_GROUPS = [
  { key: "weaveType", facet: "weaveTypes", title: "Tejido" },
  { key: "style", facet: "styles", title: "Horma / estilo" },
  { key: "size", facet: "sizes", title: "Talla" },
  { key: "color", facet: "colors", title: "Color", swatch: true },
];

/** Claves de refinamiento (las únicas que limpia "Limpiar" y que cuentan). */
export const REFINE_KEYS = [
  "weaveType",
  "style",
  "size",
  "color",
  "minPrice",
  "maxPrice",
  "inStock",
  "onPromotion",
];

function mergeFilterValues(prev, key, value) {
  const next = { ...prev };
  const normalized = value ? String(value) : "";
  if (normalized) next[key] = normalized;
  else delete next[key];
  return next;
}

/** Toggle útil: hay productos con y sin la condición (o ya está activo). */
const toggleVisible = (stat, active) =>
  active || (stat && stat.count > 0 && stat.count < stat.total);

/**
 * Qué mostrar según facetas y valores activos. Un grupo aparece si ofrece una
 * elección real (≥ 2 opciones, o 1 que no cubre todos los resultados) o si
 * tiene un valor seleccionado.
 */
export function getVisibleFilters(facets, values = {}, allFilters = null) {
  if (!facets) return { groups: [], inStock: false, onPromotion: false, price: false, any: false };

  const groups = FACET_GROUPS.map((group) => {
    let items = (facets[group.facet] || []).map((i) => ({
      ...i,
      value: taxonomyValue(i),
    }));
    // Seleccionados normalizados al valor de la opción (un id antiguo → slug).
    const selected = [];
    for (const raw of parseValueList(values[group.key])) {
      const item = items.find((i) => matchesTaxonomy(i, raw));
      if (item) {
        if (!selected.includes(item.value)) selected.push(item.value);
        continue;
      }
      // Seleccionado pero sin resultados con el resto de filtros: mantenerlo
      // visible (con 0) para poder quitarlo.
      const ref = (allFilters?.[group.facet] || []).find((i) =>
        matchesTaxonomy(i, raw)
      );
      const value = ref ? taxonomyValue(ref) : raw;
      if (selected.includes(value)) continue;
      items = [
        ...items,
        { _id: ref?._id || raw, value, name: ref?.name || "Seleccionado", count: 0 },
      ];
      selected.push(value);
    }
    const useful =
      items.length >= 2 || (items.length === 1 && items[0].count < facets.total);
    return { ...group, items, selected, visible: selected.length > 0 || useful };
  }).filter((g) => g.visible);

  const inStock = toggleVisible(facets.inStock, values.inStock === "true");
  const onPromotion = toggleVisible(facets.onPromotion, values.onPromotion === "true");
  const price =
    Boolean(values.minPrice || values.maxPrice) ||
    Boolean(facets.price && facets.price.min < facets.price.max);

  return {
    groups,
    inStock,
    onPromotion,
    price,
    any: groups.length > 0 || inStock || onPromotion || price,
  };
}

function FilterPanel({
  facets,
  allFilters,
  values,
  onChange,
  onApply,
  onClear,
  className = "",
  instantApply = false,
  fieldNamePrefix = "catalog",
}) {
  if (!facets) return null;

  const visible = getVisibleFilters(facets, values, allFilters);
  const hasRefinements = REFINE_KEYS.some((k) => values[k]);

  const handleChange = (key, value) => {
    const next = mergeFilterValues(values, key, value);
    onChange(next);
    if (instantApply) onApply(next);
  };

  /** Marca / desmarca una opción del grupo (multiselección). */
  const toggleOption = (group, value, checked) => {
    const next = checked
      ? [...group.selected, value]
      : group.selected.filter((v) => v !== value);
    handleChange(group.key, next.join(","));
  };

  /** Precio: se edita como borrador y se aplica con botón / Enter. */
  const handlePriceDraft = (key, value) => {
    onChange(mergeFilterValues(values, key, value.replace(/[^\d]/g, "")));
  };
  const applyPrice = (e) => {
    e.preventDefault();
    onApply({ ...values });
  };

  return (
    <aside
      className={`catalog-filters ${className}`.trim()}
      aria-label="Filtros del catálogo"
    >
      {visible.groups.map((group) => (
        <div
          key={group.key}
          className="catalog-filters__group"
          role="group"
          aria-labelledby={`${fieldNamePrefix}-${group.key}-title`}
        >
          <div className="catalog-filters__group-head">
            <h3
              id={`${fieldNamePrefix}-${group.key}-title`}
              className="catalog-filters__group-title"
            >
              {group.title}
            </h3>
            {group.selected.length ? (
              <button
                type="button"
                className="catalog-filters__reset"
                onClick={() => handleChange(group.key, "")}
                aria-label={`Quitar filtro de ${group.title.toLowerCase()}`}
              >
                Quitar
              </button>
            ) : null}
          </div>
          <div className="catalog-filters__options">
            {group.items.map((item) => (
              <label
                key={item.value}
                className={`catalog-filters__option${
                  item.count === 0 ? " catalog-filters__option--empty" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="catalog-filters__control catalog-filters__control--check"
                  name={`${fieldNamePrefix}-${group.key}`}
                  value={item.value}
                  checked={group.selected.includes(item.value)}
                  onChange={(e) => toggleOption(group, item.value, e.target.checked)}
                />
                {group.swatch && item.hexCode ? (
                  <span
                    className="catalog-filters__swatch"
                    style={{ background: item.hexCode }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="catalog-filters__label">{item.name}</span>
                <span className="catalog-filters__count" aria-label={`${item.count} productos`}>
                  {item.count}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {visible.price ? (
        <form className="catalog-filters__group" onSubmit={applyPrice}>
          <div className="catalog-filters__group-head">
            <h3 className="catalog-filters__group-title">Precio</h3>
            {values.minPrice || values.maxPrice ? (
              <button
                type="button"
                className="catalog-filters__reset"
                onClick={() => {
                  const next = mergeFilterValues(
                    mergeFilterValues(values, "minPrice", ""),
                    "maxPrice",
                    ""
                  );
                  onChange(next);
                  if (instantApply) onApply(next);
                }}
                aria-label="Quitar filtro de precio"
              >
                Quitar
              </button>
            ) : null}
          </div>
          <div className="catalog-filters__price">
            <label className="catalog-filters__price-field">
              <span className="sr-only">Precio mínimo</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Mín."
                value={values.minPrice || ""}
                onChange={(e) => handlePriceDraft("minPrice", e.target.value)}
                className="catalog-filters__input"
              />
            </label>
            <span className="catalog-filters__price-sep" aria-hidden="true">
              –
            </span>
            <label className="catalog-filters__price-field">
              <span className="sr-only">Precio máximo</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Máx."
                value={values.maxPrice || ""}
                onChange={(e) => handlePriceDraft("maxPrice", e.target.value)}
                className="catalog-filters__input"
              />
            </label>
          </div>
          {facets.price ? (
            <p className="catalog-filters__hint">
              {formatCOP(facets.price.min)} – {formatCOP(facets.price.max)}
            </p>
          ) : null}
          {instantApply ? (
            <button type="submit" className="catalog-filters__btn catalog-filters__btn--small">
              Aplicar precio
            </button>
          ) : null}
        </form>
      ) : null}

      {visible.inStock || visible.onPromotion ? (
        <div className="catalog-filters__group catalog-filters__toggles">
          {visible.inStock ? (
            <label className="catalog-filters__option">
              <input
                type="checkbox"
                className="catalog-filters__control catalog-filters__control--check"
                checked={values.inStock === "true"}
                onChange={(e) =>
                  handleChange("inStock", e.target.checked ? "true" : "")
                }
              />
              <span className="catalog-filters__label">Solo disponibles</span>
              <span className="catalog-filters__count">{facets.inStock.count}</span>
            </label>
          ) : null}
          {visible.onPromotion ? (
            <label className="catalog-filters__option">
              <input
                type="checkbox"
                className="catalog-filters__control catalog-filters__control--check"
                checked={values.onPromotion === "true"}
                onChange={(e) =>
                  handleChange("onPromotion", e.target.checked ? "true" : "")
                }
              />
              <span className="catalog-filters__label">En promoción</span>
              <span className="catalog-filters__count">
                {facets.onPromotion.count}
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {!visible.any ? (
        <p className="catalog-filters__empty">
          No hay filtros adicionales para esta selección.
        </p>
      ) : null}

      {(!instantApply && visible.any) || hasRefinements ? (
        <div className="catalog-filters__actions">
          {!instantApply && visible.any ? (
            <button
              type="button"
              className="catalog-filters__btn catalog-filters__btn--primary"
              onClick={() => onApply({ ...values })}
            >
              Aplicar
            </button>
          ) : null}
          {hasRefinements ? (
            <button type="button" className="catalog-filters__btn" onClick={onClear}>
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

export default function CatalogFilters({
  isOpen,
  onToggle,
  activeFilterCount = 0,
  ...panelProps
}) {
  const label =
    activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : "Filtros";

  return (
    <>
      <button
        type="button"
        className="catalog-filters-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        {label}
      </button>

      <FilterPanel
        {...panelProps}
        className={isOpen ? "catalog-filters--open" : ""}
        fieldNamePrefix="catalog-mobile"
      />
    </>
  );
}

export function CatalogFiltersSidebar({
  isOpen: _isOpen,
  onToggle: _onToggle,
  activeFilterCount: _count,
  ...panelProps
}) {
  return (
    <FilterPanel {...panelProps} instantApply fieldNamePrefix="catalog-desktop" />
  );
}

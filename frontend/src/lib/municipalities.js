export function normalizeMunicipality(value) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "";
}

const placeKey = (value) => ["bogota", "bogota d c", "bogota dc"].includes(normalizeMunicipality(value)) ? "bogota dc" : normalizeMunicipality(value);
export const municipalityLabel = (entry) => `${entry.city} — ${entry.department}`;

// No se adivina el departamento a partir del nombre de una dirección antigua.
export function findMunicipality(options, city, department) {
  if (!city || !department) return null;
  const matches = options.filter((entry) => placeKey(entry.city) === placeKey(city) && placeKey(entry.department) === placeKey(department));
  return matches.length === 1 ? matches[0] : null;
}

export function searchMunicipalities(options, query) {
  const normalized = normalizeMunicipality(query);
  return options.map((entry) => {
    const city = normalizeMunicipality(entry.city);
    const label = normalizeMunicipality(municipalityLabel(entry));
    const rank = !normalized || city === normalized || label === normalized ? 0 : city.startsWith(normalized) ? 1 : label.includes(normalized) ? 2 : -1;
    return { entry, rank };
  }).filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || municipalityLabel(a.entry).localeCompare(municipalityLabel(b.entry), "es-CO"))
    .map(({ entry }) => entry);
}

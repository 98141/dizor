const source = require("../data/divipola-source.json");
const metadata = require("../data/colombia-municipalities-metadata.json");

const normalize = (value) => typeof value === "string"
  ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  : "";
// Bogotá es una entidad de primer nivel propia; nunca se asocia a Cundinamarca.
const placeKey = (value) => ["bogota", "bogota d c", "bogota dc"].includes(normalize(value)) ? "bogota dc" : normalize(value);
const displayName = (name) => name.toLocaleLowerCase("es-CO").split(" ")
  .map((word, index) => index && ["de", "del", "la", "las", "los", "y"].includes(word) ? word : word.charAt(0).toLocaleUpperCase("es-CO") + word.slice(1)).join(" ");

const municipalities = source.map((row) => Object.freeze({
  id: row.cod_mpio,
  city: row.cod_mpio === "11001" ? "Bogotá, D.C." : displayName(row.nom_mpio),
  department: row.cod_dpto === "11" ? "Bogotá, D.C." : displayName(row.dpto),
  departmentId: row.cod_dpto,
  type: row.tipo_municipio,
}));
const byPair = new Map(municipalities.map((entry) => [`${placeKey(entry.city)}|${placeKey(entry.department)}`, entry]));
if (byPair.size !== municipalities.length || new Set(municipalities.map((entry) => entry.id)).size !== metadata.destinations) {
  throw new Error("Catálogo DIVIPOLA incompleto o con identidades duplicadas");
}

exports.municipalities = Object.freeze(municipalities);
exports.metadata = metadata;
exports.departments = [...new Set(municipalities.map((entry) => entry.department))];
exports.findMunicipality = (city, department) => byPair.get(`${placeKey(city)}|${placeKey(department)}`) || null;

const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { municipalities } = require("../../backend/src/services/municipalityCatalog");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/municipalities.js"), "utf8");
const helpers = import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("busca sin tildes/caja, muestra departamento y prioriza exactos antes de prefijos y contenidos", async () => {
  const { searchMunicipalities, municipalityLabel } = await helpers;
  for (const query of ["sandona", "SANDONÁ", "SaNdOnA"]) {
    assert.equal(municipalityLabel(searchMunicipalities(municipalities, query)[0]), "Sandoná — Nariño");
  }
  const ranked = searchMunicipalities(municipalities, "san pedro");
  assert(ranked.length > 2);
  assert(ranked.slice(0, 2).every((entry) => entry.city === "San Pedro"));
  assert(ranked.slice(2).some((entry) => entry.city.startsWith("San Pedro ")));
  assert.equal(searchMunicipalities(municipalities, "la union").filter((entry) => entry.city === "La Unión").length, 4);
  assert.equal(searchMunicipalities(municipalities, "zzznuncaexiste").length, 0);
  // Cada destino es alcanzable por su etiqueta completa, incluidos isla y ANM.
  for (const entry of municipalities) assert.equal(searchMunicipalities(municipalities, municipalityLabel(entry))[0]?.id, entry.id);
});

test("precarga solo parejas inequívocas y Bogotá no se mueve a Cundinamarca", async () => {
  const { findMunicipality } = await helpers;
  assert.equal(findMunicipality(municipalities, "sandona", "narino").id, "52683");
  assert.equal(findMunicipality(municipalities, "La Unión", ""), null);
  assert.equal(findMunicipality(municipalities, "Pasto", "Antioquia"), null);
  assert.equal(findMunicipality(municipalities, "Bogota", "Bogota DC").id, "11001");
  assert.equal(findMunicipality(municipalities, "Bogotá", "Cundinamarca"), null);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const source = require("../src/data/divipola-source.json");
const catalog = require("../src/services/municipalityCatalog");

test("copia íntegra del DANE: 1122 códigos estables, 33 entidades de primer nivel y todos los tipos", () => {
  const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "../src/data/divipola-source.json"))).digest("hex");
  assert.equal(hash, catalog.metadata.sourceSha256);
  assert.equal(source.length, 1122);
  assert.equal(catalog.municipalities.length, source.length);
  assert.equal(new Set(source.map((row) => row.cod_mpio)).size, 1122);
  assert.equal(new Set(catalog.municipalities.map((entry) => entry.departmentId)).size, 33);
  assert.equal(catalog.departments.length, 33);
  assert.deepEqual(Object.fromEntries(["Municipio", "Isla", "Área no municipalizada"].map((type) => [type, catalog.municipalities.filter((entry) => entry.type === type).length])), catalog.metadata.types);
  for (const row of source) {
    const entry = catalog.findMunicipality(row.nom_mpio, row.dpto);
    assert(entry, `${row.cod_mpio}: no se puede resolver`);
    assert.equal(entry.id, row.cod_mpio);
    assert.match(entry.id, /^\d{5}$/);
    assert.equal(entry.id.slice(0, 2), entry.departmentId);
  }
});

test("Bogotá conserva código 11001 y departamento propio; los homónimos requieren su departamento", () => {
  for (const spelling of ["Bogotá", "BOGOTA DC", "Bogotá, D.C."]) {
    const entry = catalog.findMunicipality(spelling, "Bogotá D.C.");
    assert.equal(entry.id, "11001");
    assert.equal(entry.department, "Bogotá, D.C.");
    assert.equal(catalog.findMunicipality(spelling, "Cundinamarca"), null);
  }
  const homonyms = catalog.municipalities.filter((entry) => entry.city === "La Unión");
  assert.equal(homonyms.length, 4);
  assert.equal(catalog.findMunicipality("La Unión", ""), null);
  assert.equal(catalog.findMunicipality("SANDONA", "narino").id, "52683");
});

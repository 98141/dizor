/**
 * Limpieza de taxonomía del catálogo (fase 2 filtros).
 *
 *   node src/scripts/cleanupCatalogTaxonomy.js           → simulación (no escribe)
 *   node src/scripts/cleanupCatalogTaxonomy.js --apply   → aplica + respaldo JSON en logs/
 *
 * Reglas:
 * 1. Tejidos / hormas cuyo nombre es en realidad una categoría ("Bolsos",
 *    "Accesorio", "Accesorios") son clasificaciones falsas: se quitan de los
 *    productos (quedan "No aplica") y se desactivan.
 * 2. Slugs que no corresponden al nombre (p. ej. "Fino" con slug "comun",
 *    restos de renombres) se regeneran: el slug es la URL pública del filtro.
 * 3. Correcciones puntuales de nombre (tildes).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const slugifyText = require("../utils/slugifyText");
const Product = require("../models/product");
const Category = require("../models/category");
const WeaveType = require("../models/weaveType");
const Style = require("../models/style");
const Size = require("../models/size");
const Color = require("../models/color");

const APPLY = process.argv.includes("--apply");

const TAXONOMIES = [
  { label: "categoría", Model: Category },
  { label: "tejido", Model: WeaveType, productField: "weaveType" },
  { label: "horma", Model: Style, productField: "style" },
  { label: "talla", Model: Size },
  { label: "color", Model: Color },
];

/** Correcciones de nombre por slug (mismo slug resultante). */
const NAME_FIXES = { Size: { unica: "Única" } };

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`DB: ${mongoose.connection.name} @ ${mongoose.connection.host}`);
  console.log(APPLY ? "MODO: APLICAR\n" : "MODO: SIMULACIÓN (usa --apply para escribir)\n");

  const categories = await Category.find().lean();
  const categorySlugs = new Set(
    categories.flatMap((c) => {
      const s = slugifyText(c.name);
      return [s, s.replace(/s$/, "")];
    })
  );

  const backup = { createdAt: new Date().toISOString(), products: [], taxonomies: {} };
  const ops = []; // { describe, run }

  // 1. Clasificaciones falsas (tejido/horma = nombre de categoría)
  for (const { label, Model, productField } of TAXONOMIES) {
    if (!productField) continue;
    const docs = await Model.find().lean();
    const fake = docs.filter((d) => categorySlugs.has(slugifyText(d.name)));
    for (const d of fake) {
      const products = await Product.find({ [productField]: d._id })
        .select(`name ${productField}`)
        .lean();
      for (const p of products) {
        backup.products.push({ _id: p._id, field: productField, previous: d._id });
        ops.push({
          describe: `producto "${p.name}": ${label} "${d.name}" → No aplica`,
          run: () =>
            Product.updateOne({ _id: p._id }, { $set: { [productField]: null } }),
        });
      }
      if (d.isActive !== false) {
        (backup.taxonomies[Model.modelName] ||= []).push(d);
        ops.push({
          describe: `${label} "${d.name}" → desactivado (${products.length} producto(s) reasignados)`,
          run: () => Model.updateOne({ _id: d._id }, { $set: { isActive: false } }),
        });
      }
    }
  }

  // 2 y 3. Slugs desalineados y nombres
  for (const { label, Model } of TAXONOMIES) {
    const docs = await Model.find().lean();
    const taken = new Set(docs.map((d) => d.slug));
    for (const d of docs) {
      const set = {};
      const fixedName = NAME_FIXES[Model.modelName]?.[d.slug];
      if (fixedName && fixedName !== d.name) set.name = fixedName;
      const expected = slugifyText(set.name || d.name);
      if (expected && d.slug !== expected) {
        if (taken.has(expected)) {
          console.warn(`  ! ${label} "${d.name}": slug "${expected}" ya existe, se deja "${d.slug}"`);
        } else {
          set.slug = expected;
          taken.delete(d.slug);
          taken.add(expected);
        }
      }
      if (!Object.keys(set).length) continue;
      const list = (backup.taxonomies[Model.modelName] ||= []);
      if (!list.some((x) => String(x._id) === String(d._id))) list.push(d);
      ops.push({
        describe: `${label} "${d.name}": ${Object.entries(set)
          .map(([k, v]) => `${k} "${d[k]}" → "${v}"`)
          .join(", ")}`,
        run: () => Model.updateOne({ _id: d._id }, { $set: set }),
      });
    }
  }

  if (!ops.length) {
    console.log("Nada que limpiar.");
    return;
  }
  ops.forEach((op) => console.log(`  • ${op.describe}`));

  if (!APPLY) {
    console.log(`\n${ops.length} cambio(s) pendientes. Ejecuta con --apply para aplicarlos.`);
    return;
  }

  const dir = path.join(__dirname, "../../logs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `taxonomy-cleanup-backup-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`\nRespaldo: ${file}`);

  for (const op of ops) await op.run();
  console.log(`${ops.length} cambio(s) aplicados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

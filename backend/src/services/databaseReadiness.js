const mongoose = require("mongoose");
const fs = require("node:fs"), path = require("node:path");

exports.loadModels = () => {
  for (const file of fs.readdirSync(path.join(__dirname, "../models"))) {
    if (file.endsWith(".js")) require(path.join(__dirname, "../models", file));
  }
};

const canonical = value => JSON.stringify(value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical(value[k]))]))
  : Array.isArray(value) ? value.map(v => JSON.parse(canonical(v))) : value ?? null);

// Read-only: never creates, drops or repairs production collections/indexes.
exports.inspect = async (connection = mongoose.connection, models = connection.models) => {
  const issues = [], indexes = [];
  const topology = await connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid") issues.push({ code: "TRANSACTIONS_UNAVAILABLE" });
  for (const model of Object.values(models)) {
    const expected = model.schema.indexes().filter(([, options]) => options.unique === true);
    if (!expected.length) continue;
    let existing, collectionOptions;
    try {
      existing = await model.collection.listIndexes().toArray();
      collectionOptions = await model.collection.options();
    } catch (error) {
      if (error.code !== 26) throw error;
      issues.push({ code: "COLLECTION_MISSING", model: model.modelName }); continue;
    }
    for (const [key, options] of expected) {
      const expectedCollation = options.collation || collectionOptions.collation || null;
      const matching = existing.find(index => JSON.stringify(index.key) === JSON.stringify(key)
        && index.unique === true && !!index.sparse === !!options.sparse
        && canonical(index.partialFilterExpression) === canonical(options.partialFilterExpression)
        && (expectedCollation ? Object.entries(expectedCollation).every(([k, v]) => canonical(index.collation?.[k]) === canonical(v)) : !index.collation || index.collation.locale === "simple")
        && !index.buildUUID);
      indexes.push({ model: model.modelName, key, valid: !!matching });
      if (!matching) issues.push({ code: "UNIQUE_INDEX_MISSING_OR_INCOMPATIBLE", model: model.modelName, key });
    }
  }
  return { ready: issues.length === 0, issues, indexes };
};

exports.assertReady = async (connection = mongoose.connection, models = connection.models) => {
  const result = await exports.inspect(connection, models);
  if (!result.ready) throw Object.assign(new Error("La base no cumple las garantías de arranque; revisar inventario de índices y topología"), { code: "DATABASE_NOT_READY", issues: result.issues });
  return result;
};

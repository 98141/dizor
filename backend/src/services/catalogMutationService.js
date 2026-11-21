const mongoose = require("mongoose");
const { inTransaction } = require("./transactionService");
// The existing _id index on a new singleton serializes only catalog metadata
// writes, including cross-product SKU checks. Sales and adjustments do not use it.
const Guard = mongoose.model("CatalogWriteGuard", new mongoose.Schema({ _id: String, version: Number }, { versionKey: false }));
exports.mutateCatalog = async (work) => {
  try { await Guard.updateOne({ _id: "products" }, { $setOnInsert: { version: 0 } }, { upsert: true }); }
  catch (err) { if (err.code !== 11000) throw err; }
  return inTransaction(async (session) => {
    await Guard.updateOne({ _id: "products" }, { $inc: { version: 1 } }, { session });
    return work(session);
  });
};

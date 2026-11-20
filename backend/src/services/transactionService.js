const mongoose = require("mongoose");

// Never fall back to independent writes: order, stock and movement must commit together.
exports.inTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
    });
  } finally {
    await session.endSession();
  }
};

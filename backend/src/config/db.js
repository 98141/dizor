const mongoose = require("mongoose");

const connectDB = async () => {
  mongoose.set("strictQuery", true);
  const production = process.env.NODE_ENV === "production";
  if (production) {
    mongoose.set("autoIndex", false); mongoose.set("autoCreate", false);
    require("../services/databaseReadiness").loadModels();
  }
  const options = production ? { autoIndex: false, autoCreate: false } : {};
  const conn = await mongoose.connect(process.env.MONGO_URI, options);
  if (production) await require("../services/databaseReadiness").assertReady(conn.connection, conn.models);

  return conn;
};

module.exports = connectDB;

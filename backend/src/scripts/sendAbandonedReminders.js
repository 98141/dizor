require("dotenv").config();
const connectDB = require("../config/db");
const { sendDueAbandonedReminders } = require("../services/marketingService");

const run = async () => {
  await connectDB();
  const result = await sendDueAbandonedReminders();
  console.log("Recordatorios enviados:", result.sent, "| omitidos:", result.skipped);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

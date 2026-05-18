require("dotenv").config();
const connectDB = require("../config/db");
const MarketingSettings = require("../models/marketingSettings");

const run = async () => {
  await connectDB();

  await MarketingSettings.findOneAndUpdate(
    { key: "default" },
    {
      key: "default",
      popup: {
        enabled: true,
        title: "Bienvenido a Dizor",
        text: "Suscríbete y entérate de nuevas colecciones artesanales.",
        ctaLabel: "Suscribirme",
        delaySeconds: 5,
        showNewsletterForm: true,
      },
    },
    { upsert: true, new: true }
  );

  console.log("Marketing settings listos.");
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

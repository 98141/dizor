require("dotenv").config();

const connectDB = require("../config/db");
const StoreSettings = require("../models/storeSettings");

const seedStoreSettings = async () => {
  try {
    await connectDB();

    await StoreSettings.findOneAndUpdate(
      { key: "default" },
      {
        key: "default",
        taxEnabled: process.env.TAX_ENABLED === "true",
        taxRate: Number(process.env.TAX_RATE) || 0,
        shippingMode: "included", // envío incluido en el precio (2026-11-16)
        shippingFixedCost: 15000,
        freeShippingMinAmount: 200000,
        currency: "COP",
        carriers: ["interrapidisimo", "servientrega"],
      },
      { upsert: true, new: true }
    );

    console.log("Configuración de tienda inicializada.");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedStoreSettings();

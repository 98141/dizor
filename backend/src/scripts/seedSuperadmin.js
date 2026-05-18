require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/user");

const seedSuperadmin = async () => {
  try {
    await connectDB();

    const existing = await User.findOne({
      email: process.env.SUPERADMIN_EMAIL,
    });

    if (existing) {
      console.log("Superadmin ya existe.");
      process.exit(0);
    }

    await User.create({
      name: process.env.SUPERADMIN_NAME,
      email: process.env.SUPERADMIN_EMAIL,
      password: process.env.SUPERADMIN_PASSWORD,
      role: "superadmin",
      phone: process.env.SUPERADMIN_PHONE || "",
    });

    console.log("Superadmin creado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("Error creando superadmin:", error);
    process.exit(1);
  }
};

seedSuperadmin();
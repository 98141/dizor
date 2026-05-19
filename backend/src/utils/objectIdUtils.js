const mongoose = require("mongoose");

/** Normaliza query params (p. ej. arrays de hpp) a un solo valor string. */
exports.pickQueryValue = (query, key) => {
  const raw = query?.[key];
  if (raw == null || raw === "") return null;
  if (Array.isArray(raw)) return String(raw[raw.length - 1]);
  return String(raw);
};

exports.isValidObjectId = (value) => {
  if (value == null || value === "") return false;
  return mongoose.Types.ObjectId.isValid(String(value));
};

exports.toObjectId = (value) => {
  if (!exports.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
};
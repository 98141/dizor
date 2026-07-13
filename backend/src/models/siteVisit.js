// backend/src/models/siteVisit.js
const mongoose = require("mongoose");

const siteVisitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global",
      unique: true,
    },
    total: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SiteVisit", siteVisitSchema);

// backend/src/controllers/siteVisitController.js
const SiteVisit = require("../models/siteVisit");
const catchAsync = require("../utils/catchAsync");

const COOKIE_NAME = "dizor_visit_day";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const todayKey = () => new Date().toISOString().slice(0, 10);

const visitCookieOptions = () => ({
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: ONE_DAY_MS,
});

// Suma una visita solo si el visitante no tiene ya la cookie del día de hoy.
// La deduplicación principal ocurre en el cliente (localStorage); esta cookie
// es un respaldo por si el cliente la borra o llega desde otro navegador de sesión.
exports.registerVisit = catchAsync(async (req, res) => {
  const today = todayKey();
  const alreadyCountedToday = req.cookies?.[COOKIE_NAME] === today;

  const doc = await SiteVisit.findOneAndUpdate(
    { key: "global" },
    alreadyCountedToday ? {} : { $inc: { total: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (!alreadyCountedToday) {
    res.cookie(COOKIE_NAME, today, visitCookieOptions());
  }

  res.status(200).json({ status: "success", total: doc.total });
});

exports.getVisitCount = catchAsync(async (req, res) => {
  const doc = await SiteVisit.findOne({ key: "global" });
  res.status(200).json({ status: "success", total: doc?.total || 0 });
});

const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/customerRequestController");
const { optionalAuth } = require("../middlewares/optionalAuthMiddleware");
const { trackingLimiter } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "fail", message: "Demasiadas solicitudes. Intenta más tarde." },
});

router.get("/config", controller.getConfig);
router.post("/", createLimiter, optionalAuth, controller.create);
router.post("/track", trackingLimiter, controller.track);

module.exports = router;

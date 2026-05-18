const express = require("express");
const rateLimit = require("express-rate-limit");
const { optionalAuth } = require("../middlewares/optionalAuthMiddleware");
const marketingPublicController = require("../controllers/marketingPublicController");

const router = express.Router();

const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { status: "fail", message: "Demasiados intentos. Intenta más tarde." },
});

router.get("/config", marketingPublicController.getMarketingConfig);
router.post(
  "/newsletter",
  subscribeLimiter,
  marketingPublicController.subscribe
);
router.post(
  "/abandoned-cart",
  subscribeLimiter,
  optionalAuth,
  marketingPublicController.saveAbandonedCart
);

module.exports = router;

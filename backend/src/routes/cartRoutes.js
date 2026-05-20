const express = require("express");
const cartController = require("../controllers/cartController");
const { protect } = require("../middlewares/authMiddleware");
const { optionalAuth } = require("../middlewares/optionalAuthMiddleware");

const router = express.Router();

router.post("/validate", optionalAuth, cartController.validateCart);
router.post("/coupon", cartController.validateCoupon);
router.get("/", protect, cartController.getMyCart);
router.put("/sync", protect, cartController.syncCart);

module.exports = router;

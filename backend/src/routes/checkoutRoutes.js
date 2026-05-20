const express = require("express");
const checkoutController = require("../controllers/checkoutController");
const { protect } = require("../middlewares/authMiddleware");
const { optionalAuth } = require("../middlewares/optionalAuthMiddleware");
const { blockStaffCheckout } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get("/config", checkoutController.getCheckoutConfig);
router.post("/calculate", optionalAuth, checkoutController.calculateCheckout);
router.post("/orders", optionalAuth, blockStaffCheckout, checkoutController.createCheckoutOrder);
router.get("/track", checkoutController.trackGuestOrder);

router.get("/orders", protect, checkoutController.getMyOrders);
router.get("/orders/:id", protect, checkoutController.getMyOrder);
router.patch("/orders/:id/cancel", protect, checkoutController.cancelMyOrder);

module.exports = router;

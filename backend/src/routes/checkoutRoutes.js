const express = require("express");
const checkoutController = require("../controllers/checkoutController");
const { protect } = require("../middlewares/authMiddleware");
const { optionalAuth } = require("../middlewares/optionalAuthMiddleware");
const { blockStaffCheckout } = require("../middlewares/roleMiddleware");
const { trackingLimiter } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

router.get("/config", checkoutController.getCheckoutConfig);
router.post("/calculate", optionalAuth, checkoutController.calculateCheckout);
router.post("/orders", optionalAuth, blockStaffCheckout, checkoutController.createCheckoutOrder);

// Seguimiento: el correo viaja en el cuerpo, no en la URL (H-06).
router.post("/track", trackingLimiter, checkoutController.trackGuestOrder);
router.get("/track", checkoutController.trackGuestOrderLegacy);

// Confirmación protegida por dueño autenticado o token de acceso (H-06).
router.post(
  "/orders/lookup",
  trackingLimiter,
  optionalAuth,
  checkoutController.lookupOrderConfirmation
);

router.get("/orders", protect, checkoutController.getMyOrders);
router.get("/orders/:id", protect, checkoutController.getMyOrder);
router.patch("/orders/:id/cancel", protect, checkoutController.cancelMyOrder);

module.exports = router;

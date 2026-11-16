const express = require("express");
const specialRequestController = require("../controllers/specialRequestController");
const { optionalAuth } = require("../middlewares/optionalAuthMiddleware");
const { protect } = require("../middlewares/authMiddleware");
const { authLimiter, trackingLimiter } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

router.post(
  "/",
  authLimiter,
  optionalAuth,
  specialRequestController.createRequest
);
// Seguimiento: correo en el cuerpo (H-06) y limitador específico (H-28).
router.post("/track", trackingLimiter, specialRequestController.trackRequest);
router.get("/track", specialRequestController.trackRequestLegacy);
router.get("/mine", protect, specialRequestController.getMyRequests);

module.exports = router;

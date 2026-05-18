const express = require("express");
const specialRequestController = require("../controllers/specialRequestController");
const { optionalAuth } = require("../middlewares/optionalAuthMiddleware");
const { protect } = require("../middlewares/authMiddleware");
const { authLimiter } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

router.post(
  "/",
  authLimiter,
  optionalAuth,
  specialRequestController.createRequest
);
router.get("/track", specialRequestController.trackRequest);
router.get("/mine", protect, specialRequestController.getMyRequests);

module.exports = router;

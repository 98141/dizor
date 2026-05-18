const express = require("express");
const authController = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const {
  loginLimiter,
  authLimiter,
} = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

router.post("/register", authLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);

router.get("/me", protect, authController.getMe);

router.get(
  "/admin-test",
  protect,
  authorizeRoles("superadmin", "admin"),
  (req, res) => {
    res.json({
      status: "success",
      message: "Ruta protegida para superadmin/admin",
      user: req.user,
    });
  }
);

module.exports = router;
const express = require("express");
const authController = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const { validate } = require("../middlewares/validateMiddleware");
const {
  loginLimiter,
  authLimiter,
  forgotPasswordLimiter,
} = require("../middlewares/rateLimitMiddleware");
const {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  updatePasswordRules,
} = require("../validators/authValidator");

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  registerRules,
  validate,
  authController.register
);
router.post(
  "/login",
  loginLimiter,
  loginRules,
  validate,
  authController.login
);
router.post("/refresh-token", authLimiter, authController.refreshToken);
router.post("/logout", authLimiter, authController.logout);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  forgotPasswordRules,
  validate,
  authController.forgotPassword
);
router.patch(
  "/reset-password/:token",
  resetPasswordRules,
  validate,
  authController.resetPassword
);

router.get("/me", protect, authController.getMe);
router.patch("/me", protect, authController.updateProfile);
router.post("/me/addresses", protect, authController.addAddress);
router.patch("/me/addresses/:addressId", protect, authController.updateAddress);
router.delete("/me/addresses/:addressId", protect, authController.deleteAddress);
router.patch(
  "/update-password",
  protect,
  updatePasswordRules,
  validate,
  authController.updatePassword
);

router.get(
  "/superadmin-test",
  protect,
  authorizeRoles("superadmin"),
  (req, res) => {
    res.json({
      status: "success",
      message: "Ruta exclusiva para superadmin",
      user: req.user,
    });
  }
);

router.get(
  "/admin-test",
  protect,
  authorizeRoles("superadmin", "admin"),
  (req, res) => {
    res.json({
      status: "success",
      message: "Ruta para superadmin/admin",
      user: req.user,
    });
  }
);

router.get(
  "/vendedor-test",
  protect,
  authorizeRoles("superadmin", "admin", "vendedor"),
  (req, res) => {
    res.json({
      status: "success",
      message: "Ruta para vendedores/admin/superadmin",
      user: req.user,
    });
  }
);

module.exports = router;

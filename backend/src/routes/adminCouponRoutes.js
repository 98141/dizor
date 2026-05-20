const express = require("express");
const adminCouponController = require("../controllers/adminCouponController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("superadmin", "admin"));

router
  .route("/")
  .get(adminCouponController.getCoupons)
  .post(adminCouponController.createCoupon);

router
  .route("/:id")
  .patch(adminCouponController.updateCoupon)
  .delete(adminCouponController.deleteCoupon);

router.patch("/:id/toggle", adminCouponController.toggleCoupon);

module.exports = router;

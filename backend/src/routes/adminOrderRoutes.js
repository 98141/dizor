const express = require("express");
const orderAdminController = require("../controllers/orderAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const staffRoles = ["superadmin", "admin", "vendedor"];

router.use(protect);
router.use(authorizeRoles(...staffRoles));

router.get("/stats", orderAdminController.getOrderStats);
router.get("/export/pdf", orderAdminController.exportOrdersPdf);
router.post("/manual", orderAdminController.createManualOrder);
router.get("/", orderAdminController.getOrders);
router.get("/:id", orderAdminController.getOrder);
router.patch("/:id/status", orderAdminController.updateOrderStatus);
router.patch("/:id/payment", orderAdminController.confirmPayment);
router.patch("/:id/shipping", orderAdminController.updateShipping);
router.patch("/:id/assign", orderAdminController.assignOrder);

module.exports = router;

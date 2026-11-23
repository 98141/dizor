const express = require("express");
const orderAdminController = require("../controllers/orderAdminController");
const communications = require("../controllers/notificationAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const staffRoles = ["superadmin", "admin", "vendedor"];

router.use(protect);
router.use(authorizeRoles(...staffRoles));

router.get("/stats", orderAdminController.getOrderStats);
router.get("/export/pdf", orderAdminController.exportOrdersPdf);
router.get("/", orderAdminController.getOrders);
router.get("/payment-events", authorizeRoles("superadmin", "admin"), orderAdminController.listPaymentEvents);
router.post("/payment-events/:eventId/reprocess", authorizeRoles("superadmin", "admin"), orderAdminController.reprocessPaymentEvent);
router.post("/payment-events/:eventId/archive", authorizeRoles("superadmin", "admin"), orderAdminController.archivePaymentEvent);
router.post("/payment-events/:eventId/reopen", authorizeRoles("superadmin", "admin"), orderAdminController.reopenPaymentEvent);
router.post("/payment-events/:eventId/conclude-follow-up", authorizeRoles("superadmin", "admin"), orderAdminController.concludePaymentEventFollowUp);
router.get("/:id", orderAdminController.getOrder);
router.get("/:id/communications", communications.list);
router.post("/:id/communications/:notificationId/retry", authorizeRoles("superadmin", "admin"), communications.retry);
router.post("/:id/communications/:notificationId/resend", authorizeRoles("superadmin", "admin"), communications.resend);
router.patch("/:id/status", orderAdminController.updateOrderStatus);
router.patch("/:id/payment", orderAdminController.confirmPayment);
router.post("/:id/reconcile-wompi", authorizeRoles("superadmin", "admin"), orderAdminController.reconcileWompi);
router.post("/:id/incidents/:incidentId/resolve", authorizeRoles("superadmin", "admin"), orderAdminController.resolveIncident);
router.patch("/:id/shipping", orderAdminController.updateShipping);
router.patch("/:id/assign", orderAdminController.assignOrder);

module.exports = router;

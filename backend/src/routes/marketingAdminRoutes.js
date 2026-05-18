const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const marketingAdminController = require("../controllers/marketingAdminController");

const router = express.Router();
const adminRoles = ["superadmin", "admin"];

router.use(protect);
router.use(authorizeRoles(...adminRoles));

router.get("/settings", marketingAdminController.getSettings);
router.patch("/settings", marketingAdminController.updateSettings);
router.get("/newsletter", marketingAdminController.getSubscribers);
router.delete(
  "/newsletter/:id",
  marketingAdminController.unsubscribeSubscriber
);
router.get("/newsletter/export", marketingAdminController.exportNewsletterCsv);
router.get("/orders/export", marketingAdminController.exportOrdersCsv);
router.get("/abandoned-carts", marketingAdminController.getAbandonedCarts);
router.get(
  "/abandoned-carts/export",
  marketingAdminController.exportAbandonedCartsCsv
);
router.post(
  "/abandoned-carts/send-reminders",
  marketingAdminController.sendAbandonedReminders
);

module.exports = router;

const express = require("express");
const productHistoryAdminController = require("../controllers/productHistoryAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const adminRoles = ["superadmin", "admin"];

router.use(protect);
router.use(authorizeRoles(...adminRoles));

router.get("/history/stats", productHistoryAdminController.getStats);
router.get("/history/export-pdf", productHistoryAdminController.exportPdf);
router.get("/history", productHistoryAdminController.getHistory);

module.exports = router;

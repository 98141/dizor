const express = require("express");
const financeAdminController = require("../controllers/financeAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("superadmin"));

router.get("/report", financeAdminController.getReport);
router.get("/overview", financeAdminController.getOverview);
router.get("/export/csv", financeAdminController.exportCsv);
router.get("/export/xlsx", financeAdminController.exportXlsx);
router.get("/export/pdf", financeAdminController.exportPdf);

module.exports = router;

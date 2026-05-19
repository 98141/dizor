const express = require("express");
const auditAdminController = require("../controllers/auditAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const adminRoles = ["superadmin", "admin"];

router.use(protect);
router.use(authorizeRoles(...adminRoles));

router.get("/stats", auditAdminController.getAuditStats);
router.get("/", auditAdminController.getAuditLogs);

module.exports = router;

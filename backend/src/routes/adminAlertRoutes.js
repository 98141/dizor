const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const alertController = require("../controllers/adminAlertController");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("superadmin", "admin"));

router.get("/", alertController.getAlerts);

module.exports = router;

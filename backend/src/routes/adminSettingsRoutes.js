const express = require("express");
const settingsAdminController = require("../controllers/settingsAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("superadmin", "admin"));

router.get("/", settingsAdminController.getSettings);
router.patch("/", settingsAdminController.updateSettings);

module.exports = router;

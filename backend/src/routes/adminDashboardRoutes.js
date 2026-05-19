const express = require("express");
const dashboardAdminController = require("../controllers/dashboardAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const adminRoles = ["superadmin", "admin"];

router.use(protect);
router.use(authorizeRoles(...adminRoles));

router.get("/", dashboardAdminController.getDashboard);

module.exports = router;

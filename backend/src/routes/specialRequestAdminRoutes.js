const express = require("express");
const specialRequestAdminController = require("../controllers/specialRequestAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const staffRoles = ["superadmin", "admin", "vendedor"];

router.use(protect);
router.use(authorizeRoles(...staffRoles));

router.get("/stats", specialRequestAdminController.getStats);
router.get("/", specialRequestAdminController.getRequests);
router.get("/:id", specialRequestAdminController.getRequest);
router.patch("/:id/status", specialRequestAdminController.updateStatus);
router.patch("/:id/quote", specialRequestAdminController.updateQuote);
router.patch("/:id/notes", specialRequestAdminController.updateAdminNotes);

module.exports = router;

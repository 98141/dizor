const express = require("express");
const adminUserController = require("../controllers/adminUserController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("superadmin"));

router
  .route("/")
  .post(adminUserController.createAdminUser)
  .get(adminUserController.getAdminUsers);

router.patch("/:id/status", adminUserController.updateAdminUserStatus);

module.exports = router;
const express = require("express");
const homeImageAdminController = require("../controllers/homeImageAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const {
  uploadProductImages,
  requireCloudinary,
} = require("../middlewares/uploadMiddleware");

const router = express.Router();
const adminRoles = ["superadmin", "admin"];

router.use(protect);
router.use(authorizeRoles(...adminRoles));

router.get("/", homeImageAdminController.listHomeImages);
router.post(
  "/",
  requireCloudinary,
  uploadProductImages,
  homeImageAdminController.createHomeImage
);
router.patch("/reorder", homeImageAdminController.reorderHomeImages);
router.patch(
  "/:id",
  uploadProductImages,
  homeImageAdminController.updateHomeImage
);
router.delete("/:id", homeImageAdminController.deleteHomeImage);

module.exports = router;

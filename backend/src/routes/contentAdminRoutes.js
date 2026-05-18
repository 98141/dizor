const express = require("express");
const contentAdminController = require("../controllers/contentAdminController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

const adminRoles = ["superadmin", "admin"];

router.use(protect);
router.use(authorizeRoles(...adminRoles));

router.get("/home", contentAdminController.getHomeContent);
router.patch("/home", contentAdminController.updateHomeContent);

router.get("/pages", contentAdminController.getPages);
router.post("/pages", contentAdminController.createPage);
router.get("/pages/:id", contentAdminController.getPage);
router.patch("/pages/:id", contentAdminController.updatePage);
router.delete("/pages/:id", contentAdminController.deletePage);

router.get("/banners", contentAdminController.getBanners);
router.post("/banners", contentAdminController.createBanner);
router.patch("/banners/:id", contentAdminController.updateBanner);
router.delete("/banners/:id", contentAdminController.deleteBanner);

module.exports = router;

const express = require("express");
const contentPublicController = require("../controllers/contentPublicController");

const router = express.Router();

router.get("/home", contentPublicController.getHomeContent);
router.get("/banners", contentPublicController.getBanners);
router.get("/pages", contentPublicController.getPages);
router.get("/pages/:slug", contentPublicController.getPageBySlug);

module.exports = router;

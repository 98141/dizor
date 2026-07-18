// backend/src/routes/productPublicRoutes.js
const express = require("express");
const productPublicController = require("../controllers/productPublicController");
const { optionalAuth } = require("../middlewares/optionalAuthMiddleware");

const router = express.Router();

router.get("/filters", productPublicController.getCatalogFilters);
router.get("/featured", productPublicController.getFeaturedProducts);
router.get("/daily-random", productPublicController.getDailyRandomProducts);
router.get("/", productPublicController.getProducts);

router.get(
  "/:slug",
  optionalAuth,
  productPublicController.getProductBySlug
);

module.exports = router;
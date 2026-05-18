const express = require("express");
const productPublicController = require("../controllers/productPublicController");

const router = express.Router();

router.get("/filters", productPublicController.getCatalogFilters);
router.get("/featured", productPublicController.getFeaturedProducts);
router.get("/", productPublicController.getProducts);
router.get("/:slug", productPublicController.getProductBySlug);

module.exports = router;

const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");
const taxonomyAdminController = require("../controllers/taxonomyAdminController");
const productAdminController = require("../controllers/productAdminController");
const {
  uploadProductImages,
  requireCloudinary,
} = require("../middlewares/uploadMiddleware");

const router = express.Router();

const staffRoles = ["superadmin", "admin", "vendedor"];
const adminRoles = ["superadmin", "admin"];

router.use(protect);
router.use(authorizeRoles(...staffRoles));

Object.entries(taxonomyAdminController.handlers).forEach(([type, handlers]) => {
  router.get(`/${type}`, handlers.list);
  router.post(`/${type}`, authorizeRoles(...adminRoles), handlers.create);
  router.patch(`/${type}/:id`, authorizeRoles(...adminRoles), handlers.update);
  router.delete(`/${type}/:id`, authorizeRoles(...adminRoles), handlers.remove);
});

router.post(
  "/upload",
  authorizeRoles(...adminRoles),
  requireCloudinary,
  uploadProductImages,
  productAdminController.uploadTempImages
);

router.get("/meta", productAdminController.getCatalogMeta);
router.get("/products/inventory", productAdminController.getInventorySummary);
router.get("/products", productAdminController.getProducts);
router.get("/products/:id", productAdminController.getProduct);
router.post("/products", authorizeRoles(...adminRoles), productAdminController.createProduct);
router.patch("/products/:id", authorizeRoles(...adminRoles), productAdminController.updateProduct);
router.delete(
  "/products/:id",
  authorizeRoles(...adminRoles),
  productAdminController.deleteProduct
);
router.post(
  "/products/:id/images",
  authorizeRoles(...adminRoles),
  requireCloudinary,
  uploadProductImages,
  productAdminController.uploadImages
);
router.post(
  "/products/:id/images/url",
  authorizeRoles(...adminRoles),
  productAdminController.addImageUrl
);
router.patch(
  "/products/:id/images",
  authorizeRoles(...adminRoles),
  productAdminController.removeImage
);

module.exports = router;

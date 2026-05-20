const express = require("express");
const adminPosController = require("../controllers/adminPosController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("superadmin", "admin", "vendedor"));

router.get("/search", adminPosController.searchProducts);
router.post("/sales", adminPosController.createPosSale);
router.get("/sales", adminPosController.getPosSales);
router.patch("/sales/:id/void", adminPosController.voidPosSale);
router.get("/cash-close", adminPosController.getCashClose);
router.get("/cash-close/pdf", adminPosController.exportCashClosePdf);

module.exports = router;

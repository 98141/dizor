const express = require("express");
const reviewController = require("../controllers/reviewController");
const { protect } = require("../middlewares/authMiddleware");
const { authorizeRoles } = require("../middlewares/roleMiddleware");

const router = express.Router();
const adminRoles = ["superadmin", "admin"];

router.use(protect);
router.use(authorizeRoles(...adminRoles));

router.get("/", reviewController.adminListReviews);
router.post("/brand", reviewController.createBrandReview);
router.patch("/:id/approve", reviewController.approveReview);
router.delete("/:id", reviewController.rejectReview);

module.exports = router;

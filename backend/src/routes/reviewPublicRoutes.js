const express = require("express");
const reviewController = require("../controllers/reviewController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", reviewController.getApprovedReviews);
router.get("/product/:productId", reviewController.getProductReviews);
router.post("/", protect, reviewController.createCustomerReview);

module.exports = router;

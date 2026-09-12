const express = require("express");
const favoriteController = require("../controllers/favoriteController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", favoriteController.getMyFavorites);
router.get("/ids", favoriteController.getMyFavoriteIds);
router.put("/sync", favoriteController.syncFavorites);
router.post("/remove-many", favoriteController.removeManyFavorites);
router.post("/:productId", favoriteController.addFavorite);
router.delete("/:productId", favoriteController.removeFavorite);

module.exports = router;

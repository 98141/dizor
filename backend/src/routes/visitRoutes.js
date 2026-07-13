const express = require("express");
const siteVisitController = require("../controllers/siteVisitController");

const router = express.Router();

router.get("/count", siteVisitController.getVisitCount);
router.post("/register", siteVisitController.registerVisit);

module.exports = router;

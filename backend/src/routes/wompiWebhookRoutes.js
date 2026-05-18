const express = require("express");
const wompiWebhookController = require("../controllers/wompiWebhookController");

const router = express.Router();

router.post("/wompi", wompiWebhookController.handleWompiEvent);

module.exports = router;

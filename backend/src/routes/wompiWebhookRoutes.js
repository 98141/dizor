const express = require("express");
const wompiWebhookController = require("../controllers/wompiWebhookController");
const { webhookLimiter } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

router.post("/wompi", webhookLimiter, wompiWebhookController.handleWompiEvent);

module.exports = router;

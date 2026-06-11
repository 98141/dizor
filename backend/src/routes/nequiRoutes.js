const express   = require("express");
const rateLimit = require("express-rate-limit");
const nequiController = require("../controllers/nequiController");
const { webhookLimiter } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

// 30 consultas/minuto por IP — suficiente para polling cada 4 s
const nequiPollLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Demasiadas consultas de estado Nequi. Intenta más tarde.",
  },
});

// 10 reintentos/minuto por IP — previene spam al cobro
const nequiCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Demasiados intentos de cobro Nequi. Intenta más tarde.",
  },
});

router.post("/create",              nequiCreateLimiter, nequiController.createNequiPayment);
router.get("/status/:orderId",      nequiPollLimiter,   nequiController.getNequiStatus);
router.post("/webhook",             webhookLimiter,     nequiController.handleNequiWebhook);

module.exports = router;

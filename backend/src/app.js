// backend/src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("mongo-sanitize");
const hpp = require("hpp");
const xss = require("xss-clean");

const AppError = require("./utils/AppError");
const globalErrorHandler = require("./middlewares/errorMiddleware");
const logger = require("./lib/logger");
const authRoutes = require("./routes/authRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const productPublicRoutes = require("./routes/productPublicRoutes");
const adminCatalogRoutes = require("./routes/adminCatalogRoutes");
const cartRoutes = require("./routes/cartRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const adminSettingsRoutes = require("./routes/adminSettingsRoutes");
const specialRequestRoutes = require("./routes/specialRequestRoutes");
const specialRequestAdminRoutes = require("./routes/specialRequestAdminRoutes");
const contentPublicRoutes = require("./routes/contentPublicRoutes");
const contentAdminRoutes = require("./routes/contentAdminRoutes");
const marketingPublicRoutes = require("./routes/marketingPublicRoutes");
const marketingAdminRoutes = require("./routes/marketingAdminRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const adminAuditRoutes = require("./routes/adminAuditRoutes");
const adminInventoryRoutes = require("./routes/adminInventoryRoutes");
const adminFinanceRoutes = require("./routes/adminFinanceRoutes");
const wompiWebhookRoutes = require("./routes/wompiWebhookRoutes");
const adminCouponRoutes = require("./routes/adminCouponRoutes");
const adminPosRoutes = require("./routes/adminPosRoutes");
const adminAlertRoutes = require("./routes/adminAlertRoutes");

const app = express();

app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
    stream: logger.stream,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/admin"),
  message: {
    status: "fail",
    message: "Demasiadas solicitudes desde esta IP. Intenta más tarde.",
  },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "fail",
    message: "Demasiadas solicitudes desde esta IP. Intenta más tarde.",
  },
});

app.use("/api", globalLimiter);
app.use("/api/admin", adminLimiter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  req.body = mongoSanitize(req.body);
  req.params = mongoSanitize(req.params);
  req.query = mongoSanitize(req.query);
  next();
});

app.use(xss());

app.use(
  hpp({
    whitelist: [
      "price",
      "size",
      "color",
      "category",
      "style",
      "weaveType",
      "tags",
      "range",
      "period",
      "from",
      "to",
    ],
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Dizor API funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/products", productPublicRoutes);
app.use("/api/admin/catalog", adminCatalogRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/special-requests", specialRequestRoutes);
app.use("/api/admin/special-requests", specialRequestAdminRoutes);
app.use("/api/content", contentPublicRoutes);
app.use("/api/admin/content", contentAdminRoutes);
app.use("/api/marketing", marketingPublicRoutes);
app.use("/api/admin/marketing", marketingAdminRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/audit", adminAuditRoutes);
app.use("/api/admin/inventory", adminInventoryRoutes);
app.use("/api/admin/finance", adminFinanceRoutes);
app.use("/api/webhooks", wompiWebhookRoutes);
app.use("/api/admin/coupons", adminCouponRoutes);
app.use("/api/admin/pos", adminPosRoutes);
app.use("/api/admin/alerts", adminAlertRoutes);

app.use((req, res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.originalUrl}`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
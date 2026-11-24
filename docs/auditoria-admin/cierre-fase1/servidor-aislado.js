"use strict";
// Servidor efímero para la revisión visual. No lee .env ni usa datos reales.
const path = require("path");
const Module = require("module");
const ROOT = path.resolve(__dirname, "../../..");
const BACKEND = path.join(ROOT, "backend");
const MMS = process.env.MMS_DIR;
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "winston-daily-rotate-file") {
    const Transport = orig("winston-transport", parent, isMain);
    return class NullTransport extends Transport { log(_i, cb) { cb(); } };
  }
  return orig.apply(this, arguments);
};
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: "",
  JWT_SECRET: "auditoria-cierre-fase1-secreto-local-32",
  JWT_REFRESH_SECRET: "auditoria-cierre-fase1-refresh-local-32",
  JWT_EXPIRES_IN: "30m",
  JWT_REFRESH_EXPIRES_IN: "1d",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  WOMPI_PRIVATE_KEY: "prv_test_ficticia",
  WOMPI_EVENTS_SECRET: "events_ficticio_visual",
  WOMPI_ENV: "sandbox",
  NEQUI_DIRECT_ENABLED: "",
  NEQUI_MANUAL_ENABLED: "",
  CLIENT_URL: "http://127.0.0.1:3456",
  MARKETING_CART_REMINDERS_ENABLED: "false",
});
const { MongoMemoryReplSet } = require(path.join(MMS, "node_modules", "mongodb-memory-server"));
const mongoose = require(path.join(BACKEND, "node_modules", "mongoose"));
(async () => {
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await mongoose.connect(mongod.getUri());
  const app = require(path.join(BACKEND, "src", "app"));
  const User = require(path.join(BACKEND, "src", "models", "user"));
  const Product = require(path.join(BACKEND, "src", "models", "product"));
  const Order = require(path.join(BACKEND, "src", "models", "order"));
  const Category = require(path.join(BACKEND, "src", "models", "category"));
  const Size = require(path.join(BACKEND, "src", "models", "size"));
  const Color = require(path.join(BACKEND, "src", "models", "color"));
  const [cat, size, color] = await Promise.all([
    Category.create({ name: "Visual" }), Size.create({ name: "M" }), Color.create({ name: "Natural" }),
  ]);
  const product = await Product.create({
    name: "Sombrero de prueba", category: cat._id, salePrice: 120000, internalCost: 424242,
    mainImage: "https://example.test/p.jpg", images: [{ url: "https://example.test/p.jpg" }],
    variants: [{ size: size._id, color: color._id, sku: "VIS-M", stock: 4, isActive: true }],
  });
  await User.create({ name: "Admin Visual", email: "admin-visual@example.test", password: "VisualPrueba123", role: "admin" });
  await User.create({ name: "Vend Visual", email: "vend-visual@example.test", password: "VisualPrueba123", role: "vendedor" });
  const order = await Order.create({
    orderNumber: "DIZ-20261120-VISUAL000000000001",
    buyer: { name: "Cliente Visual", email: "cliente-visual@example.test", phone: "3000000000" },
    shippingAddress: { address: "Calle 1", city: "Pasto", department: "Nariño" },
    items: [{ product: product._id, variantId: product.variants[0]._id, productName: "Sombrero de prueba", quantity: 1, unitPrice: 120000, lineTotal: 120000, unitCost: 424242 }],
    subtotal: 120000, total: 120000, paymentMethod: "contra_entrega", paymentStatus: "pendiente",
    orderStatus: "entregado", stockDeducted: true, deliveredAt: new Date(), carrier: "interrapidisimo", trackingNumber: "GUIA-VISUAL",
    statusHistory: [{ status: "entregado", note: "Entrega ficticia para revisión visual", changedAt: new Date() }],
  });
  const server = app.listen(5099, "127.0.0.1", () => {
    process.stdout.write(`READY order=${order._id}\n`);
  });
  const stop = async () => { server.close(); await mongoose.disconnect(); await mongod.stop(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
})().catch((error) => { process.stderr.write(String(error.stack || error)); process.exit(1); });

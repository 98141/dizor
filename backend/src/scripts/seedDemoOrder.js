// backend/src/scripts/seedDemoOrder.js
require("dotenv").config();

const connectDB = require("../config/db");
const Product = require("../models/product");
require("../models/size");
require("../models/color");
require("../models/category");
require("../models/weaveType");
require("../models/style");
const Order = require("../models/order");
const { getStoreSettings } = require("../services/settingsService");
const { resolveCartItems, calculateTotals } = require("../services/cartService");
const { createOrder } = require("../services/orderService");


const seedDemoOrder = async () => {
  try {
    await connectDB();

    const existing = await Order.findOne({ orderNumber: /^DIZ-/ });
    if (existing && process.env.FORCE_DEMO_ORDER !== "true") {
      console.log(
        "Ya hay pedidos en la BD. Usa FORCE_DEMO_ORDER=true para crear otro demo."
      );
      process.exit(0);
    }

    const product = await Product.findOne({ isActive: true });

    if (!product) {
      console.log("No hay productos. Ejecuta primero: npm run seed:catalog");
      process.exit(1);
    }

    const variant = product.variants.find((v) => v.isActive && v.stock > 0);

    if (!variant) {
      console.log("No hay variantes con stock.");
      process.exit(1);
    }

    const items = [
      {
        productId: product._id,
        variantId: variant._id,
        quantity: 1,
      },
    ];

    const resolved = await resolveCartItems(items);
    const settings = await getStoreSettings();
    const totals = calculateTotals(resolved, settings, "Nariño");

    const order = await createOrder({
      isGuest: true,
      buyer: {
        name: "Cliente Demo",
        email: "demo@dizor.com",
        phone: "3001234567",
      },
      shippingAddress: {
        address: "Calle 10 # 5-20",
        city: "Sandoná",
        department: "Nariño",
        postalCode: "",
      },
      items: resolved,
      totals,
      paymentMethod: "nequi_manual",
      carrier: "interrapidisimo",
      customerNotes: "Pedido de prueba generado por seed",
    });

    console.log("Pedido demo creado:", order.orderNumber);
    console.log("Total:", order.total, "COP");
    console.log("Estado:", order.orderStatus, "| Pago:", order.paymentStatus);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

seedDemoOrder();

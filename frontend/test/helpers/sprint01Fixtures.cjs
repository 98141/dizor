"use strict";
// Fictitious, deterministic data for the Sprint 01 visual harness.
// Shapes mirror the real API contracts (/admin/dashboard, /admin/dashboard/analytics,
// /admin/alerts, /admin/orders/payment-events). Names, numbers and SKUs are invented.
const NOW = Date.parse("2026-11-24T15:30:00-05:00");
const hex = (seed) => require("node:crypto").createHash("sha1").update(`dizor-ficticio-${seed}`).digest("hex").slice(0, 20).toUpperCase();
const ago = (hours) => new Date(NOW - hours * 3600000).toISOString();
const buyers = ["María Fernanda Ortiz", "Juan Camilo Rosero", "Laura Valentina Benavides", "Andrés Felipe Guerrero", "Daniela Cabrera Muñoz", "Santiago Insuasty", "Paula Andrea Erazo", "Camilo Ernesto Bastidas"];
const orderNumber = (i, hours) => `DIZ-${new Date(NOW - hours * 3600000 - 5 * 3600000).toISOString().slice(0, 10).replace(/-/g, "")}-${hex(i + 7)}`;
const order = (i, state, method, payment, hours, extra = {}) => ({
  _id: `ord${i}`, id: `ord${i}`, orderNumber: orderNumber(i, hours), buyer: { name: buyers[i % buyers.length], email: `cliente${i}@example.test`, phone: "3001234567" },
  total: [189000, 245000, 98000, 312000, 156000, 420000, 76000, 268000][i % 8], subtotal: 0, paymentMethod: method, paymentStatus: payment, orderStatus: state,
  stockDeducted: method === "contra_entrega" || payment === "pagado", checkoutState: "ready", requiresReview: false, incidents: [], createdAt: ago(hours),
  carrier: state === "enviado" ? "servientrega" : "", trackingNumber: state === "enviado" ? "FICTICIA-501" : "", items: [], statusHistory: [], wompi: {}, ...extra,
});
const recentOrders = [
  order(0, "pagado", "wompi", "pagado", 1.2),
  order(1, "pendiente", "contra_entrega", "pendiente", 2.5),
  order(2, "en_preparacion", "contra_entrega", "pendiente", 5),
  order(3, "pago_pendiente", "wompi", "pendiente", 7, { }),
  order(4, "en_preparacion", "wompi", "pagado", 20, { requiresReview: true, incidents: [{ code: "approved_without_stock", detail: "Pago con inventario insuficiente" }] }),
  order(5, "enviado", "wompi", "pagado", 30),
  order(6, "entregado", "contra_entrega", "pendiente", 52),
  order(7, "cancelado", "wompi", "rechazado", 70),
];
const attention = { prepare: 4, dispatch: 3, transit: 5, collection: 2, review: 1, all: 48, communications: 3 };
const vendorAttention = { prepare: 4, dispatch: 3, transit: 5, collection: 2, review: 1, all: 48 };

const products = [
  ["p1", "Sombrero Aguadeño clásico"], ["p2", "Sombrero Fedora iraca natural"], ["p3", "Bolso tejido Sandoná"],
  ["p4", "Sombrero Panamá fino ala corta"], ["p5", "Cartera de mano en iraca"], ["p6", "Sombrero playero ala ancha"],
  ["p7", "Llavero mini sombrero"], ["p8", "Individuales tejidos (juego de 4)"], ["p9", "Abanico tejido a mano"],
  ["p10", "Sombrero vueltiao fino 21 vueltas con cinta"],
];
const DAY = 86400000;
const civil = (ms) => new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
const startOfCivil = (key) => Date.parse(`${key}T00:00:00-05:00`);
const salesFor = (i) => [0, 245000, 189000, 0, 512000, 98000, 356000, 156000, 0, 268000, 420000, 189000, 0, 76000, 610000, 245000, 98000, 0, 312000, 189000, 434000, 0, 156000, 268000, 520000, 98000, 189000, 0, 356000, 245000][i % 30];
function periodOf(query) {
  const today = civil(NOW), key = query.get("period") || "30d";
  if (key === "custom") return { key, from: query.get("from"), to: query.get("to"), label: `Del ${query.get("from")} al ${query.get("to")}` };
  const days = { today: 1, "7d": 7, "30d": 30 }[key];
  if (days) return { key, from: civil(startOfCivil(today) - (days - 1) * DAY), to: today, label: { today: "Hoy", "7d": "Últimos 7 días", "30d": "Últimos 30 días" }[key] };
  return { key: "month", from: `${today.slice(0, 7)}-01`, to: today, label: "Este mes" };
}
function analytics(query, { empty = false } = {}) {
  const period = periodOf(query);
  const start = startOfCivil(period.from), end = Math.min(startOfCivil(period.to) + DAY, NOW);
  const granularity = period.key === "today" ? "hour" : "day";
  const series = [];
  if (granularity === "hour") for (let t = start, i = 0; t < end; t += 3600000, i++) series.push({ key: `${period.from}T${String(i).padStart(2, "0")}`, start: new Date(t).toISOString(), sales: empty ? 0 : [0, 0, 0, 0, 0, 0, 0, 0, 98000, 0, 245000, 0, 189000, 0, 0, 312000][i] || 0, orders: empty ? 0 : [8, 10, 12, 15].includes(i) ? 1 : 0 });
  else for (let t = start, i = 0; t < end; t += DAY, i++) { const s = empty ? 0 : salesFor(i + 3); series.push({ key: civil(t), start: new Date(t).toISOString(), sales: s, orders: s ? Math.max(1, Math.round(s / 220000)) : 0 }); }
  const sales = series.reduce((s, p) => s + p.sales, 0), orders = series.reduce((s, p) => s + p.orders, 0);
  const comparison = empty || period.key === "custom" ? { available: false, reason: empty ? "No hay historial suficiente para comparar con el periodo anterior." : "Comparación no disponible para este rango." }
    : { available: true, previousFrom: civil(start - (end - start)), previousTo: civil(end - (end - start) - 1),
      metrics: { reconciledSales: { previous: Math.round(sales * 0.86), deltaPct: 16.3 }, ordersRegistered: { previous: orders + 2, deltaPct: -6.1 }, averageTicket: { previous: 211000, deltaPct: 4.2 }, unitsSold: { previous: orders * 2 - 3, deltaPct: 9.8 } } };
  return { status: "success", analytics: {
    timeZone: "America/Bogota", generatedAt: new Date(NOW).toISOString(),
    period: { ...period, start: new Date(start).toISOString(), end: new Date(startOfCivil(period.to) + DAY).toISOString(), granularity, basis: "createdAt" },
    sales: { reconciledSales: sales, reconciledOrders: orders, averageTicket: orders ? Math.round(sales / orders) : null, unitsSold: empty ? 0 : orders * 2 + 1, ordersRegistered: empty ? 0 : orders + 5, comparison },
    series,
    distribution: empty ? { total: 0, statuses: [], review: 0 } : { total: orders + 5, review: 1, statuses: [
      { key: "pending", label: "Pendientes", count: 6 }, { key: "preparing", label: "En preparación", count: 3 }, { key: "shipped", label: "Enviados", count: 5 },
      { key: "delivered", label: "Entregados", count: Math.max(0, orders - 13) }, { key: "cancelled", label: "Cancelados o rechazados", count: 3 }, { key: "returned", label: "Devueltos", count: 1 }] },
    products: empty ? { top: [], withoutSales: { count: 0, items: [] } } : {
      top: products.slice(0, 5).map(([id, name], i) => ({ id, name: i === 3 ? products[9][1] : name, image: null, units: [14, 11, 9, 6, 4][i], sales: [2646000, 2695000, 1764000, 1872000, 624000][i], exists: true })),
      withoutSales: { count: 7, items: products.slice(5, 9).map(([id, name], i) => ({ id, name, image: null, availableStock: [24, 18, 12, 6][i], stockStatus: "healthy" })) },
    },
    inventory: { threshold: 5, outVariants: 4, lowVariants: 9, reviewVariants: 1, items: [
      { productId: "p2", productName: products[1][1], variantId: "v21", sku: "FED-NAT-L", size: "L", color: "Natural", stock: 0, status: "out" },
      { productId: "p3", productName: products[2][1], variantId: "v31", sku: "BOL-SAN-U-CAF", size: null, color: "Café", stock: 0, status: "out" },
      { productId: "p6", productName: products[5][1], variantId: "v61", sku: "PLA-AA-M", size: "M", color: null, stock: null, status: "review" },
      { productId: "p1", productName: products[0][1], variantId: "v11", sku: "AGU-CLA-S-NAT", size: "S", color: "Natural", stock: 2, status: "low" },
      { productId: "p4", productName: products[9][1], variantId: "v41", sku: "VUE-21-58-NEG-CINTA-LARGA", size: "58", color: "Negro", stock: 3, status: "low" },
    ] },
    history: { firstOrderAt: "2026-03-02T15:00:00.000Z" },
  } };
}
const variant = (id, sku, stock, stockStatus) => ({ id, sku, stock, stockStatus });
const stockItem = (i, status, variants) => ({ id: `s${i}`, name: products[i % products.length][1], slug: `p${i}`, threshold: 5, totalStock: variants.reduce((s, v) => s + (v.stock || 0), 0) + 30, unavailable: false, affectedVariants: variants });
const alerts = ({ empty = false } = {}) => {
  if (empty) return { status: "success", totalCount: 0, generatedAt: new Date(NOW).toISOString(), alerts: Object.fromEntries(["paymentEvents", "financialFollowUp", "oldPendingPayments", "communications", "newOrders", "pendingPayments", "outOfStock", "lowStock", "inventoryReview", "specialRequests", "expiringCoupons"].map((k) => [k, { count: 0, items: [] }])) };
  const low = Array.from({ length: 10 }, (_, i) => stockItem(i, "low", [variant(`lv${i}a`, `SKU-${100 + i}-M`, (i % 5) + 1, "low"), ...(i % 3 === 0 ? [variant(`lv${i}b`, `SKU-${100 + i}-L`, 2, "low")] : [])]));
  const groups = {
    paymentEvents: { count: 2, items: [{ _id: "pe1", transactionId: "11968-1732460000-41267", status: "APPROVED", environment: "test", processingState: "failed", associationError: "Referencia sin pedido asociado", createdAt: ago(30) }, { _id: "pe2", transactionId: "11968-1732470000-58210", status: "DECLINED", environment: "test", processingState: "failed", lastError: "Consulta al proveedor fallida", createdAt: ago(9) }] },
    financialFollowUp: { count: 1, items: [{ _id: "pe3", transactionId: "11968-1732300000-11870", status: "APPROVED", environment: "test", administrativeArchive: { reason: "Pago duplicado en revisión", evidenceReceipt: "ev-001" }, createdAt: ago(80) }] },
    oldPendingPayments: { count: 2, items: [{ _id: "op1", orderNumber: orderNumber(11, 40), total: 245000, createdAt: ago(40) }, { _id: "op2", orderNumber: orderNumber(12, 60), total: 98000, createdAt: ago(60) }] },
    communications: { count: 3, items: [{ id: "c1", orderId: "ord2", orderNumber: recentOrders[2].orderNumber, count: 2, message: "Dirección de correo rechazada por el proveedor", at: ago(3) }, { id: "c2", orderId: "ord5", orderNumber: recentOrders[5].orderNumber, count: 1, message: "Envío de correo pendiente de reintento", at: ago(12) }] },
    newOrders: { count: 7, items: recentOrders.slice(0, 7).map((o) => ({ ...o })) },
    pendingPayments: { count: 3, items: [recentOrders[4], { ...recentOrders[3], _id: "ord13", orderNumber: orderNumber(13, 26), requiresReview: true, incidents: [{ code: "payment_amount_or_currency_mismatch" }], createdAt: ago(26) }, { ...recentOrders[1], _id: "ord14", orderNumber: orderNumber(14, 4), incidents: [{ code: "checkout_completion_failed" }], createdAt: ago(4) }] },
    outOfStock: { count: 4, threshold: 5, items: [stockItem(1, "out", [variant("ov1", "FED-NAT-L", 0, "out"), variant("ov1b", "FED-NAT-M", 3, "low")]), stockItem(2, "out", [variant("ov2", "BOL-SAN-U-CAF", 0, "out")]), stockItem(4, "out", [variant("ov4", "CAR-MAN-NEG", 0, "out")]), stockItem(9, "out", [variant("ov9", "VUE-21-58-NEG-CINTA-LARGA", 0, "out")])] },
    lowStock: { count: 18, threshold: 5, items: low },
    inventoryReview: { count: 1, threshold: 5, items: [stockItem(5, "review", [variant("rv5", "PLA-AA-M", null, "review")])] },
    specialRequests: { count: 2, items: [{ _id: "sr1", requestNumber: "SOL-0042", type: "customization", contact: { name: "Hotel Casa Pasto", email: "compras@example.test" }, createdAt: ago(20) }, { _id: "sr2", requestNumber: "SOL-0043", type: "wholesale", contact: { name: "Tienda Artesanías del Sur", email: "pedidos@example.test" }, createdAt: ago(6) }] },
    expiringCoupons: { count: 1, items: [{ _id: "cp1", code: "NAVIDAD15", expiresAt: new Date(NOW + 2 * DAY).toISOString(), usedCount: 14, maxUses: 50 }] },
  };
  return { status: "success", totalCount: Object.values(groups).reduce((s, g) => s + g.count, 0), alerts: groups, generatedAt: new Date(NOW).toISOString() };
};
module.exports = { NOW, recentOrders, attention, vendorAttention, analytics, alerts };

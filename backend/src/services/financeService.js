const Order = require("../models/order");
const Product = require("../models/product");
const { reconciledSalesFilter } = require("./financeCriteria");
const { emptyRollup, addLine, assess, productRow, round: roundMoney } = require("./financePresentation");
const {
  parseFinancePeriod,
  buildDateFilter,
  financeMonthBounds,
} = require("../utils/financePeriod");

const round = roundMoney;

const resolveProductId = (productRef) => {
  if (!productRef) return null;
  if (typeof productRef === "string") return productRef;
  if (productRef._id) return String(productRef._id);
  if (typeof productRef.toString === "function") return productRef.toString();
  return null;
};

const getEffectiveUnitPrice = (product) => {
  if (!product) return 0;
  if (typeof product.getEffectivePrice === "function") {
    return product.getEffectivePrice();
  }
  const salePrice = product.salePrice || 0;
  const onPromotion = product.onPromotion;
  const discount = product.discountPercent || 0;
  const endsAt = product.promotionEndsAt
    ? new Date(product.promotionEndsAt)
    : null;
  const promoActive =
    onPromotion &&
    discount > 0 &&
    (!endsAt || endsAt > new Date());
  if (promoActive) {
    return Math.round(salePrice * (1 - discount / 100));
  }
  return salePrice;
};

const getItemUnitCost = (item, costByProductId) => {
  if (item.unitCost != null && !Number.isNaN(item.unitCost)) {
    return item.unitCost;
  }
  const productId = resolveProductId(item.product);
  if (!productId) return null;
  const cost = costByProductId.get(productId);
  return cost != null ? cost : null;
};

const computeOrderEconomics = (orders, costByProductId) => {
  const totals = emptyRollup();
  const productMap = new Map();

  for (const order of orders) {
    for (const item of order.items || []) {
      const productId = resolveProductId(item.product);
      const fallback = productId ? costByProductId.get(productId) : null;
      addLine(totals, item, fallback == null ? null : fallback);
      if (!productId) continue;
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          ...emptyRollup(),
          productId,
          name: item.productName || "Producto",
          slug: item.productSlug || "",
        });
      }
      addLine(productMap.get(productId), item, fallback == null ? null : fallback);
    }
  }

  const view = assess(totals);
  const rows = [...productMap.values()].map(productRow);
  return {
    productRevenue: view.revenue,
    unitsSold: view.units,
    cogs: view.cogs,
    grossProfit: view.grossProfit,
    grossMarginPct: view.grossMarginPct,
    knownProfit: view.knownProfit,
    knownMarginPct: view.knownMarginPct,
    knownRevenue: view.knownRevenue,
    missingRevenue: view.missingRevenue,
    marginReliable: view.marginReliable,
    costCoveragePct: view.costCoveragePct,
    profitabilityStatus: view.status,
    itemsMissingCost: view.missingUnits,
    topByRevenue: rows.sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    topByProfit: rows.filter((row) => row.costComplete && row.profit != null)
      .sort((a, b) => b.profit - a.profit).slice(0, 8),
    missingCostProducts: rows.filter((row) => !row.costComplete).slice(0, 8),
  };
};

const computeInventoryValuation = (products) => {
  let unitsInStock = 0;
  let investmentAtCost = 0;
  let potentialRetail = 0;
  let potentialRetailKnown = 0;
  let productsMissingCost = 0;
  let variantsOutOfStock = 0;
  let unpublishedUnits = 0;
  let unpublishedProducts = 0;
  const catalogRows = [];

  for (const product of products) {
    const unitCost =
      product.internalCost != null ? product.internalCost : null;
    const retailUnit = getEffectiveUnitPrice(product);
    let productUnits = 0;
    let productCostValue = 0;
    let productRetailValue = 0;

    if (unitCost == null) productsMissingCost += 1;
    if (product.isActive === false) unpublishedProducts += 1;

    for (const variant of product.variants || []) {
      if (variant.isActive === false) continue;
      const stock = variant.stock || 0;
      productUnits += stock;
      if (stock === 0) variantsOutOfStock += 1;

      const variantPrice =
        variant.price != null ? variant.price : retailUnit;

      if (unitCost != null) {
        productCostValue += unitCost * stock;
        potentialRetailKnown += variantPrice * stock;
      }
      productRetailValue += variantPrice * stock;
    }
    if (product.isActive === false) unpublishedUnits += productUnits;

    unitsInStock += productUnits;
    investmentAtCost += productCostValue;
    potentialRetail += productRetailValue;

    const marginUnit =
      unitCost != null && retailUnit ? retailUnit - unitCost : null;

    catalogRows.push({
      id: String(product._id),
      name: product.name,
      slug: product.slug,
      isActive: product.isActive,
      unitsInStock: productUnits,
      internalCost: unitCost,
      salePrice: product.salePrice,
      effectivePrice: retailUnit,
      marginUnit: marginUnit != null ? round(marginUnit) : null,
      marginPct:
        marginUnit != null && retailUnit > 0
          ? round((marginUnit / retailUnit) * 1000) / 10
          : null,
      investmentAtCost: round(productCostValue),
      potentialRetail: round(productRetailValue),
      potentialProfit: unitCost == null ? null : round(productRetailValue - productCostValue),
      costKnown: unitCost != null,
      salesCount: product.salesCount || 0,
    });
  }

  return {
    unitsInStock,
    investmentAtCost: round(investmentAtCost),
    potentialRetail: round(potentialRetail),
    potentialProfit: round(potentialRetail - investmentAtCost),
    potentialProfitKnown: round(potentialRetailKnown - investmentAtCost),
    potentialRetailKnown: round(potentialRetailKnown),
    potentialMarginPct:
      potentialRetail > 0
        ? round(((potentialRetail - investmentAtCost) / potentialRetail) * 1000) /
          10
        : 0,
    potentialMarginReliable: productsMissingCost === 0,
    productsMissingCost,
    variantsOutOfStock,
    unpublishedUnits,
    unpublishedProducts,
    lowMarginProducts: catalogRows
      .filter(
        (p) =>
          p.marginPct != null &&
          p.marginPct < 25 &&
          p.unitsInStock > 0 &&
          p.isActive
      )
      .sort((a, b) => a.marginPct - b.marginPct)
      .slice(0, 8),
    highStockLowSales: catalogRows
      .filter((p) => p.unitsInStock >= 10 && (p.salesCount || 0) < 3)
      .sort((a, b) => b.unitsInStock - a.unitsInStock)
      .slice(0, 8),
    catalogSummary: catalogRows
      .filter((p) => p.isActive)
      .sort((a, b) => b.investmentAtCost - a.investmentAtCost),
    stockLeaders: [...catalogRows].sort((a, b) => b.unitsInStock - a.unitsInStock || String(a.id).localeCompare(String(b.id))).slice(0, 5),
  };
};

const buildMonthlyTrend = async (products, months = 6) => {
  const trend = [];
  const now = new Date();
  const costMap = new Map(
    products.map((p) => [String(p._id), p.internalCost ?? null])
  );

  for (let i = months - 1; i >= 0; i -= 1) {
    const { start, end } = financeMonthBounds(i, now);

    const orders = await Order.find(reconciledSalesFilter({
      createdAt: { $gte: start, $lte: end },
    }))
      .select("items total unitCost")
      .lean();

    const econ = computeOrderEconomics(orders, costMap);
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

    trend.push({
      key: start.toISOString().slice(0, 7),
      month: start.toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        month: "short",
        year: "2-digit",
      }),
      orders: orders.length,
      totalRevenue: round(totalRevenue),
      productRevenue: econ.productRevenue,
      grossProfit: econ.marginReliable ? econ.grossProfit : econ.knownProfit,
      marginReliable: econ.marginReliable,
      itemsMissingCost: econ.itemsMissingCost,
      profitabilityStatus: econ.profitabilityStatus,
    });
  }

  return trend;
};

const parseRangeParam = (query) => {
  const range = query.range || query.period || "month";
  return parseFinancePeriod(range, query.from, query.to);
};

exports.buildFinanceReport = async (query = {}) => {
  const { start, end, label } = parseRangeParam(query);
  const dateFilter = buildDateFilter(start, end);

  const paidFilter = reconciledSalesFilter(dateFilter);
  const pendingFilter = {
    paymentStatus: "pendiente",
    orderStatus: { $nin: ["cancelado", "rechazado"] },
    ...dateFilter,
  };

  const [paidOrders, pendingOrders, allProducts] = await Promise.all([
    Order.find(paidFilter)
      .select(
        "items total subtotal shippingCost taxTotal discountTotal paymentMethod createdAt orderNumber unitCost"
      )
      .lean(),
    Order.find(pendingFilter).select("total").lean(),
    Product.find()
      .select(
        "+internalCost name slug salePrice onPromotion discountPercent promotionEndsAt variants isActive salesCount"
      )
      .lean(),
  ]);

  let paymentMethods = [];
  try {
    paymentMethods = await Order.aggregate([
      { $match: paidFilter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      { $sort: { total: -1 } },
    ]);
  } catch {
    paymentMethods = [];
  }

  const costByProductId = new Map(
    allProducts.map((p) => [String(p._id), p.internalCost ?? null])
  );

  const sales = computeOrderEconomics(paidOrders, costByProductId);
  const inventory = computeInventoryValuation(allProducts);

  const totalCollected = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const shippingCollected = paidOrders.reduce(
    (s, o) => s + (o.shippingCost || 0),
    0
  );
  const taxCollected = paidOrders.reduce((s, o) => s + (o.taxTotal || 0), 0);
  const discountsGiven = paidOrders.reduce(
    (s, o) => s + (o.discountTotal || 0),
    0
  );
  const pendingCollection = pendingOrders.reduce(
    (s, o) => s + (o.total || 0),
    0
  );

  const monthlyTrend = await buildMonthlyTrend(allProducts, 6);

  const salesLines = [];
  for (const order of paidOrders) {
    for (const item of order.items || []) {
      const productId = resolveProductId(item.product);
      const unitCost = getItemUnitCost(item, costByProductId);
      const qty = item.quantity || 0;
      const revenue =
        item.lineTotal != null
          ? item.lineTotal
          : (item.unitPrice || 0) * qty;
      salesLines.push({
        date: order.createdAt,
        orderNumber: order.orderNumber,
        productName: item.productName,
        sku: item.sku,
        sizeName: item.sizeName,
        colorName: item.colorName,
        quantity: qty,
        unitPrice: item.unitPrice,
        revenue: round(revenue),
        unitCost: unitCost != null ? round(unitCost) : null,
        lineCost: unitCost != null ? round(unitCost * qty) : null,
        lineProfit:
          unitCost != null ? round(revenue - unitCost * qty) : null,
        paymentMethod: order.paymentMethod,
      });
    }
  }

  return {
    period: { label, start: start || null, end: end || null },
    sales: {
      ordersCount: paidOrders.length,
      totalCollected: round(totalCollected),
      productRevenue: sales.productRevenue,
      unitsSold: sales.unitsSold,
      cogs: sales.cogs,
      grossProfit: sales.grossProfit,
      grossMarginPct: sales.grossMarginPct,
      averageOrderValue:
        paidOrders.length > 0
          ? round(totalCollected / paidOrders.length)
          : 0,
      shippingCollected: round(shippingCollected),
      taxCollected: round(taxCollected),
      discountsGiven: round(discountsGiven),
      itemsMissingCost: sales.itemsMissingCost,
      knownProfit: sales.knownProfit,
      knownMarginPct: sales.knownMarginPct,
      knownRevenue: sales.knownRevenue,
      missingRevenue: sales.missingRevenue,
      marginReliable: sales.marginReliable,
      costCoveragePct: sales.costCoveragePct,
      profitabilityStatus: sales.profitabilityStatus,
      topByRevenue: sales.topByRevenue,
      topByProfit: sales.topByProfit,
      missingCostProducts: sales.missingCostProducts,
    },
    pending: {
      ordersCount: pendingOrders.length,
      amount: round(pendingCollection),
    },
    inventory,
    paymentMethods: paymentMethods.map((row) => ({
      method: row._id || "sin_metodo",
      count: row.count,
      total: round(row.total),
    })),
    monthlyTrend,
    salesLines,
    notes: [
      "Las ventas conciliadas excluyen pedidos cancelados, devueltos o con incidencias; el dinero recibido se conserva como evidencia para conciliación.",
      "La ganancia bruta usa el costo registrado en cada pedido cuando existe; si no, el costo actual del producto.",
      "Asigna costo interno en todos los productos para métricas precisas.",
      ...(sales.marginReliable ? [] : ["Rentabilidad pendiente de completar costos. La ganancia mostrada como verificable usa solo líneas con costo conocido; el margen histórico no es una rentabilidad confirmada."]),
      "Sin ventas en el período los totales aparecen en cero.",
    ],
  };
};

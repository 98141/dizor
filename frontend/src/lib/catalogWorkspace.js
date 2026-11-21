export const STOCK_LABELS = { healthy: "Disponible", low: "Stock bajo", out: "Agotado", inactive: "Inactiva", review: "Revisar existencias" };
export const variantName = (v) => [v.sizeName || v.size?.name, v.colorName || v.color?.name].filter(Boolean).join(" / ") || "Presentación sin talla ni color";
export const catalogReturn = (value) => typeof value === "string" && ["/admin/productos", "/admin/inventario"].some((base) => value === base || value.startsWith(base + "?")) ? value : "/admin/productos";
export const movementLabel = (row) => row.eventType === "sale" ? "Venta" : row.eventType === "stock_adjustment"
  ? row.referenceType === "order" && row.quantityChange > 0 ? "Restauración por pedido"
    : row.referenceType === "order" ? "Ajuste asociado a pedido" : row.quantityChange > 0 ? "Reposición" : row.quantityChange < 0 ? "Retiro administrativo" : "Registro de existencias"
  : ({ created: "Producto registrado", updated: "Datos modificados", deleted: "Eliminación histórica", price_change: "Cambio de precio", status_change: "Publicación / variante" }[row.eventType] || row.eventType);

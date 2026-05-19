export const PRODUCT_EVENT_LABELS = {
  created: "Registro nuevo",
  updated: "Modificación",
  stock_adjustment: "Ajuste de stock",
  sale: "Venta",
  deleted: "Eliminado",
  price_change: "Cambio de precio",
  status_change: "Estado en tienda",
};

export const PRODUCT_EVENT_CLASSES = {
  created: "product-event--created",
  updated: "product-event--updated",
  stock_adjustment: "product-event--stock",
  sale: "product-event--sale",
  deleted: "product-event--deleted",
  price_change: "product-event--price",
  status_change: "product-event--status",
};

export const getProductEventLabel = (type) =>
  PRODUCT_EVENT_LABELS[type] || type;
